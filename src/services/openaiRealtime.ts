// OpenAI Realtime API Service
// WebSocket-based real-time voice conversations with gpt-4o-mini-realtime-preview

// OPENAI_API_KEY removed - using proxy server for authentication

interface RealtimeUsage {
  inputTokens: number;
  outputTokens: number;
  audioInputSeconds: number;
  audioOutputSeconds: number;
  cost: number;
  timestamp: Date;
}

interface RealtimeLimits {
  maxDailyConversations: number;
  maxConversationDurationSeconds: number;
  dailyUsage: RealtimeUsage[];
  dailySessionsStarted: number; // Count sessions when they start, not end
  lastResetDate: string;
}

interface RealtimeSession {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startTime: Date;
  duration: number;
  usage: RealtimeUsage;
}

type EventCallback = (data?: unknown) => void;

export class OpenAIRealtimeService {
  private static readonly MAX_DAILY_LIMIT = 20;
  private ws: WebSocket | null = null;
  private session: RealtimeSession | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private currentUserId: string | null = null; // Namespace usage per user
  // Using AudioWorklet/ScriptProcessor instead of MediaRecorder for raw PCM16
  private audioStream: MediaStream | null = null;
  private isRecording: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlayingAudio: boolean = false;
  private responseTimer: NodeJS.Timeout | null = null;
  
  // Voice Activity Detection (VAD) properties
  private vadSilenceTimer: NodeJS.Timeout | null = null;
  private vadSilenceThreshold: number = 1000; // 1000ms of silence before committing
  private vadVolumeThreshold: number = 0.015; // Volume threshold for detecting speech
  private lastSpeechTime: number = 0;
  private audioBufferDuration: number = 0; // Track total audio buffer duration
  private minBufferDuration: number = 500; // Minimum 500ms of audio before allowing commit
  private isProcessingResponse: boolean = false; // Flag to prevent double-triggering
  
  private usage: RealtimeLimits = {
    maxDailyConversations: OpenAIRealtimeService.MAX_DAILY_LIMIT, // Enforce 20/day hard limit
    maxConversationDurationSeconds: 300, // Max 5 minutes per conversation
    dailyUsage: [],
    dailySessionsStarted: 0,
    lastResetDate: new Date().toDateString()
  };

  constructor() {
    // Default to guest key until a userId is provided
    this.loadUsageFromStorage();
    this.initializeEventListeners();
  }

  // Load usage data from localStorage
  private getStorageKey(): string {
    const suffix = this.currentUserId ? `_${this.currentUserId}` : '_guest';
    return `openai_realtime_usage${suffix}`;
  }

  private loadUsageFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Reset daily usage if it's a new day
        const today = new Date().toDateString();
        if (parsed.lastResetDate !== today) {
          parsed.dailyUsage = [];
          parsed.dailySessionsStarted = 0;
          parsed.lastResetDate = today;
        }
        
        // Ensure new field exists for old data
        if (parsed.dailySessionsStarted === undefined) {
          parsed.dailySessionsStarted = parsed.dailyUsage?.length || 0;
        }
        
        // Always enforce current app-side daily cap
        parsed.maxDailyConversations = OpenAIRealtimeService.MAX_DAILY_LIMIT;
        this.usage = { ...this.usage, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load realtime usage data:', error);
    }
  }

  // Save usage data to localStorage
  private saveUsageToStorage(): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.usage));
    } catch (error) {
      console.warn('Failed to save realtime usage data:', error);
    }
  }

  // Next reset time string (midnight)
  private getNextResetTimeString(): string {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // Public: set active user for namespaced usage tracking
  setUserId(userId: string | null): void {
    // If user changes, load their usage namespace
    this.currentUserId = userId;
    this.loadUsageFromStorage();
    // Enforce cap after loading any prior data
    this.usage.maxDailyConversations = OpenAIRealtimeService.MAX_DAILY_LIMIT;
    // Ensure daily reset logic applies on switch
    const today = new Date().toDateString();
    if (this.usage.lastResetDate !== today) {
      this.usage.dailyUsage = [];
      this.usage.dailySessionsStarted = 0;
      this.usage.lastResetDate = today;
    }
    this.saveUsageToStorage();
    console.log(`👤 Realtime usage scoped to user: ${this.currentUserId ?? 'guest'}`);
  }

  // Initialize event listener maps
  private initializeEventListeners(): void {
    this.eventListeners.set('session.created', []);
    this.eventListeners.set('session.updated', []);
    this.eventListeners.set('response.audio.delta', []);
    this.eventListeners.set('response.audio.done', []);
    this.eventListeners.set('response.created', []);
    this.eventListeners.set('response.output_item.added', []);
    this.eventListeners.set('response.output_item.done', []);
    this.eventListeners.set('conversation.item.created', []);
    this.eventListeners.set('error', []);
    this.eventListeners.set('connection.open', []);
    this.eventListeners.set('connection.close', []);
    this.eventListeners.set('audio.input.started', []);
    this.eventListeners.set('audio.input.stopped', []);
    this.eventListeners.set('audio.output.started', []);
    this.eventListeners.set('audio.output.finished', []);
    this.eventListeners.set('input_audio_buffer.speech_started', []);
    this.eventListeners.set('input_audio_buffer.speech_stopped', []);
    this.eventListeners.set('input_audio_buffer.committed', []);
  }

  // Event listener management
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Check if user can start a conversation
  canStartConversation(): { allowed: boolean; reason?: string } {
    const today = new Date().toDateString();
    
    // Reset if new day
    if (this.usage.lastResetDate !== today) {
      this.usage.dailyUsage = [];
      this.usage.dailySessionsStarted = 0;
      this.usage.lastResetDate = today;
      this.saveUsageToStorage();
    }

    // Check if already in a session
    if (this.session && this.session.status === 'connected') {
      return {
        allowed: false,
        reason: 'A conversation is already in progress. End current conversation first.'
      };
    }

    // Check daily conversation limit (hard block)
    if (this.usage.dailySessionsStarted >= this.usage.maxDailyConversations) {
      return {
        allowed: false,
        reason: `Daily conversation limit reached (${this.usage.maxDailyConversations}/day). Next reset at ${this.getNextResetTimeString()}`
      };
    }

    return { allowed: true };
  }

  // Get current usage stats
  getUsageStats() {
    const today = new Date().toDateString();
    
    // Reset if new day
    if (this.usage.lastResetDate !== today) {
      this.usage.dailyUsage = [];
      this.usage.dailySessionsStarted = 0;
      this.usage.lastResetDate = today;
    }

    const conversationsUsed = this.usage.dailySessionsStarted;
    const conversationsRemaining = this.usage.maxDailyConversations - conversationsUsed;
    const totalCostToday = this.usage.dailyUsage.reduce((sum, usage) => sum + usage.cost, 0);

    return {
      conversationsUsed,
      conversationsRemaining,
      maxConversations: this.usage.maxDailyConversations,
      maxDurationSeconds: this.usage.maxConversationDurationSeconds,
      totalCostToday: Math.round(totalCostToday * 100) / 100,
      currentSession: this.session,
      isConnected: this.ws?.readyState === WebSocket.OPEN
    };
  }

  // Get current session info
  getCurrentSession(): RealtimeSession | null {
    return this.session;
  }

  // Get connection status
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Connect to OpenAI Realtime API via local proxy
  async connect(): Promise<void> {
    const canConnect = this.canStartConversation();
    if (!canConnect.allowed) {
      throw new Error(canConnect.reason);
    }

    try {
      console.log('🔗 Connecting to OpenAI Realtime API via proxy...');
      
      // Connect to our local proxy server instead of OpenAI directly
      const proxyUrl = 'wss://healthassist-mvp-qvi7.vercel.app/api/realtime';
      this.ws = new WebSocket(proxyUrl);

      // Set up WebSocket handlers
      this.setupWebSocketHandlers();

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout - make sure proxy server is running on port 3001'));
        }, 10000); // 10 second timeout

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ Connected to proxy server');
          this.handleConnectionOpen();
          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ Proxy connection failed:', error);
          reject(new Error('Failed to connect to proxy server. Make sure it\'s running on port 3001'));
        };
      });

    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.cleanup();
      throw error;
    }
  }



  // Set up WebSocket event handlers
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket connection closed:', event.code, event.reason);
      this.handleConnectionClose();
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', { error, message: 'WebSocket connection error' });
    };
  }

  // Handle WebSocket messages from OpenAI
  private handleWebSocketMessage(data: Record<string, unknown>): void {
    console.log('📨 Received message:', data.type, data);

    switch (data.type) {
      case 'session.created':
        this.handleSessionCreated(data);
        break;
      case 'session.updated':
        this.emit('session.updated', data);
        break;
      case 'response.audio.delta':
        console.log('🎵 Received streaming audio delta');
        this.handleAudioDelta(data);
        break;
      case 'response.audio.done':
        console.log('🎵 Audio stream completed');
        this.handleAudioDone(data);
        break;
      case 'response.created':
        console.log('🤖 Response generation started');
        this.emit('response.created', data);
        break;
      case 'response.output_item.added':
        console.log('📝 Response item added:', data);
        this.emit('response.output_item.added', data);
        break;
      case 'response.output_item.done':
        console.log('✅ Response item completed');
        this.emit('response.output_item.done', data);
        break;
      case 'response.done':
        console.log('🎯 AI response completed');
        this.handleResponseDone(data);
        break;
      case 'conversation.item.created':
        this.emit('conversation.item.created', data);
        break;
      case 'input_audio_buffer.speech_started':
        console.log('🎙️ Server-side speech detected (ignoring - using client VAD)');
        // Don't interrupt AI audio or cancel responses - we handle VAD client-side
        this.emit('input_audio_buffer.speech_started', data);
        break;
      case 'input_audio_buffer.speech_stopped':
        console.log('🔇 Server-side speech ended (ignoring - using client VAD)');
        // Don't auto-trigger responses - we handle this client-side
        this.emit('input_audio_buffer.speech_stopped', data);
        break;
      case 'input_audio_buffer.committed':
        console.log('✅ Audio buffer committed to OpenAI');
        this.emit('input_audio_buffer.committed', data);
        break;
      case 'error':
        console.error('❌ Realtime API error:', data.error);
        this.emit('error', data.error);
        break;
      default:
        console.log('📨 Unhandled message type:', data.type);
    }
  }

  // Handle connection opening
  private handleConnectionOpen(): void {
    console.log('🎉 Realtime connection established');
    this.emit('connection.open');
    
    // Send session configuration
    this.sendSessionConfig();
  }
  
  // Send session configuration to OpenAI
  private sendSessionConfig(): void {
    if (this.isConnected()) {
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'You are a helpful AI health assistant. Provide empathetic, accurate health guidance while always recommending users consult healthcare professionals for serious concerns. Keep responses concise but caring.',
          voice: 'shimmer',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: null, // Use manual turn detection since we handle VAD client-side
          tools: [],
          tool_choice: 'auto',
          temperature: 0.7,
          max_response_output_tokens: 500
        }
      };
      this.sendMessage(sessionConfig);
      console.log('⚙️ Session configuration sent to OpenAI');
    }
  }

  // Handle connection closing
  private handleConnectionClose(): void {
    console.log('👋 Realtime connection closed');
    this.emit('connection.close');
    
    if (this.session && this.session.status === 'connected') {
      this.session.status = 'disconnected';
    }
  }

  // Handle session creation
  private handleSessionCreated(data: Record<string, unknown>): void {
    const sessionData = data.session as { id: string };
    console.log('🎯 Session created:', sessionData.id);
    this.session = {
      id: sessionData.id,
      status: 'connected',
      startTime: new Date(),
      duration: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        audioInputSeconds: 0,
        audioOutputSeconds: 0,
        cost: 0,
        timestamp: new Date()
      }
    };

    // Count session as started immediately (decreases remaining count)
    this.usage.dailySessionsStarted++;
    this.saveUsageToStorage();
    console.log(`📊 Session started - ${this.usage.dailySessionsStarted}/${this.usage.maxDailyConversations} used`);

    this.emit('session.created', data);
  }

  // Handle session ending
  private handleSessionEnd(): void {
    if (!this.session) return;

    console.log('🏁 Session ended');
    
    // Calculate final duration
    this.session.duration = (Date.now() - this.session.startTime.getTime()) / 1000;
    this.session.status = 'disconnected';

    // Save usage statistics
    this.usage.dailyUsage.push(this.session.usage);
    this.saveUsageToStorage();

    console.log(`📊 Session stats: ${this.session.duration}s, $${this.session.usage.cost.toFixed(4)}`);
    
    this.session = null;
  }



  // Send message to WebSocket
  private sendMessage(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ Cannot send message: WebSocket not connected');
    }
  }

  // Start audio recording and streaming
  async startAudioInput(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Realtime API');
    }

    if (this.isRecording) {
      console.log('⚠️ Audio input already started');
      return;
    }

    try {
      console.log('🎙️ Starting audio input...');

      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000, // OpenAI Realtime prefers 24kHz
          channelCount: 1 // Mono audio
        }
      });

      // Set up AudioContext for raw PCM16 processing (as per OpenAI docs)
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await this.audioContext.resume(); // Ensure AudioContext is running
      
      console.log('🎙️ Setting up raw PCM16 audio processing for OpenAI Realtime API');
      
      // Create audio source from getUserMedia stream
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Use AudioWorklet for real-time PCM16 processing (modern approach)
      try {
        // Try to use AudioWorkletNode (modern, preferred)
        await this.setupAudioWorklet(source);
      } catch (workletError) {
        console.warn('⚠️ AudioWorklet not available, falling back to ScriptProcessor:', workletError);
        // Fallback to ScriptProcessor for older browsers
        this.setupScriptProcessor(source);
      }
      this.isRecording = true;

      console.log('✅ Audio input started successfully');
      this.emit('audio.input.started');

    } catch (error) {
      console.error('❌ Failed to start audio input:', error);
      this.cleanup();
      throw new Error('Failed to access microphone');
    }
  }

  // Stop audio recording (manual stop - don't auto-respond)
  async stopAudioInput(): Promise<void> {
    console.log('🔇 Manually stopping audio input...');

    this.isRecording = false;

    // Cancel any pending auto-response
    if (this.responseTimer) {
      console.log('🚫 Canceling pending auto-response');
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
    }

    // Audio processing is handled by AudioWorklet/ScriptProcessor, no MediaRecorder to stop

    // Don't cleanup audio context - keep it for playing AI response
    // this.cleanup();
    console.log('✅ Audio input stopped (manual - no auto-response)');
    this.emit('audio.input.stopped');
  }



  // Setup AudioWorklet for modern, efficient audio processing
  private async setupAudioWorklet(source: MediaStreamAudioSourceNode): Promise<void> {
    if (!this.audioContext) throw new Error('AudioContext not available');
    
    // Create a simple inline AudioWorklet processor
    const processorCode = `
      class RealtimePCM16Processor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 2048; // Small buffer for low latency
          this.sampleRate = 24000; // Target sample rate for OpenAI
        }
        
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input[0]) {
            const inputData = input[0]; // Get first channel (mono)
            
            // Resample if needed (simple decimation/interpolation)
            const resampled = this.resample(inputData, sampleRate, this.sampleRate);
            
            // Send to main thread
            this.port.postMessage({
              type: 'audioData',
              data: resampled
            });
          }
          return true;
        }
        
        resample(inputData, inputSampleRate, outputSampleRate) {
          if (inputSampleRate === outputSampleRate) return inputData;
          
          const ratio = inputSampleRate / outputSampleRate;
          const outputLength = Math.floor(inputData.length / ratio);
          const output = new Float32Array(outputLength);
          
          for (let i = 0; i < outputLength; i++) {
            const sourceIndex = i * ratio;
            const index = Math.floor(sourceIndex);
            output[i] = inputData[index];
          }
          
          return output;
        }
      }
      
      registerProcessor('realtime-pcm16-processor', RealtimePCM16Processor);
    `;
    
    // Create blob URL for the processor
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const processorUrl = URL.createObjectURL(blob);
    
    // Add the AudioWorklet module
    await this.audioContext.audioWorklet.addModule(processorUrl);
    
    // Create the AudioWorkletNode
    const workletNode = new AudioWorkletNode(this.audioContext, 'realtime-pcm16-processor');
    
    // Handle messages from the worklet
    workletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData') {
        this.sendPCM16Audio(event.data.data);
      }
    };
    
    // Connect the audio graph
    source.connect(workletNode);
    
    console.log('✅ AudioWorklet setup complete for real-time PCM16 processing');
  }

  // Fallback: Setup ScriptProcessor for older browsers
  private setupScriptProcessor(source: MediaStreamAudioSourceNode): void {
    if (!this.audioContext) return;
    
    // Create ScriptProcessor with small buffer for low latency
    const processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    
    processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Resample to 24kHz if needed
      const targetSampleRate = 24000;
      const currentSampleRate = this.audioContext!.sampleRate;
      
      const processedData = currentSampleRate === targetSampleRate 
        ? inputData 
        : this.resampleAudio(inputData, currentSampleRate, targetSampleRate);
      
      this.sendPCM16Audio(processedData);
    };
    
    // Connect the audio graph
    source.connect(processor);
    processor.connect(this.audioContext.destination); // Needed to keep processor active
    
    console.log('✅ ScriptProcessor setup complete for real-time PCM16 processing');
  }

  // Simple audio resampling
  private resampleAudio(audioData: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
    if (sourceSampleRate === targetSampleRate) {
      return audioData;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < audioData.length) {
        // Linear interpolation
        result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        result[i] = audioData[index];
      }
    }

    return result;
  }

  // Send PCM16 audio data to OpenAI Realtime API with Voice Activity Detection
  private sendPCM16Audio(audioData: Float32Array): void {
    try {
      // Skip if audio data is too short
      if (audioData.length === 0) return;
      
      // Calculate audio duration in milliseconds
      const audioChunkDuration = (audioData.length / 24000) * 1000;
      
      // Calculate audio volume (RMS)
      const rms = Math.sqrt(audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length);
      
      // Voice Activity Detection (VAD)
      const isSpeaking = rms > this.vadVolumeThreshold;
      
      if (isSpeaking) {
        // User is speaking - update last speech time and clear silence timer
        this.lastSpeechTime = Date.now();
        
        // Clear any existing silence timer
        if (this.vadSilenceTimer) {
          clearTimeout(this.vadSilenceTimer);
          this.vadSilenceTimer = null;
        }
        
        // Convert Float32Array to PCM16 (16-bit signed integers)
        const pcm16 = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          // Clamp and convert to 16-bit signed integer
          const sample = Math.max(-1, Math.min(1, audioData[i]));
          pcm16[i] = Math.round(sample * 32767);
        }

        // Convert to base64 more efficiently
        const uint8Array = new Uint8Array(pcm16.buffer);
        
        // Use chunks for large data to avoid stack overflow
        let base64String = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64String += btoa(String.fromCharCode(...chunk));
        }

        // Send audio input event to OpenAI
        const audioEvent = {
          type: 'input_audio_buffer.append',
          audio: base64String
        };

        this.sendMessage(audioEvent);
        
        // Track audio buffer duration
        this.audioBufferDuration += audioChunkDuration;
        console.log(`🎙️ Sent ${audioData.length} samples (${audioChunkDuration.toFixed(0)}ms) to OpenAI - Total buffer: ${this.audioBufferDuration.toFixed(0)}ms`);
        
      } else {
        // User is silent - start silence timer only once (don't reset constantly)
        if (!this.vadSilenceTimer && this.lastSpeechTime > 0 && this.audioBufferDuration >= this.minBufferDuration) {
          console.log(`🤫 Silence detected, buffer has ${this.audioBufferDuration.toFixed(0)}ms audio - starting ${this.vadSilenceThreshold}ms commit timer...`);
          this.vadSilenceTimer = setTimeout(() => {
            console.log(`⏰ Silence timeout reached, committing ${this.audioBufferDuration.toFixed(0)}ms of audio`);
            this.commitAudioBuffer();
            this.vadSilenceTimer = null;
          }, this.vadSilenceThreshold);
        } else if (!this.vadSilenceTimer && this.lastSpeechTime > 0 && this.audioBufferDuration < this.minBufferDuration) {
          console.log(`⏳ Silence detected but buffer only has ${this.audioBufferDuration.toFixed(0)}ms - need ${this.minBufferDuration}ms minimum`);
        }
        // If timer is already running, don't restart it - let it complete
      }

    } catch (error) {
      console.error('❌ Failed to send PCM16 audio:', error);
    }
  }

  // Commit audio buffer (signal end of user speech)
  commitAudioBuffer(): void {
    if (this.isProcessingResponse) {
      console.log('⏭️ Already processing response, skipping commit');
      return;
    }
    
    if (this.isConnected() && this.audioBufferDuration >= this.minBufferDuration) {
      this.isProcessingResponse = true;
      
      const commitEvent = {
        type: 'input_audio_buffer.commit'
      };
      this.sendMessage(commitEvent);
      console.log(`📝 Audio buffer committed (${this.audioBufferDuration.toFixed(0)}ms of audio) - requesting AI response`);
      
      // Trigger AI response generation after committing audio with longer delay
      setTimeout(() => {
        console.log('🤖 Triggering AI response generation...');
        this.createResponse();
      }, 500); // Increased delay to ensure previous response is fully done
      
      // Reset VAD state after commit
      this.lastSpeechTime = 0;
      this.audioBufferDuration = 0;
    } else if (this.isConnected() && this.audioBufferDuration < this.minBufferDuration) {
      console.log(`⚠️ Cannot commit: buffer only has ${this.audioBufferDuration.toFixed(0)}ms, need ${this.minBufferDuration}ms minimum - clearing buffer`);
      this.clearAudioBuffer();
      
      // Reset VAD state
      this.lastSpeechTime = 0;
      this.audioBufferDuration = 0;
    }
  }
  
  // Configure Voice Activity Detection settings
  configureVAD(options: { silenceThreshold?: number; volumeThreshold?: number }): void {
    if (options.silenceThreshold !== undefined) {
      this.vadSilenceThreshold = Math.max(200, Math.min(2000, options.silenceThreshold)); // 200ms to 2s
      console.log(`🎚️ VAD silence threshold set to ${this.vadSilenceThreshold}ms`);
    }
    if (options.volumeThreshold !== undefined) {
      this.vadVolumeThreshold = Math.max(0.001, Math.min(0.1, options.volumeThreshold)); // 0.001 to 0.1
      console.log(`🎚️ VAD volume threshold set to ${this.vadVolumeThreshold}`);
    }
  }

  // Clear audio buffer
  clearAudioBuffer(): void {
    if (this.isConnected()) {
      const clearEvent = {
        type: 'input_audio_buffer.clear'
      };
      this.sendMessage(clearEvent);
      console.log('🗑️ Audio buffer cleared');
      
      // Reset buffer duration tracking
      this.audioBufferDuration = 0;
      this.lastSpeechTime = 0;
    }
  }

  // Create AI response (trigger response generation)
  createResponse(): void {
    if (this.isConnected()) {
      // First, cancel any existing response to clear the state
      const cancelEvent = {
        type: 'response.cancel'
      };
      this.sendMessage(cancelEvent);
      console.log('🚫 Cancelled any existing response');
      
      // Small delay then create new response
      setTimeout(() => {
        const responseEvent = {
          type: 'response.create'
          // Don't override voice, modalities, or format - use session configuration
        };
        console.log('📤 Sending response.create event:', JSON.stringify(responseEvent, null, 2));
        this.sendMessage(responseEvent);
        console.log('🤖 Requesting AI response generation (using session defaults)');
      }, 100);
    }
  }

  // Check if currently recording
  isAudioRecording(): boolean {
    return this.isRecording;
  }

  // Enhanced disconnect to clean up audio
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from OpenAI Realtime API...');
    
    // Cancel any pending response timer
    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
      console.log('⏰ Cleared response timer');
    }
    
    // Cancel any pending VAD silence timer
    if (this.vadSilenceTimer) {
      clearTimeout(this.vadSilenceTimer);
      this.vadSilenceTimer = null;
      console.log('🤫 Cleared VAD silence timer');
    }
    
    // Reset VAD state
    this.audioBufferDuration = 0;
    this.lastSpeechTime = 0;
    this.isProcessingResponse = false;
    console.log('🔄 Reset VAD state');
    
    // Stop audio input first
    if (this.isRecording) {
      console.log('🎙️ Stopping audio input...');
      await this.stopAudioInput();
    }

    // Stop audio output
    if (this.isPlayingAudio) {
      console.log('🔊 Stopping audio output...');
      this.stopAudioPlayback();
    }

    if (this.ws) {
      console.log('📡 Closing WebSocket connection...');
      this.ws.close();
      this.ws = null;
    }

    if (this.session) {
      console.log('🏁 Ending session...');
      this.handleSessionEnd();
    }
    
    console.log('✅ Disconnect complete');
  }

  // Handle response completion
  private handleResponseDone(data: Record<string, unknown>): void {
    console.log('🎯 AI response generation completed');
    console.log('🔍 Full response data:', JSON.stringify(data, null, 2));
    
    const response = data.response as Record<string, unknown>;
    
    if (response) {
      console.log('📦 Response object:', JSON.stringify(response, null, 2));
      
      // Check multiple possible locations for audio data
      let audioFound = false;
      
      // Method 1: Check response.output array
      if (response.output && Array.isArray(response.output)) {
        const outputs = response.output as Array<Record<string, unknown>>;
        console.log(`🔍 Checking ${outputs.length} output items`);
        
        outputs.forEach((output, index) => {
          console.log(`📄 Output ${index}:`, JSON.stringify(output, null, 2));
          
          if (output.type === 'audio' && output.audio) {
            console.log(`🔊 Found audio in output ${index}`);
            const audioData = output.audio as string;
            this.processAudioDelta(audioData);
            audioFound = true;
          }
        });
      }
      
      // Method 2: Check direct audio property
      if (!audioFound && response.audio) {
        console.log('🔊 Found direct audio property');
        const audioData = response.audio as string;
        this.processAudioDelta(audioData);
        audioFound = true;
      }
      
      // Method 3: Check if it's in a different structure
      if (!audioFound && response.content && Array.isArray(response.content)) {
        const content = response.content as Array<Record<string, unknown>>;
        content.forEach((item, index) => {
          console.log(`📝 Content ${index}:`, JSON.stringify(item, null, 2));
          
          if (item.type === 'audio' && item.audio) {
            console.log(`🔊 Found audio in content ${index}`);
            const audioData = item.audio as string;
            this.processAudioDelta(audioData);
            audioFound = true;
          }
        });
      }
      
      if (audioFound) {
        console.log('🎵 Audio data processed successfully');
        this.emit('response.audio.finished');
      } else {
        console.log('❌ No audio output found in response');
        console.log('📋 Available properties:', Object.keys(response));
      }
    } else {
      console.log('❌ No response object found in data');
    }
    
    // Reset processing flag to allow next response
    this.isProcessingResponse = false;
    console.log('✅ Ready for next voice interaction');
    
    // Emit the response.done event for any listeners
    this.emit('response.done', data);
  }

  // Handle incoming audio delta (streaming audio from AI)
  private handleAudioDelta(data: Record<string, unknown>): void {
    const audioData = data.delta as string;
    if (audioData) {
      console.log(`🔊 Received audio delta from AI (${audioData.length} chars)`);
      this.processAudioDelta(audioData);
      this.emit('response.audio.delta', data);
    } else {
      console.log('⚠️ Audio delta received but no data found');
      console.log('🔍 Delta data:', JSON.stringify(data, null, 2));
    }
  }

  // Handle audio response completion
  private handleAudioDone(data: Record<string, unknown>): void {
    console.log('🎵 AI audio response completed');
    
    // Mark that we're done receiving audio chunks
    setTimeout(() => {
      this.isPlayingAudio = false;
      this.emit('audio.output.finished');
      console.log('✅ AI response playback finished');
    }, 500); // Small delay to let final chunks play
    
    this.emit('response.audio.done', data);
  }

  // Process audio delta and queue for playback
  private async processAudioDelta(base64Audio: string): Promise<void> {
    try {
      // Decode base64 audio data
      const audioData = this.base64ToArrayBuffer(base64Audio);
      this.audioQueue.push(audioData);

      // Start playback if not already playing
      if (!this.isPlayingAudio) {
        await this.startAudioPlayback();
      }

    } catch (error) {
      console.error('❌ Failed to process audio delta:', error);
    }
  }

  // Start audio playback from queue
  private async startAudioPlayback(): Promise<void> {
    if (this.isPlayingAudio || this.audioQueue.length === 0) {
      return;
    }

    try {
      console.log('🔊 Starting audio playback...');
      this.isPlayingAudio = true;
      this.emit('audio.output.started');

      // Initialize AudioContext if needed
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }

      // Resume AudioContext if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Process all queued audio chunks
      await this.playQueuedAudio();

    } catch (error) {
      console.error('❌ Failed to start audio playback:', error);
    } finally {
      this.isPlayingAudio = false;
      this.emit('audio.output.finished');
      console.log('✅ Audio playback finished');
    }
  }

  // Play all queued audio chunks
  private async playQueuedAudio(): Promise<void> {
    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift();
      if (audioData && this.audioContext) {
        await this.playAudioBuffer(audioData);
      }
    }
  }

  // Play a single audio buffer (PCM16 data from OpenAI)
  private async playAudioBuffer(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        resolve();
        return;
      }

      try {
        // Convert PCM16 ArrayBuffer to Float32Array for Web Audio API
        const pcm16Array = new Int16Array(audioData);
        const float32Array = new Float32Array(pcm16Array.length);
        
        // Convert PCM16 to Float32 (-1 to 1 range)
        for (let i = 0; i < pcm16Array.length; i++) {
          float32Array[i] = pcm16Array[i] / 32768.0;
        }
        
        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000); // Mono, 24kHz
        audioBuffer.getChannelData(0).set(float32Array);
        
        // Play the buffer
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        source.onended = () => resolve();
        source.start();
        
      } catch (error) {
        console.error('❌ PCM16 audio playback error:', error);
        resolve(); // Continue with next audio chunk
      }
    });
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Check if audio is currently playing
  isAudioPlaying(): boolean {
    return this.isPlayingAudio;
  }

  // Stop audio playback
  stopAudioPlayback(): void {
    console.log('🔇 Stopping audio playback...');
    this.audioQueue = [];
    this.isPlayingAudio = false;
    
    if (this.audioContext) {
      this.audioContext.suspend();
    }
    
    this.emit('audio.output.finished');
  }

  // Clean up audio resources (enhanced)
  private cleanup(): void {
    // Stop audio input
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // No MediaRecorder to clean up - using AudioWorklet/ScriptProcessor
    this.isRecording = false;

    // Clean up audio output
    this.stopAudioPlayback();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const openaiRealtime = new OpenAIRealtimeService();
export type { RealtimeSession, RealtimeUsage, RealtimeLimits };
