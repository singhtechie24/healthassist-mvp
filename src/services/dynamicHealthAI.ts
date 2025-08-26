// Dynamic Health Intelligence System - 2025 Advanced AI Health Coach
import type { UserProfile } from './healthAssessment';
import type { Message } from '../types/conversation';
import { DynamicKnowledge } from './dynamicKnowledge';
import { EmotionalIntelligence, type EmotionalContext } from './emotionalIntelligence';
import { ResponseNaturalizer } from './responseNaturalizer';
import { SituationalAdaptation, type SituationalContext, type AdaptiveResponse } from './situationalAdaptation';

export interface HealthContext {
  intent: string;
  urgency: 'low' | 'medium' | 'high';
  domain: string[];
  personalizedFactors: string[];
  needsAssessment: boolean;
  confidence: number;
}

export interface IntelligentResponse {
  shouldIntervene: boolean;
  response?: string;
  reasoning?: string;
  followUpQuestions?: string[];
  systemPromptEnhancement?: string;
  emotionalTone?: string;
  adaptationDetails?: string;
}

export class DynamicHealthAI {
  
  /**
   * Phase 1: Core Intelligence Engine
   * Uses meta-prompting to let AI analyze and reason about health contexts
   */
  static async analyzeHealthContext(
    userMessage: string,
    conversationHistory: Message[] = [],
    userProfile: UserProfile = {}
  ): Promise<HealthContext> {
    
    const analysisPrompt = this.createContextAnalysisPrompt(userMessage, conversationHistory, userProfile);
    
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
          max_tokens: 150, // Cost optimization: Keep analysis concise
          temperature: 0.3 // Lower temperature for consistent analysis
        })
      });

      const data = await response.json();
      return this.parseContextAnalysis(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Context analysis failed:', error);
      // Fallback to basic analysis
      return this.fallbackContextAnalysis(userMessage);
    }
  }

    /**
   * Check if query is simple enough that standard AI is sufficient
   */
  private static isSimpleQuery(message: string, context: HealthContext): boolean {
    // Simple factual questions
    const simplePatterns = [
      /^(what is|what are|how much|how many|when should)/i,
      /^(is it (safe|normal|healthy) to)/i,
      /^(can i|should i|do i need to)/i
    ];
    
    return simplePatterns.some(pattern => pattern.test(message)) &&
           context.confidence > 0.8 &&
           context.urgency === 'low' &&
           !context.needsAssessment;
  }

  /**
   * Assess if complex AI processing is needed based on multiple factors
   */
  private static assessComplexityNeed(
    message: string, 
    context: HealthContext, 
    userProfile: UserProfile, 
    conversationHistory: Message[]
  ): number {
    let complexityScore = 0;
    
    // Message complexity factors (0-30 points)
    if (message.length > 50) complexityScore += 10;
    if (message.split(' ').length > 15) complexityScore += 10;
    if (message.includes('because') || message.includes('however') || message.includes('but')) complexityScore += 10;
    
    // Health context factors (0-40 points)
    if (context.urgency === 'high') complexityScore += 20;
    else if (context.urgency === 'medium') complexityScore += 10;
    
    if (context.needsAssessment) complexityScore += 15;
    if (context.confidence < 0.7) complexityScore += 15;
    
    // User profile complexity (0-20 points)
    let profileComplexity = 0;
    if (userProfile.age) profileComplexity++;
    if (userProfile.goals && userProfile.goals.length > 0) profileComplexity++;
    complexityScore += profileComplexity * 5;
    
    // Conversation context (0-20 points)
    if (conversationHistory.length > 3) complexityScore += 10;
    if (conversationHistory.some(msg => msg.text.includes('stress') || msg.text.includes('anxiety'))) complexityScore += 10;
    
    return Math.min(complexityScore, 100); // Cap at 100
  }

  /**
   * Meta-prompt for intelligent context analysis
   */
private static createContextAnalysisPrompt(
    userMessage: string, 
    history: Message[], 
    profile: UserProfile
  ): string {
    return `As a health intelligence analyzer, analyze this user's message and provide a structured assessment:

USER MESSAGE: "${userMessage}"

CONVERSATION CONTEXT: ${history.length > 0 ? 'Previous discussion about ' + this.summarizeHistory(history) : 'First interaction'}

USER PROFILE: ${this.summarizeProfile(profile)}

ANALYZE AND RESPOND IN THIS EXACT JSON FORMAT:
{
  "intent": "primary user intention (weight_loss, recipe_request, symptom_inquiry, fitness_planning, etc)",
  "urgency": "low|medium|high",
  "domain": ["specific health areas involved"],
  "personalizedFactors": ["relevant personalization opportunities"],
  "needsAssessment": true/false,
  "confidence": 0.0-1.0
}

Consider:
- What is the user REALLY asking for?
- What context or information is missing?
- How urgent is this health concern?
- What personalization factors matter most?
- Does this need deeper assessment or can it be answered directly?

Respond ONLY with the JSON, no explanation.`;
  }

  /**
   * Generate intelligent response with full emotional and situational adaptation
   */
  static async generateIntelligentResponse(
    userMessage: string,
    context: HealthContext,
    userProfile: UserProfile = {},
    conversationHistory: Message[] = []
  ): Promise<IntelligentResponse> {
    
    // Quick safety check for emergencies (hard-coded safety net)
    if (context.urgency === 'high' || this.detectEmergency(userMessage)) {
      return {
        shouldIntervene: false, // Let system prompt handle emergencies
        reasoning: 'Emergency detected - delegating to system prompt safety protocols'
      };
    }

    // Enhanced efficiency checks - avoid complex processing for simple cases
    if (this.isSimpleQuery(userMessage, context)) {
      return {
        shouldIntervene: false,
        reasoning: 'Simple query - standard AI sufficient for optimal response'
      };
    }

    // Smart complexity assessment - only use full pipeline when truly beneficial
    const complexityScore = this.assessComplexityNeed(userMessage, context, userProfile, conversationHistory);
    
    if (complexityScore < 40) {
      return {
        shouldIntervene: false,
        reasoning: `Low complexity score (${complexityScore}) - standard AI recommended`
      };
    }

    console.log(`🧠 Dynamic AI activated - complexity score: ${complexityScore}`);

    // OPTIMIZED INTELLIGENCE PIPELINE - Parallel processing for efficiency
    
    try {
      // Parallel execution of analysis (when complexity justifies it)
      const [emotionalContext, situationalContext] = await Promise.all([
        // Step 1: Emotional Intelligence Analysis (only for emotional/mental health queries)
        context.intent?.includes('emotional') || context.intent?.includes('mental') 
          ? EmotionalIntelligence.analyzeEmotionalContext(userMessage, conversationHistory, userProfile)
          : Promise.resolve(null),
        
        // Step 2: Situational Adaptation Analysis (for complex multi-factor cases)
        complexityScore > 60
          ? SituationalAdaptation.analyzeSituationalContext(userMessage, conversationHistory, userProfile, {} as EmotionalContext)
          : Promise.resolve(null)
      ]);

      // Generate adaptive strategy only if we have situational context
      let adaptiveStrategy = null;
      if (situationalContext && emotionalContext) {
        adaptiveStrategy = await SituationalAdaptation.generateAdaptiveStrategy(
          situationalContext,
          emotionalContext,
          userMessage,
          userProfile
        );
      }
      
      // Generate emotional response guidance only if needed
      let emotionalResponse = null;
      if (emotionalContext) {
        emotionalResponse = await EmotionalIntelligence.generateEmotionalResponse(
          emotionalContext,
          userMessage,
          userProfile
        );
      }

    // Step 5: Generate Initial Response
    let initialResponse: string;
    
    if (this.shouldUseDynamicKnowledge(context.intent)) {
      // Use Dynamic Knowledge for specific requests
      const knowledgeResponse = await DynamicKnowledge.getContextualKnowledge({
        topic: userMessage,
        userContext: userProfile,
        specificNeeds: context.personalizedFactors,
        constraints: []
      });
      initialResponse = knowledgeResponse.content;
    } else {
      // Generate contextual intelligent response (only if we have required contexts)
      if (situationalContext && adaptiveStrategy && emotionalContext) {
        const intelligentResponse = await this.createAdaptiveIntelligentResponse(
          userMessage, 
          context, 
          userProfile, 
          conversationHistory,
          situationalContext,
          adaptiveStrategy,
          emotionalContext
        );
        initialResponse = intelligentResponse.content;
      } else {
        // Fallback to simple response
        initialResponse = "I understand your question. Let me provide a helpful response.";
      }
    }

    // Step 6: Naturalize Response (Remove robotic formatting, add human warmth)
    const naturalizedResponse = emotionalContext && emotionalResponse 
      ? await ResponseNaturalizer.naturalizeResponse(
          initialResponse,
          emotionalContext,
          emotionalResponse,
          userMessage
        )
      : initialResponse;

    // Step 7: Create Enhanced System Prompt with Full Context
    const enhancedSystemPrompt = this.createFullyEnhancedSystemPrompt(
      context,
      userProfile,
      emotionalContext || {} as EmotionalContext,
      situationalContext || {} as SituationalContext,
      adaptiveStrategy || {} as AdaptiveResponse
    );

    return {
      shouldIntervene: true,
      response: naturalizedResponse,
      reasoning: `🧠 Multi-layer adaptation: Emotional(${emotionalContext?.userMood}→${emotionalContext?.emotionalNeed}), Situational(${situationalContext?.conversationStage}), Strategy(${adaptiveStrategy?.interactionStyle})`,
      systemPromptEnhancement: enhancedSystemPrompt,
      emotionalTone: emotionalResponse?.tone,
      adaptationDetails: `Communication: ${adaptiveStrategy?.communicationLevel}, Detail: ${adaptiveStrategy?.detailLevel}, Connection: ${adaptiveStrategy?.personalConnection}`
    };
    
    } catch (error) {
      console.error('Dynamic AI processing failed:', error);
      // Fallback to simple response
      return {
        shouldIntervene: false,
        reasoning: 'Dynamic AI processing failed - falling back to standard AI'
      };
    }
  }

  /**
   * Create adaptive intelligent response with full context awareness
   */
  private static async createAdaptiveIntelligentResponse(
    userMessage: string,
    context: HealthContext,
    userProfile: UserProfile,
    history: Message[],
    situationalContext: SituationalContext,
    adaptiveStrategy: AdaptiveResponse,
    emotionalContext: EmotionalContext
  ): Promise<{ content: string; reasoning: string }> {
    
    const contextualGuidance = SituationalAdaptation.generateContextualGuidance(
      situationalContext,
      adaptiveStrategy,
      emotionalContext
    );
    
    const adaptivePrompt = `You are an expert health coach with advanced emotional intelligence and situational awareness. Create a response that adapts perfectly to this user's specific context:

USER MESSAGE: "${userMessage}"
HEALTH CONTEXT: ${JSON.stringify(context, null, 2)}
USER PROFILE: ${this.summarizeProfile(userProfile)}
CONVERSATION HISTORY: ${this.summarizeHistory(history)}

${contextualGuidance}

EMOTIONAL STATE: User is ${emotionalContext.userMood} and needs ${emotionalContext.emotionalNeed}
- Respond with appropriate emotional energy
- Use ${adaptiveStrategy.interactionStyle} interaction style
- Provide ${adaptiveStrategy.detailLevel} level of detail
- Use ${adaptiveStrategy.communicationLevel} communication level

CREATE A RESPONSE THAT:
- Perfectly matches their emotional state and needs
- Adapts to their experience level and engagement style
- Provides appropriate level of detail for their situation
- Uses the right questioning approach for their context
- Builds the right type of personal connection
- Feels completely natural and human-like

Remember: You're not just providing information, you're connecting with this person as their trusted health coach who truly understands their unique situation.

RESPOND AS THE HEALTH COACH:`;

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
          messages: [{ role: 'user', content: adaptivePrompt }],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      return {
        content: aiResponse,
        reasoning: `Adaptive response generated with emotional context: ${emotionalContext.userMood}, situational: ${situationalContext.conversationStage}, strategy: ${adaptiveStrategy.interactionStyle}`
      };
    } catch (error) {
      console.error('Adaptive response generation failed:', error);
      return {
        content: "I understand your question. Let me provide a helpful response based on your situation.",
        reasoning: 'Fallback response due to API error'
      };
    }

    // Remove duplicate API call - this was causing issues
    // The method should return the response from the first API call above
  }

  /**
   * Create fully enhanced system prompt with all context layers
   */
  private static createFullyEnhancedSystemPrompt(
    healthContext: HealthContext,
    userProfile: UserProfile,
    emotionalContext: EmotionalContext,
    situationalContext: SituationalContext,
    adaptiveStrategy: AdaptiveResponse
  ): string {
    
    let enhancedPrompt = `You are HealthAssist, an emotionally intelligent health coach with advanced situational awareness.

CURRENT USER CONTEXT:
- Health Focus: ${healthContext.domain.join(', ')}
- Intent: ${healthContext.intent}
- Emotional State: ${emotionalContext.userMood} (needs ${emotionalContext.emotionalNeed})
- Experience Level: ${situationalContext.userExperience}
- Conversation Stage: ${situationalContext.conversationStage}
- Engagement Level: ${situationalContext.userEngagement}

ADAPTIVE STRATEGY:
- Communication Level: ${adaptiveStrategy.communicationLevel}
- Detail Level: ${adaptiveStrategy.detailLevel}
- Interaction Style: ${adaptiveStrategy.interactionStyle}
- Questioning Approach: ${adaptiveStrategy.questioningApproach}
- Personal Connection: ${adaptiveStrategy.personalConnection}

USER PROFILE CONTEXT:`;

    if (userProfile.dietaryType) enhancedPrompt += `\n- Dietary Preference: ${userProfile.dietaryType}`;
    if (userProfile.cookingSkill) enhancedPrompt += `\n- Cooking Skill: ${userProfile.cookingSkill}`;
    if (userProfile.budgetLevel) enhancedPrompt += `\n- Budget Level: ${userProfile.budgetLevel}`;
    if (userProfile.biggestChallenges && userProfile.biggestChallenges.length > 0) {
      enhancedPrompt += `\n- Main Challenges: ${userProfile.biggestChallenges.join(', ')}`;
    }

    enhancedPrompt += `

RESPONSE GUIDELINES:
- Match their emotional state with appropriate ${emotionalContext.userMood} energy
- Use ${adaptiveStrategy.communicationLevel} language appropriate for their experience level
- Provide ${adaptiveStrategy.detailLevel} responses that match their engagement style
- Ask questions using ${adaptiveStrategy.questioningApproach} approach
- Build ${adaptiveStrategy.personalConnection} through your interaction style
- Focus on ${adaptiveStrategy.interactionStyle} collaboration

PERSONALITY:
- Be genuinely caring and emotionally responsive
- Show authentic enthusiasm for their health journey
- Adapt your communication style to their preferences
- Remember their context and build on previous conversations
- Use natural, conversational language (avoid robotic formatting)
- Provide specific, actionable advice tailored to their situation

PRIORITY: Create responses that feel like talking to a real health coach who truly understands and cares about this specific person's unique situation and emotional state.`;

    return enhancedPrompt;
  }

  // Note: Removed unused methods _createIntelligentIntervention and _createEnhancedSystemPrompt
  // These can be restored from git history if needed in the future

  /**
   * Determine if we should use dynamic knowledge generation
   */
  private static shouldUseDynamicKnowledge(intent: string): boolean {
    const dynamicKnowledgeIntents = [
      'recipe_request',
      'meal_planning', 
      'nutrition_advice',
      'cooking_guidance',
      'food_recommendations'
    ];
    
    return dynamicKnowledgeIntents.some(dynamicIntent => 
      intent.toLowerCase().includes(dynamicIntent.replace('_', ' ')) ||
      intent.toLowerCase().includes(dynamicIntent)
    );
  }

  /**
   * Extract clean JSON from potentially messy AI response
   */
  private static extractJSON(text: string): string {
    try {
      // Remove markdown code blocks and common prefixes
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      cleanText = cleanText.replace(/^\*\*\*.*?\*\*\*\n?/gm, ''); // Remove *** markers
      cleanText = cleanText.trim();
      
      // Find JSON object boundaries
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        return cleanText.substring(jsonStart, jsonEnd);
      }
      
      // If no brackets found, return original (might be already clean JSON)
      return cleanText;
    } catch (error) {
      console.warn('JSON extraction failed, returning original text:', error);
      return text;
    }
  }

  /**
   * Utility functions
   */
  private static parseContextAnalysis(response: string): HealthContext {
    try {
      const cleanedResponse = this.extractJSON(response);
      const parsed = JSON.parse(cleanedResponse);
      return {
        intent: parsed.intent || 'general_health',
        urgency: parsed.urgency || 'low',
        domain: parsed.domain || ['general'],
        personalizedFactors: parsed.personalizedFactors || [],
        needsAssessment: parsed.needsAssessment || false,
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      console.error('Failed to parse context analysis:', error);
      return this.fallbackContextAnalysis(response);
    }
  }

  private static fallbackContextAnalysis(userMessage: string): HealthContext {
    const msg = userMessage.toLowerCase();
    return {
      intent: msg.includes('recipe') ? 'recipe_request' : 
              msg.includes('weight') ? 'weight_loss' : 'general_health',
      urgency: msg.includes('pain') || msg.includes('emergency') ? 'high' : 'low',
      domain: ['general'],
      personalizedFactors: [],
      needsAssessment: true,
      confidence: 0.3
    };
  }

  private static detectEmergency(message: string): boolean {
    const emergencyKeywords = [
      'chest pain', 'difficulty breathing', 'severe bleeding', 'heart attack',
      'stroke', 'suicide', 'self harm', 'emergency'
    ];
    const msg = message.toLowerCase();
    return emergencyKeywords.some(keyword => msg.includes(keyword));
  }

  private static summarizeHistory(history: Message[]): string {
    if (history.length === 0) return 'No previous conversation';
    const recentMessages = history.slice(-3);
    return recentMessages.map(m => `${m.sender}: ${m.text.substring(0, 50)}...`).join(' | ');
  }

  private static summarizeProfile(profile: UserProfile): string {
    const parts = [];
    if (profile.age) parts.push(`Age: ${profile.age}`);
    if (profile.dietaryType) parts.push(`Diet: ${profile.dietaryType}`);
    if (profile.cookingSkill) parts.push(`Cooking: ${profile.cookingSkill}`);
    if (profile.budgetLevel) parts.push(`Budget: ${profile.budgetLevel}`);
    return parts.length > 0 ? parts.join(', ') : 'No profile data';
  }
}
