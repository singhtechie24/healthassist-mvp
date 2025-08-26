// Adaptive Learning System - Continuous Improvement for Health AI
import type { UserProfile } from './healthAssessment';
import type { Message } from '../types/conversation';

export interface UserInteraction {
  userId: string;
  messageId: string;
  userMessage: string;
  aiResponse: string;
  userFeedback?: 'helpful' | 'not_helpful' | 'neutral';
  contextFactors: string[];
  timestamp: Date;
  responseTime: number;
  followUpQuestion?: boolean;
}

export interface LearningInsights {
  effectivePatterns: string[];
  userPreferences: UserProfile;
  improvementAreas: string[];
  successfulStrategies: string[];
}

export class AdaptiveLearning {
  
  /**
   * Learn from user interactions to improve responses
   */
  static trackInteraction(
    userId: string,
    userMessage: string,
    aiResponse: string,
    contextFactors: string[] = []
  ): UserInteraction {
    
    const interaction: UserInteraction = {
      userId,
      messageId: Date.now().toString(),
      userMessage,
      aiResponse,
      contextFactors,
      timestamp: new Date(),
      responseTime: 0, // Will be updated when response is complete
      followUpQuestion: this.detectFollowUpQuestion(userMessage)
    };
    
    // Store interaction for learning (in real app, this would go to a database)
    this.storeInteraction(interaction);
    
    return interaction;
  }

  /**
   * Adapt user profile based on conversation patterns
   */
  static adaptUserProfile(
    currentProfile: UserProfile,
    conversationHistory: Message[],
    userId: string
  ): UserProfile {
    
    const adaptedProfile = { ...currentProfile };
    
    // Learn dietary preferences from conversation
    const dietaryClues = this.extractDietaryPreferences(conversationHistory);
    if (dietaryClues.length > 0) {
      adaptedProfile.dietaryType = dietaryClues[0] as any;
    }
    
    // Learn cooking skill from questions asked
    const cookingSkillClues = this.extractCookingSkill(conversationHistory);
    if (cookingSkillClues) {
      adaptedProfile.cookingSkill = cookingSkillClues;
    }
    
    // Learn budget constraints from conversation
    const budgetClues = this.extractBudgetLevel(conversationHistory);
    if (budgetClues) {
      adaptedProfile.budgetLevel = budgetClues;
    }
    
    // Learn health goals from conversation
    const goalClues = this.extractHealthGoals(conversationHistory);
    if (goalClues.length > 0) {
      adaptedProfile.goals = [...(adaptedProfile.goals || []), ...goalClues];
    }
    
    // Learn challenges from conversation
    const challengeClues = this.extractChallenges(conversationHistory);
    if (challengeClues.length > 0) {
      adaptedProfile.biggestChallenges = [...(adaptedProfile.biggestChallenges || []), ...challengeClues];
    }
    
    // Update conversation count for personalization
    adaptedProfile.conversationCount = (adaptedProfile.conversationCount || 0) + 1;
    adaptedProfile.lastAssessment = new Date();
    
    console.log('🧠 Adapted User Profile:', adaptedProfile);
    return adaptedProfile;
  }

  /**
   * Generate personalized communication style based on user interactions
   */
  static generatePersonalizedCommunicationStyle(
    userId: string,
    conversationHistory: Message[]
  ): string {
    
    const userMessages = conversationHistory.filter(m => m.sender === 'user');
    const recentMessages = userMessages.slice(-5); // Last 5 user messages
    
    let communicationStyle = '';
    
    // Analyze communication patterns
    const avgMessageLength = recentMessages.reduce((sum, msg) => sum + msg.text.length, 0) / recentMessages.length;
    
    if (avgMessageLength < 50) {
      communicationStyle += 'User prefers brief, concise responses. Keep answers focused and to-the-point. ';
    } else if (avgMessageLength > 150) {
      communicationStyle += 'User appreciates detailed explanations. Provide comprehensive information and context. ';
    }
    
    // Check for emoji usage
    const usesEmojis = recentMessages.some(msg => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(msg.text));
    if (usesEmojis) {
      communicationStyle += 'User appreciates emojis and expressive communication. Use emojis naturally in responses. ';
    } else {
      communicationStyle += 'User prefers professional, text-based communication. Minimize emoji usage. ';
    }
    
    // Check for question patterns
    const asksFollowUps = recentMessages.filter(msg => msg.text.includes('?')).length > recentMessages.length * 0.3;
    if (asksFollowUps) {
      communicationStyle += 'User is naturally curious and asks follow-up questions. Encourage deeper exploration. ';
    }
    
    return communicationStyle || 'Use standard professional health communication style.';
  }

  /**
   * Extract insights from conversation patterns
   */
  static extractConversationInsights(
    conversationHistory: Message[]
  ): LearningInsights {
    
    const userMessages = conversationHistory.filter(m => m.sender === 'user');
    const aiMessages = conversationHistory.filter(m => m.sender === 'ai');
    
    return {
      effectivePatterns: this.identifyEffectivePatterns(userMessages, aiMessages),
      userPreferences: this.inferUserPreferences(userMessages),
      improvementAreas: this.identifyImprovementAreas(userMessages, aiMessages),
      successfulStrategies: this.identifySuccessfulStrategies(userMessages, aiMessages)
    };
  }

  /**
   * Private helper methods
   */
  private static detectFollowUpQuestion(message: string): boolean {
    const followUpIndicators = [
      'what about', 'how about', 'can you also', 'and what', 'also', 'another question',
      'follow up', 'additionally', 'furthermore', 'also tell me'
    ];
    
    const lowerMessage = message.toLowerCase();
    return followUpIndicators.some(indicator => lowerMessage.includes(indicator));
  }

  private static storeInteraction(interaction: UserInteraction): void {
    // In a real application, this would store to a database
    // For now, we'll just log it
    console.log('📊 Learning Interaction:', {
      userId: interaction.userId,
      timestamp: interaction.timestamp,
      contextFactors: interaction.contextFactors,
      followUpQuestion: interaction.followUpQuestion
    });
  }

  private static extractDietaryPreferences(messages: Message[]): string[] {
    const preferences: string[] = [];
    const text = messages.map(m => m.text.toLowerCase()).join(' ');
    
    if (text.includes('vegetarian') || text.includes('veggie')) preferences.push('vegetarian');
    if (text.includes('vegan')) preferences.push('vegan');
    if (text.includes('keto') || text.includes('ketogenic')) preferences.push('keto');
    if (text.includes('paleo')) preferences.push('paleo');
    if (text.includes('mediterranean')) preferences.push('mediterranean');
    if (text.includes('meat') && !text.includes('no meat')) preferences.push('non-vegetarian');
    
    return preferences;
  }

  private static extractCookingSkill(messages: Message[]): 'beginner' | 'intermediate' | 'advanced' | null {
    const text = messages.map(m => m.text.toLowerCase()).join(' ');
    
    if (text.includes('beginner') || text.includes('new to cooking') || text.includes('simple recipes')) {
      return 'beginner';
    }
    if (text.includes('advanced') || text.includes('experienced cook') || text.includes('chef')) {
      return 'advanced';
    }
    if (text.includes('some cooking') || text.includes('moderate') || text.includes('intermediate')) {
      return 'intermediate';
    }
    
    return null;
  }

  private static extractBudgetLevel(messages: Message[]): 'low' | 'medium' | 'high' | null {
    const text = messages.map(m => m.text.toLowerCase()).join(' ');
    
    if (text.includes('budget') || text.includes('cheap') || text.includes('affordable') || text.includes('tight budget')) {
      return 'low';
    }
    if (text.includes('expensive') || text.includes('premium') || text.includes('high quality')) {
      return 'high';
    }
    
    return null;
  }

  private static extractHealthGoals(messages: Message[]): string[] {
    const goals: string[] = [];
    const text = messages.map(m => m.text.toLowerCase()).join(' ');
    
    if (text.includes('lose weight') || text.includes('weight loss')) goals.push('weight_loss');
    if (text.includes('gain weight') || text.includes('bulk up')) goals.push('weight_gain');
    if (text.includes('muscle') || text.includes('strength')) goals.push('muscle_gain');
    if (text.includes('energy') || text.includes('more energy')) goals.push('increased_energy');
    if (text.includes('sleep') || text.includes('better sleep')) goals.push('improved_sleep');
    if (text.includes('stress') || text.includes('anxiety')) goals.push('stress_management');
    
    return goals;
  }

  private static extractChallenges(messages: Message[]): string[] {
    const challenges: string[] = [];
    const text = messages.map(m => m.text.toLowerCase()).join(' ');
    
    if (text.includes('no time') || text.includes('busy')) challenges.push('time_constraints');
    if (text.includes('expensive') || text.includes('cost')) challenges.push('budget_constraints');
    if (text.includes('don\'t like') || text.includes('hate')) challenges.push('food_preferences');
    if (text.includes('motivation') || text.includes('give up')) challenges.push('motivation');
    if (text.includes('confusing') || text.includes('don\'t know')) challenges.push('lack_of_knowledge');
    
    return challenges;
  }

  private static identifyEffectivePatterns(userMessages: Message[], aiMessages: Message[]): string[] {
    // Analyze which AI responses led to positive user engagement
    const patterns: string[] = [];
    
    // Simple heuristic: if user asks follow-up questions, the response was engaging
    for (let i = 0; i < aiMessages.length - 1; i++) {
      const nextUserMessage = userMessages[i + 1];
      if (nextUserMessage && nextUserMessage.text.includes('?')) {
        patterns.push('encouraging_follow_up_questions');
      }
    }
    
    return patterns;
  }

  private static inferUserPreferences(userMessages: Message[]): UserProfile {
    // Basic inference from conversation patterns
    return {
      conversationCount: userMessages.length,
      lastAssessment: new Date()
    };
  }

  private static identifyImprovementAreas(userMessages: Message[], aiMessages: Message[]): string[] {
    const areas: string[] = [];
    
    // If user repeats similar questions, AI responses might not be clear enough
    const userQuestions = userMessages.filter(m => m.text.includes('?'));
    if (userQuestions.length > userMessages.length * 0.7) {
      areas.push('provide_more_comprehensive_initial_responses');
    }
    
    return areas;
  }

  private static identifySuccessfulStrategies(userMessages: Message[], aiMessages: Message[]): string[] {
    const strategies: string[] = [];
    
    // If conversation is sustained, strategies are working
    if (userMessages.length > 3) {
      strategies.push('maintaining_user_engagement');
    }
    
    return strategies;
  }
}


