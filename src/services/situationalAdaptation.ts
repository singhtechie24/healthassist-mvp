// Situational Adaptation Engine - Analyzes context and adapts responses dynamically
import type { Message } from '../types/conversation';
import type { UserProfile } from './healthAssessment';
import type { EmotionalContext } from './emotionalIntelligence';

export interface SituationalContext {
  conversationStage: 'introduction' | 'information_gathering' | 'problem_solving' | 'planning' | 'follow_up';
  userExperience: 'complete_beginner' | 'some_knowledge' | 'experienced' | 'expert';
  timeOfInteraction: 'first_visit' | 'return_visitor' | 'long_term_user';
  complexityLevel: 'simple' | 'moderate' | 'complex';
  userEngagement: 'highly_engaged' | 'moderately_engaged' | 'low_engagement';
  preferredStyle: 'step_by_step' | 'overview_first' | 'direct_answers' | 'exploratory';
}

export interface AdaptiveResponse {
  communicationLevel: 'beginner_friendly' | 'intermediate' | 'advanced';
  detailLevel: 'brief' | 'moderate' | 'comprehensive';
  interactionStyle: 'guiding' | 'collaborative' | 'informative' | 'supportive';
  questioningApproach: 'gentle_probing' | 'direct_inquiry' | 'exploratory' | 'validating';
  personalConnection: 'building_rapport' | 'maintaining_relationship' | 'deepening_trust';
}

export class SituationalAdaptation {
  
  /**
   * Analyze the full situational context dynamically
   */
  static async analyzeSituationalContext(
    userMessage: string,
    conversationHistory: Message[] = [],
    userProfile: UserProfile = {},
    emotionalContext: EmotionalContext
  ): Promise<SituationalContext> {
    
    const analysisPrompt = this.createSituationalAnalysisPrompt(
      userMessage, 
      conversationHistory, 
      userProfile, 
      emotionalContext
    );
    
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
          max_tokens: 120,
          temperature: 0.3
        })
      });

      const data = await response.json();
      return this.parseSituationalAnalysis(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Situational analysis failed:', error);
      return this.getFallbackSituationalContext(userMessage, conversationHistory, userProfile);
    }
  }

  /**
   * Generate adaptive response strategy
   */
  static async generateAdaptiveStrategy(
    situationalContext: SituationalContext,
    emotionalContext: EmotionalContext,
    userMessage: string,
    userProfile: UserProfile = {}
  ): Promise<AdaptiveResponse> {
    
    const strategyPrompt = this.createAdaptiveStrategyPrompt(
      situationalContext,
      emotionalContext,
      userMessage,
      userProfile
    );
    
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
          messages: [{ role: 'user', content: strategyPrompt }],
          max_tokens: 100,
          temperature: 0.4
        })
      });

      const data = await response.json();
      return this.parseAdaptiveStrategy(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Adaptive strategy generation failed:', error);
      return this.getFallbackAdaptiveStrategy(situationalContext, emotionalContext);
    }
  }

  /**
   * Create comprehensive situational analysis prompt
   */
  private static createSituationalAnalysisPrompt(
    userMessage: string,
    history: Message[],
    profile: UserProfile,
    emotionalContext: EmotionalContext
  ): string {
    return `Analyze the situational context of this health conversation:

USER MESSAGE: "${userMessage}"
CONVERSATION HISTORY: ${this.summarizeConversationHistory(history)}
USER PROFILE: ${this.summarizeUserProfile(profile)}
EMOTIONAL STATE: ${emotionalContext.userMood} (${emotionalContext.emotionalNeed})

ANALYZE AND RESPOND IN JSON FORMAT:
{
  "conversationStage": "introduction|information_gathering|problem_solving|planning|follow_up",
  "userExperience": "complete_beginner|some_knowledge|experienced|expert",
  "timeOfInteraction": "first_visit|return_visitor|long_term_user",
  "complexityLevel": "simple|moderate|complex",
  "userEngagement": "highly_engaged|moderately_engaged|low_engagement",
  "preferredStyle": "step_by_step|overview_first|direct_answers|exploratory"
}

Consider:
- What stage of the health conversation are we in?
- How much health knowledge does the user demonstrate?
- Is this their first interaction or are they returning?
- How complex is their request or situation?
- How engaged and active are they in the conversation?
- What communication style do they seem to prefer?

Respond ONLY with JSON.`;
  }

  /**
   * Create adaptive strategy prompt
   */
  private static createAdaptiveStrategyPrompt(
    situationalContext: SituationalContext,
    emotionalContext: EmotionalContext,
    userMessage: string,
    profile: UserProfile
  ): string {
    return `Based on this situational analysis, determine the best response strategy:

SITUATIONAL CONTEXT: ${JSON.stringify(situationalContext, null, 2)}
EMOTIONAL CONTEXT: ${JSON.stringify(emotionalContext, null, 2)}
USER MESSAGE: "${userMessage}"
USER PROFILE: ${this.summarizeUserProfile(profile)}

Determine the optimal response approach in JSON format:
{
  "communicationLevel": "beginner_friendly|intermediate|advanced",
  "detailLevel": "brief|moderate|comprehensive", 
  "interactionStyle": "guiding|collaborative|informative|supportive",
  "questioningApproach": "gentle_probing|direct_inquiry|exploratory|validating",
  "personalConnection": "building_rapport|maintaining_relationship|deepening_trust"
}

Consider their experience level, engagement, preferred style, and emotional needs.`;
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
   * Parse situational analysis response
   */
  private static parseSituationalAnalysis(response: string): SituationalContext {
    try {
      const cleanedResponse = this.extractJSON(response);
      const parsed = JSON.parse(cleanedResponse);
      return {
        conversationStage: parsed.conversationStage || 'information_gathering',
        userExperience: parsed.userExperience || 'some_knowledge',
        timeOfInteraction: parsed.timeOfInteraction || 'first_visit',
        complexityLevel: parsed.complexityLevel || 'moderate',
        userEngagement: parsed.userEngagement || 'moderately_engaged',
        preferredStyle: parsed.preferredStyle || 'step_by_step'
      };
    } catch (error) {
      console.error('Failed to parse situational analysis:', error);
      return this.getFallbackSituationalContext(response, [], {});
    }
  }

  /**
   * Parse adaptive strategy response
   */
  private static parseAdaptiveStrategy(response: string): AdaptiveResponse {
    try {
      const cleanedResponse = this.extractJSON(response);
      const parsed = JSON.parse(cleanedResponse);
      return {
        communicationLevel: parsed.communicationLevel || 'beginner_friendly',
        detailLevel: parsed.detailLevel || 'moderate',
        interactionStyle: parsed.interactionStyle || 'supportive',
        questioningApproach: parsed.questioningApproach || 'gentle_probing',
        personalConnection: parsed.personalConnection || 'building_rapport'
      };
    } catch (error) {
      console.error('Failed to parse adaptive strategy:', error);
      return this.getFallbackAdaptiveStrategy();
    }
  }

  /**
   * Fallback situational context
   */
  private static getFallbackSituationalContext(
    userMessage: string,
    history: Message[],
    profile: UserProfile
  ): SituationalContext {
    
    const msg = userMessage.toLowerCase();
    
    // Determine conversation stage
    let conversationStage: SituationalContext['conversationStage'] = 'information_gathering';
    if (history.length === 0) conversationStage = 'introduction';
    if (msg.includes('plan') || msg.includes('strategy')) conversationStage = 'planning';
    if (msg.includes('help') || msg.includes('problem')) conversationStage = 'problem_solving';
    
    // Determine user experience
    let userExperience: SituationalContext['userExperience'] = 'some_knowledge';
    if (msg.includes('new to') || msg.includes('beginner') || msg.includes('first time')) {
      userExperience = 'complete_beginner';
    }
    if (msg.includes('experienced') || msg.includes('advanced') || msg.includes('expert')) {
      userExperience = 'experienced';
    }
    
    // Determine engagement level
    let userEngagement: SituationalContext['userEngagement'] = 'moderately_engaged';
    if (msg.length > 100 || msg.includes('!') || msg.includes('excited')) {
      userEngagement = 'highly_engaged';
    }
    if (msg.length < 20) userEngagement = 'low_engagement';
    
    return {
      conversationStage,
      userExperience,
      timeOfInteraction: profile.conversationCount && profile.conversationCount > 1 ? 'return_visitor' : 'first_visit',
      complexityLevel: msg.includes('simple') ? 'simple' : msg.includes('complex') ? 'complex' : 'moderate',
      userEngagement,
      preferredStyle: msg.includes('quick') || msg.includes('brief') ? 'direct_answers' : 'step_by_step'
    };
  }

  /**
   * Fallback adaptive strategy
   */
  private static getFallbackAdaptiveStrategy(
    situationalContext?: SituationalContext,
    emotionalContext?: EmotionalContext
  ): AdaptiveResponse {
    
    if (!situationalContext || !emotionalContext) {
      return {
        communicationLevel: 'beginner_friendly',
        detailLevel: 'moderate',
        interactionStyle: 'supportive',
        questioningApproach: 'gentle_probing',
        personalConnection: 'building_rapport'
      };
    }

    // Adapt based on user experience
    let communicationLevel: AdaptiveResponse['communicationLevel'] = 'beginner_friendly';
    if (situationalContext.userExperience === 'experienced') communicationLevel = 'intermediate';
    if (situationalContext.userExperience === 'expert') communicationLevel = 'advanced';

    // Adapt based on engagement
    let detailLevel: AdaptiveResponse['detailLevel'] = 'moderate';
    if (situationalContext.userEngagement === 'highly_engaged') detailLevel = 'comprehensive';
    if (situationalContext.userEngagement === 'low_engagement') detailLevel = 'brief';

    // Adapt interaction style based on emotional context
    let interactionStyle: AdaptiveResponse['interactionStyle'] = 'supportive';
    if (emotionalContext.userMood === 'excited') interactionStyle = 'collaborative';
    if (emotionalContext.userMood === 'frustrated') interactionStyle = 'guiding';
    if (situationalContext.conversationStage === 'information_gathering') interactionStyle = 'informative';

    return {
      communicationLevel,
      detailLevel,
      interactionStyle,
      questioningApproach: emotionalContext.userMood === 'worried' ? 'gentle_probing' : 'direct_inquiry',
      personalConnection: situationalContext.timeOfInteraction === 'first_visit' ? 'building_rapport' : 'maintaining_relationship'
    };
  }

  /**
   * Generate contextual guidance for response generation
   */
  static generateContextualGuidance(
    situationalContext: SituationalContext,
    adaptiveStrategy: AdaptiveResponse,
    emotionalContext: EmotionalContext
  ): string {
    
    let guidance = 'CONTEXTUAL RESPONSE GUIDANCE:\n\n';
    
    // Communication level guidance
    guidance += `COMMUNICATION LEVEL: ${adaptiveStrategy.communicationLevel}\n`;
    if (adaptiveStrategy.communicationLevel === 'beginner_friendly') {
      guidance += '- Use simple, clear language\n- Explain health terms when needed\n- Be patient and encouraging\n';
    } else if (adaptiveStrategy.communicationLevel === 'advanced') {
      guidance += '- Use precise health terminology\n- Provide detailed scientific context\n- Respect their knowledge level\n';
    }
    
    // Detail level guidance
    guidance += `\nDETAIL LEVEL: ${adaptiveStrategy.detailLevel}\n`;
    if (adaptiveStrategy.detailLevel === 'brief') {
      guidance += '- Keep responses concise and focused\n- Provide essential information only\n- Offer to expand if they want more\n';
    } else if (adaptiveStrategy.detailLevel === 'comprehensive') {
      guidance += '- Provide thorough explanations\n- Include examples and context\n- Anticipate follow-up questions\n';
    }
    
    // Interaction style guidance
    guidance += `\nINTERACTION STYLE: ${adaptiveStrategy.interactionStyle}\n`;
    if (adaptiveStrategy.interactionStyle === 'guiding') {
      guidance += '- Take a leadership role\n- Provide clear direction\n- Offer step-by-step guidance\n';
    } else if (adaptiveStrategy.interactionStyle === 'collaborative') {
      guidance += '- Work together as partners\n- Ask for their input and preferences\n- Build on their ideas\n';
    }
    
    // Questioning approach guidance
    guidance += `\nQUESTIONING APPROACH: ${adaptiveStrategy.questioningApproach}\n`;
    if (adaptiveStrategy.questioningApproach === 'gentle_probing') {
      guidance += '- Ask questions sensitively\n- Allow time for reflection\n- Validate their responses\n';
    } else if (adaptiveStrategy.questioningApproach === 'direct_inquiry') {
      guidance += '- Ask clear, direct questions\n- Be efficient with information gathering\n- Focus on practical details\n';
    }
    
    // Personal connection guidance
    guidance += `\nPERSONAL CONNECTION: ${adaptiveStrategy.personalConnection}\n`;
    if (adaptiveStrategy.personalConnection === 'building_rapport') {
      guidance += '- Share appropriate encouragement\n- Show genuine interest\n- Create a welcoming atmosphere\n';
    } else if (adaptiveStrategy.personalConnection === 'deepening_trust') {
      guidance += '- Reference previous conversations\n- Show consistency in care\n- Demonstrate reliability\n';
    }
    
    // Emotional adaptation
    guidance += `\nEMOTIONAL ADAPTATION: ${emotionalContext.userMood} needing ${emotionalContext.emotionalNeed}\n`;
    guidance += '- Respond to their emotional state appropriately\n- Provide the specific type of support they need\n- Match their energy level while being helpful\n';
    
    return guidance;
  }

  /**
   * Utility functions
   */
  private static summarizeConversationHistory(history: Message[]): string {
    if (history.length === 0) return 'First interaction';
    
    const messageCount = history.length;
    const userMessages = history.filter(m => m.sender === 'user').length;
    const aiMessages = history.filter(m => m.sender === 'ai').length;
    
    return `${messageCount} total messages (${userMessages} user, ${aiMessages} AI)`;
  }

  private static summarizeUserProfile(profile: UserProfile): string {
    const parts = [];
    
    if (profile.conversationCount) parts.push(`${profile.conversationCount} previous conversations`);
    if (profile.dietaryType) parts.push(`Diet: ${profile.dietaryType}`);
    if (profile.cookingSkill) parts.push(`Cooking: ${profile.cookingSkill}`);
    if (profile.goals && profile.goals.length > 0) parts.push(`Goals: ${profile.goals.join(', ')}`);
    if (profile.biggestChallenges && profile.biggestChallenges.length > 0) {
      parts.push(`Challenges: ${profile.biggestChallenges.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : 'New user with limited profile';
  }
}
