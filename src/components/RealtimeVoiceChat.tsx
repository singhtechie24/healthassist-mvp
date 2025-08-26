import { useState, useEffect, useCallback } from 'react';
import { openaiRealtime } from '../services/openaiRealtime';
import type { RealtimeSession } from '../services/openaiRealtime';

interface RealtimeVoiceChatProps {
  disabled?: boolean;
  onError?: (error: string) => void;
}

export default function RealtimeVoiceChat({ disabled = false, onError }: RealtimeVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [usageStats, setUsageStats] = useState(openaiRealtime.getUsageStats());
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update usage stats
  const updateUsage = useCallback(() => {
    setUsageStats(openaiRealtime.getUsageStats());
    setSession(openaiRealtime.getCurrentSession());
  }, []);

  // Event handlers
  useEffect(() => {
    const handleConnectionOpen = () => {
      console.log('🎉 Voice chat connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      setLastError(null); // Clear any lingering errors when successfully connected
      updateUsage();
    };

    const handleConnectionClose = () => {
      console.log('👋 Voice chat disconnected');
      setIsConnected(false);
      setIsRecording(false);
      setIsPlaying(false);
      setConnectionStatus('disconnected');
      updateUsage();
    };

    const handleSessionCreated = () => {
      console.log('🎯 Voice session created');
      setLastError(null); // Clear any errors when session is successfully created
      setConnectionStatus('connected'); // Ensure connection status is correct
      updateUsage();
    };

    const handleAudioInputStarted = () => {
      console.log('🎙️ Voice input started');
      setIsRecording(true);
    };

    const handleAudioInputStopped = () => {
      console.log('🔇 Voice input stopped');
      setIsRecording(false);
    };

    const handleAudioOutputStarted = () => {
      console.log('🔊 Voice output started');
      setIsPlaying(true);
    };

    const handleAudioOutputFinished = () => {
      console.log('✅ Voice output finished');
      setIsPlaying(false);
    };

    const handleError = (error: unknown) => {
      console.error('❌ Voice chat error:', error);
      let errorMessage = 'Unknown error occurred';
      
      // Handle browser limitation specifically
      if (typeof error === 'object' && error && 'type' in error && error.type === 'browser_limitation') {
        const limitationError = error as unknown as { message: string; details: string; solution: string };
        errorMessage = `${limitationError.message}: ${limitationError.details}`;
      } else {
        errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      }
      
      setLastError(errorMessage);
      setConnectionStatus('error');
      if (onError) {
        onError(errorMessage);
      }
    };

    const handleConnectionError = (error: unknown) => {
      console.error('❌ Voice connection error:', error);
      setIsConnected(false);
      setIsRecording(false);
      setIsPlaying(false);
      handleError(error);
    };

    // Set up event listeners
    openaiRealtime.on('connection.open', handleConnectionOpen);
    openaiRealtime.on('connection.close', handleConnectionClose);
    openaiRealtime.on('connection.error', handleConnectionError);
    openaiRealtime.on('session.created', handleSessionCreated);
    openaiRealtime.on('audio.input.started', handleAudioInputStarted);
    openaiRealtime.on('audio.input.stopped', handleAudioInputStopped);
    openaiRealtime.on('audio.output.started', handleAudioOutputStarted);
    openaiRealtime.on('audio.output.finished', handleAudioOutputFinished);
    openaiRealtime.on('error', handleError);

    // Cleanup on unmount
    return () => {
      openaiRealtime.off('connection.open', handleConnectionOpen);
      openaiRealtime.off('connection.close', handleConnectionClose);
      openaiRealtime.off('connection.error', handleConnectionError);
      openaiRealtime.off('session.created', handleSessionCreated);
      openaiRealtime.off('audio.input.started', handleAudioInputStarted);
      openaiRealtime.off('audio.input.stopped', handleAudioInputStopped);
      openaiRealtime.off('audio.output.started', handleAudioOutputStarted);
      openaiRealtime.off('audio.output.finished', handleAudioOutputFinished);
      openaiRealtime.off('error', handleError);
    };
  }, [onError, updateUsage]);

  // Timer to update current time for live duration calculation
  useEffect(() => {
    if (session && session.status === 'connected') {
      const timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [session]);

  // Handle connect/disconnect
  const handleToggleConnection = async () => {
    // Check if we're actually connected (either connectionStatus or have active session)
    const isActuallyConnected = connectionStatus === 'connected' || session;
    
    if (isActuallyConnected) {
      await openaiRealtime.disconnect();
    } else {
      try {
        setConnectionStatus('connecting');
        setLastError(null);
        await openaiRealtime.connect();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
        setLastError(errorMessage);
        setConnectionStatus('error');
        if (onError) {
          onError(errorMessage);
        }
      }
    }
  };

  // Handle start/stop recording
  const handleToggleRecording = async () => {
    const isActuallyConnected = connectionStatus === 'connected' || session;
    if (!isActuallyConnected) return;

    try {
      if (isRecording) {
        await openaiRealtime.stopAudioInput();
        // Commit the audio buffer to signal end of user speech
        openaiRealtime.commitAudioBuffer();
      } else {
        await openaiRealtime.startAudioInput();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Audio error';
      setLastError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  // Get connection button text and style
  const getConnectionButtonProps = () => {
    // If we have an active session, we're definitely connected regardless of connectionStatus
    const isActuallyConnected = connectionStatus === 'connected' || session;
    
    if (connectionStatus === 'connecting') {
      return {
        text: 'Connecting...',
        className: 'bg-yellow-500 hover:bg-yellow-600 animate-pulse',
        disabled: true
      };
    } else if (isActuallyConnected) {
      return {
        text: 'Disconnect',
        className: 'bg-red-500 hover:bg-red-600',
        disabled: false
      };
    } else if (connectionStatus === 'error') {
      return {
        text: 'Retry Connection',
        className: 'bg-orange-500 hover:bg-orange-600',
        disabled: false
      };
    } else {
      return {
        text: 'Start Voice Chat',
        className: 'bg-green-500 hover:bg-green-600',
        disabled: false
      };
    }
  };

  const connectionButton = getConnectionButtonProps();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🎤 Real-time Voice Chat
        </h3>
        
        {/* Usage Stats */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          💬 {usageStats.conversationsRemaining}/{usageStats.maxConversations} remaining
        </div>
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          (connectionStatus === 'connected' || session) ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
          connectionStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            (connectionStatus === 'connected' || session) ? 'bg-green-500 animate-pulse' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-ping' :
            connectionStatus === 'error' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          {(connectionStatus === 'connected' || session) ? 'Connected' :
           connectionStatus === 'connecting' ? 'Connecting...' :
           connectionStatus === 'error' ? 'Connection Error' :
           'Disconnected'}
        </div>
      </div>

      {/* Error Display - only show if actually not connected or in error state */}
      {lastError && (connectionStatus === 'error' || connectionStatus === 'disconnected') && !session && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Voice Chat Connection Error
              </h4>
              <p className="text-red-700 dark:text-red-300 text-sm mb-3">
                {lastError}
              </p>
              <div className="bg-red-100 dark:bg-red-800/30 p-3 rounded-md">
                <p className="text-red-800 dark:text-red-200 text-sm font-medium mb-1">
                  🔧 Troubleshooting:
                </p>
                <ul className="text-red-700 dark:text-red-300 text-sm space-y-1">
                  <li>• Ensure the proxy server is running on port 3001</li>
                  <li>• Check your OpenAI API key configuration</li>
                  <li>• Verify microphone permissions are granted</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Info */}
      {session && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-center justify-between">
              <span>📊 Session: {session.id.slice(0, 8)}...</span>
              <span>⏱️ Duration: {Math.floor(session.status === 'connected' ? (currentTime - session.startTime.getTime()) / 1000 : session.duration)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="space-y-3">
        {/* Connection Button */}
        <button
          onClick={handleToggleConnection}
          disabled={disabled || connectionButton.disabled}
          className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-white font-medium transition-all duration-200 ${connectionButton.className} ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
          }`}
        >
          {connectionButton.text}
        </button>

        {/* Recording Button */}
        {(connectionStatus === 'connected' || session) && (
          <button
            onClick={handleToggleRecording}
            disabled={disabled || isPlaying}
            className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } ${disabled || isPlaying ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            <div className="flex items-center space-x-2">
              {isRecording ? (
                <>
                  <div className="w-3 h-3 bg-white rounded-sm" />
                  <span>Stop Speaking</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  <span>Start Speaking</span>
                </>
              )}
            </div>
          </button>
        )}

        {/* AI Speaking Indicator */}
        {isPlaying && (
          <div className="w-full flex items-center justify-center px-4 py-3 bg-purple-100 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center space-x-2 text-purple-800 dark:text-purple-200">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-sm font-medium">🤖 AI is speaking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isConnected && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            💡 <strong>How it works:</strong> Click "Start Voice Chat" to connect, then speak naturally with your AI health assistant. The AI will respond in real-time with voice!
          </p>
        </div>
      )}

      {isConnected && !isRecording && !isPlaying && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-green-700 dark:text-green-300 text-sm">
            ✨ <strong>Ready to chat!</strong> Click "Start Speaking" and ask about your health. The AI will respond immediately.
          </p>
        </div>
      )}
    </div>
  );
}
