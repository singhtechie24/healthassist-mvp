// Dynamic Emotional Intelligence System - Analyzes situations and adapts responses
import type { Message } from '../types/conversation';
import type { UserProfile } from './healthAssessment';

export interface EmotionalContext {
  userMood: 'excited' | 'worried' | 'frustrated' | 'hopeful' | 'overwhelmed' | 'neutral';
  urgency: 'low' | 'medium' | 'high';
  emotionalNeed: 'encouragement' | 'validation' | 'guidance' | 'empathy' | 'excitement' | 'reassurance';
  situationType: 'first_time' | 'struggling' | 'making_progress' | 'seeking_help' | 'frustrated_repeat';
  communicationStyle: 'brief' | 'detailed' | 'casual' | 'professional';
  // Additional properties for quick analysis
  primaryEmotion?: string;
  intensity?: number;
  supportNeeded?: boolean;
  triggers?: string[];
  responseStyle?: string;
}

export interface EmotionalResponse {
  tone: string;
  emotionalExpression: string;
  empathyLevel: 'low' | 'medium' | 'high';
  encouragementType: string;
  personalTouch: string;
}

export class EmotionalIntelligence {
  
  /**
   * Enhanced emotional analysis with smart filtering and efficiency
   */
  static async analyzeEmotionalContext(
    userMessage: string,
    conversationHistory: Message[] = [],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userProfile: UserProfile = {}
  ): Promise<EmotionalContext> {
    
    // Early detection for non-emotional queries to save processing
    if (!this.containsEmotionalIndicators(userMessage)) {
      console.log('🚀 Skipping emotional analysis - no emotional indicators detected');
      return this.createNeutralEmotionalContext();
    }

    // Quick emotional pattern detection first (cost-effective)
    const quickAnalysis = this.quickEmotionalAnalysis(userMessage, conversationHistory);
    
    // Use AI analysis only for complex or ambiguous cases
    if (quickAnalysis.confidence > 0.75) {
      console.log(`📊 Using quick emotional analysis (confidence: ${quickAnalysis.confidence})`);
      return quickAnalysis.context;
    }

    console.log('🧠 Performing deep emotional analysis');
    const analysisPrompt = this.createEnhancedEmotionalAnalysisPrompt(userMessage, conversationHistory);
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          max_tokens: 120, // Optimized for cost and accuracy
          temperature: 0.2 // Lower temperature for consistent emotional analysis
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseEmotionalAnalysis(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Emotional analysis failed:', error);
      // Fallback to quick analysis if available, otherwise neutral
      return quickAnalysis.confidence > 0.5 ? quickAnalysis.context : this.getFallbackEmotionalContext(userMessage);
    }
  }

  /**
   * Check if message contains emotional indicators
   */
  private static containsEmotionalIndicators(message: string): boolean {
    const emotionalKeywords = [
      // Positive emotions
      'happy', 'excited', 'grateful', 'proud', 'confident', 'motivated', 'optimistic',
      // Negative emotions  
      'sad', 'depressed', 'anxious', 'worried', 'stressed', 'frustrated', 'angry', 'upset',
      'overwhelmed', 'scared', 'nervous', 'disappointed', 'lonely', 'tired', 'exhausted',
      // Emotional expressions
      'feel', 'feeling', 'felt', 'emotion', 'mood', 'heart', 'mind',
      // Physical manifestations of emotion
      'crying', 'tears', 'shaking', 'racing heart', 'butterflies', 'stomach',
      // Emotional situations
      'loss', 'grief', 'relationship', 'family', 'work stress', 'pressure'
    ];
    
    const lowerMessage = message.toLowerCase();
    return emotionalKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Quick pattern-based emotional analysis
   */
  private static quickEmotionalAnalysis(
    message: string, 
    conversationHistory: Message[]
  ): { context: EmotionalContext; confidence: number } {
    const lowerMessage = message.toLowerCase();
    let primaryEmotion = 'neutral';
    let intensity = 0.5;
    let confidence = 0.6;
    
    // Anxiety/Stress patterns
    if (lowerMessage.includes('anxious') || lowerMessage.includes('worried') || lowerMessage.includes('stressed')) {
      primaryEmotion = 'anxious';
      intensity = lowerMessage.includes('very') || lowerMessage.includes('extremely') ? 0.8 : 0.6;
      confidence = 0.9;
    }
    // Depression/Sadness patterns
    else if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('down')) {
      primaryEmotion = 'sad';
      intensity = lowerMessage.includes('very') || lowerMessage.includes('really') ? 0.8 : 0.6;
      confidence = 0.85;
    }
    // Positive emotions
    else if (lowerMessage.includes('happy') || lowerMessage.includes('excited') || lowerMessage.includes('great')) {
      primaryEmotion = 'positive';
      intensity = 0.7;
      confidence = 0.8;
    }
    // Frustration/Anger
    else if (lowerMessage.includes('frustrated') || lowerMessage.includes('angry') || lowerMessage.includes('annoyed')) {
      primaryEmotion = 'frustrated';
      intensity = 0.7;
      confidence = 0.85;
    }
    
    // Adjust confidence based on conversation history
    if (conversationHistory.length > 0) {
      const recentEmotional = conversationHistory.slice(-2).some(msg => 
        this.containsEmotionalIndicators(msg.text)
      );
      if (recentEmotional) confidence += 0.1;
    }

    // Map primaryEmotion to userMood
    let userMood: EmotionalContext['userMood'] = 'neutral';
    if (primaryEmotion === 'anxious') userMood = 'worried';
    else if (primaryEmotion === 'sad') userMood = 'worried';
    else if (primaryEmotion === 'positive') userMood = 'excited';
    else if (primaryEmotion === 'frustrated') userMood = 'frustrated';

    return {
      context: {
        userMood,
        urgency: intensity > 0.7 ? 'high' : intensity > 0.5 ? 'medium' : 'low',
        emotionalNeed: intensity > 0.6 ? 'empathy' : 'guidance',
        situationType: 'seeking_help',
        communicationStyle: 'casual',
        primaryEmotion,
        intensity,
        supportNeeded: intensity > 0.6,
        triggers: this.identifyTriggers(message),
        responseStyle: intensity > 0.7 ? 'empathetic' : 'supportive'
      },
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Create neutral emotional context for non-emotional queries
   */
  private static createNeutralEmotionalContext(): EmotionalContext {
    return {
      userMood: 'neutral',
      urgency: 'low',
      emotionalNeed: 'guidance',
      situationType: 'seeking_help',
      communicationStyle: 'casual',
      primaryEmotion: 'neutral',
      intensity: 0.3,
      supportNeeded: false,
      triggers: [],
      responseStyle: 'informative'
    };
  }

  /**
   * Identify emotional triggers in the message
   */
  private static identifyTriggers(message: string): string[] {
    const triggers: string[] = [];
    const triggerPatterns = {
      'work': ['work', 'job', 'boss', 'deadline', 'meeting'],
      'health': ['pain', 'sick', 'illness', 'doctor', 'medical'],
      'relationships': ['relationship', 'partner', 'family', 'friend', 'breakup'],
      'finances': ['money', 'financial', 'debt', 'bills', 'expensive'],
      'academic': ['school', 'exam', 'test', 'study', 'grade']
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [trigger, keywords] of Object.entries(triggerPatterns)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        triggers.push(trigger);
      }
    }
    
    return triggers;
  }

  /**
   * Enhanced emotional analysis prompt
   */
  private static createEnhancedEmotionalAnalysisPrompt(
    userMessage: string,
    conversationHistory: Message[]
  ): string {
    const recentContext = conversationHistory.slice(-3)
      .map(msg => `${msg.sender}: ${msg.text}`)
      .join('\n');

    return `You are an expert emotional intelligence analyzer for a health AI assistant. Analyze the user's emotional state from their message.

🎯 FOCUS: Identify primary emotion, intensity, and support needs with high accuracy.

EMOTIONAL CATEGORIES:
- **anxious**: worry, stress, fear about future/health
- **sad**: depression, grief, loneliness, feeling down  
- **frustrated**: anger, annoyance, feeling stuck
- **positive**: happiness, excitement, gratitude, motivation
- **neutral**: calm, factual, no strong emotions
- **concerned**: mild worry about health/wellbeing

CONVERSATION CONTEXT:
${recentContext || 'First interaction'}

USER MESSAGE: "${userMessage}"

Analyze for:
1. Primary emotion and secondary emotions
2. Intensity level (0.1-1.0)
3. Whether user needs emotional support
4. Triggers causing the emotion
5. Best response style

Respond in JSON:
{
  "primaryEmotion": "string",
  "intensity": number,
  "supportNeeded": boolean,
  "triggers": ["array"],
  "responseStyle": "empathetic|supportive|encouraging|informative"
}`;
  }

  /**
   * Generate appropriate emotional response based on context
   */
  static async generateEmotionalResponse(
    context: EmotionalContext,
    userMessage: string,
    userProfile: UserProfile = {}
  ): Promise<EmotionalResponse> {
    
    const responsePrompt = this.createEmotionalResponsePrompt(context, userMessage, userProfile);
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: responsePrompt }],
          max_tokens: 150,
          temperature: 0.7 // Higher creativity for emotional expression
        })
      });

      const data = await response.json();
      return this.parseEmotionalResponse(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Emotional response generation failed:', error);
      return this.getFallbackEmotionalResponse(context);
    }
  }



  /**
   * Create prompt for emotional response generation
   */
  private static createEmotionalResponsePrompt(
    context: EmotionalContext,
    userMessage: string,
    profile: UserProfile
  ): string {
    return `Generate an appropriate emotional response for a health coach based on this analysis:

EMOTIONAL CONTEXT: ${JSON.stringify(context, null, 2)}
USER MESSAGE: "${userMessage}"
USER PROFILE: ${this.summarizeUserProfile(profile)}

Create an emotional response that feels natural and appropriate. Respond in JSON format:
{
  "tone": "warm and encouraging|empathetic and understanding|excited and motivational|gentle and reassuring|etc",
  "emotionalExpression": "specific emotional words/phrases to use naturally in conversation",
  "empathyLevel": "low|medium|high",
  "encouragementType": "motivational|supportive|realistic|celebratory|etc",
  "personalTouch": "how to make this feel personal and genuine"
}

Make it feel like a real health coach who genuinely cares, not an AI assistant.`;
  }

  /**
   * Parse emotional analysis response
   */
  private static parseEmotionalAnalysis(response: string): EmotionalContext {
    try {
      const parsed = JSON.parse(response);
      return {
        userMood: parsed.userMood || 'neutral',
        urgency: parsed.urgency || 'low',
        emotionalNeed: parsed.emotionalNeed || 'guidance',
        situationType: parsed.situationType || 'seeking_help',
        communicationStyle: parsed.communicationStyle || 'casual'
      };
    } catch (error) {
      console.error('Failed to parse emotional analysis:', error);
      return this.getFallbackEmotionalContext(response);
    }
  }

  /**
   * Parse emotional response
   */
  private static parseEmotionalResponse(response: string): EmotionalResponse {
    try {
      const parsed = JSON.parse(response);
      return {
        tone: parsed.tone || 'warm and encouraging',
        emotionalExpression: parsed.emotionalExpression || 'I\'m here to help!',
        empathyLevel: parsed.empathyLevel || 'medium',
        encouragementType: parsed.encouragementType || 'supportive',
        personalTouch: parsed.personalTouch || 'making this feel genuine'
      };
    } catch (error) {
      console.error('Failed to parse emotional response:', error);
      return this.getFallbackEmotionalResponse();
    }
  }

  /**
   * Fallback emotional context when analysis fails
   */
  private static getFallbackEmotionalContext(userMessage: string): EmotionalContext {
    const msg = userMessage.toLowerCase();
    
    // Simple heuristics for fallback
    let userMood: EmotionalContext['userMood'] = 'neutral';
    if (msg.includes('excited') || msg.includes('ready') || msg.includes('motivated')) userMood = 'excited';
    if (msg.includes('worried') || msg.includes('concerned') || msg.includes('scared')) userMood = 'worried';
    if (msg.includes('frustrated') || msg.includes('tried everything') || msg.includes('nothing works')) userMood = 'frustrated';
    if (msg.includes('hope') || msg.includes('want to') || msg.includes('trying to')) userMood = 'hopeful';
    if (msg.includes('overwhelming') || msg.includes('too much') || msg.includes('confusing')) userMood = 'overwhelmed';

    return {
      userMood,
      urgency: msg.includes('urgent') || msg.includes('emergency') ? 'high' : 'low',
      emotionalNeed: userMood === 'frustrated' ? 'empathy' : userMood === 'excited' ? 'excitement' : 'encouragement',
      situationType: msg.includes('first time') || msg.includes('new to') ? 'first_time' : 'seeking_help',
      communicationStyle: msg.length < 50 ? 'brief' : 'detailed'
    };
  }

  /**
   * Fallback emotional response when generation fails
   */
  private static getFallbackEmotionalResponse(context?: EmotionalContext): EmotionalResponse {
    if (!context) {
      return {
        tone: 'warm and encouraging',
        emotionalExpression: 'I\'m genuinely excited to help you with this!',
        empathyLevel: 'medium',
        encouragementType: 'supportive',
        personalTouch: 'showing authentic care'
      };
    }

    // Adapt based on user mood
    switch (context.userMood) {
      case 'excited':
        return {
          tone: 'enthusiastic and motivational',
          emotionalExpression: 'I love your energy! This is going to be amazing!',
          empathyLevel: 'medium',
          encouragementType: 'celebratory',
          personalTouch: 'matching their excitement'
        };
      case 'worried':
        return {
          tone: 'gentle and reassuring',
          emotionalExpression: 'I totally understand your concerns, and that\'s completely normal',
          empathyLevel: 'high',
          encouragementType: 'reassuring',
          personalTouch: 'acknowledging their feelings'
        };
      case 'frustrated':
        return {
          tone: 'empathetic and understanding',
          emotionalExpression: 'I hear you, and I can imagine how frustrating this must be',
          empathyLevel: 'high',
          encouragementType: 'validating',
          personalTouch: 'showing deep understanding'
        };
      default:
        return {
          tone: 'warm and encouraging',
          emotionalExpression: 'I\'m here to support you every step of the way',
          empathyLevel: 'medium',
          encouragementType: 'supportive',
          personalTouch: 'being genuinely helpful'
        };
    }
  }

  /**
   * Utility functions
   */

  private static summarizeUserProfile(profile: UserProfile): string {
    const parts = [];
    if (profile.conversationCount) parts.push(`${profile.conversationCount} previous conversations`);
    if (profile.goals && profile.goals.length > 0) parts.push(`Goals: ${profile.goals.join(', ')}`);
    if (profile.biggestChallenges && profile.biggestChallenges.length > 0) parts.push(`Challenges: ${profile.biggestChallenges.join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : 'New user';
  }
}
