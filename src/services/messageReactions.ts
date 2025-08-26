export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  reactionType: ReactionType;
  timestamp: Date;
  feedback?: string; // Optional text feedback
}

export interface ReactionType {
  emoji: string;
  name: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  category: 'helpfulness' | 'accuracy' | 'emotion' | 'engagement';
}

export interface ReactionAnalytics {
  messageId: string;
  totalReactions: number;
  positiveCount: number;
  negativeCount: number;
  helpfulnessScore: number; // 0-100
  accuracyScore: number; // 0-100
  userSatisfaction: number; // 0-100
  commonFeedback: string[];
}

export class MessageReactions {
  // Predefined reaction types for health conversations
  static readonly REACTION_TYPES: ReactionType[] = [
    // Helpfulness reactions
    { emoji: '👍', name: 'helpful', sentiment: 'positive', category: 'helpfulness' },
    { emoji: '👎', name: 'not_helpful', sentiment: 'negative', category: 'helpfulness' },
    { emoji: '💡', name: 'insightful', sentiment: 'positive', category: 'helpfulness' },
    
    // Accuracy reactions
    { emoji: '✅', name: 'accurate', sentiment: 'positive', category: 'accuracy' },
    { emoji: '❌', name: 'inaccurate', sentiment: 'negative', category: 'accuracy' },
    { emoji: '🤔', name: 'unclear', sentiment: 'neutral', category: 'accuracy' },
    
    // Emotional reactions
    { emoji: '😊', name: 'encouraging', sentiment: 'positive', category: 'emotion' },
    { emoji: '😟', name: 'concerning', sentiment: 'negative', category: 'emotion' },
    { emoji: '😌', name: 'reassuring', sentiment: 'positive', category: 'emotion' },
    
    // Engagement reactions
    { emoji: '🎯', name: 'relevant', sentiment: 'positive', category: 'engagement' },
    { emoji: '📚', name: 'informative', sentiment: 'positive', category: 'engagement' },
    { emoji: '⚡', name: 'motivating', sentiment: 'positive', category: 'engagement' }
  ];

  /**
   * Creates a new reaction for a message
   */
  static createReaction(
    messageId: string, 
    userId: string, 
    reactionType: ReactionType, 
    feedback?: string
  ): MessageReaction {
    return {
      id: `${messageId}_${userId}_${Date.now()}`,
      messageId,
      userId,
      reactionType,
      timestamp: new Date(),
      feedback
    };
  }

  /**
   * Analyzes reactions for a specific message
   */
  static analyzeMessageReactions(reactions: MessageReaction[]): ReactionAnalytics {
    if (reactions.length === 0) {
      return {
        messageId: '',
        totalReactions: 0,
        positiveCount: 0,
        negativeCount: 0,
        helpfulnessScore: 50,
        accuracyScore: 50,
        userSatisfaction: 50,
        commonFeedback: []
      };
    }

    const messageId = reactions[0].messageId;
    const totalReactions = reactions.length;
    
    // Count sentiment
    const positiveCount = reactions.filter(r => r.reactionType.sentiment === 'positive').length;
    const negativeCount = reactions.filter(r => r.reactionType.sentiment === 'negative').length;
    
    // Calculate category scores
    const helpfulnessReactions = reactions.filter(r => r.reactionType.category === 'helpfulness');
    const accuracyReactions = reactions.filter(r => r.reactionType.category === 'accuracy');
    
    const helpfulnessScore = this.calculateCategoryScore(helpfulnessReactions);
    const accuracyScore = this.calculateCategoryScore(accuracyReactions);
    
    // Overall satisfaction (weighted average)
    const userSatisfaction = Math.round(
      (positiveCount / totalReactions) * 100
    );

    // Extract common feedback
    const feedbackTexts = reactions
      .filter(r => r.feedback)
      .map(r => r.feedback!)
      .filter(text => text.length > 10); // Filter out short feedback

    return {
      messageId,
      totalReactions,
      positiveCount,
      negativeCount,
      helpfulnessScore,
      accuracyScore,
      userSatisfaction,
      commonFeedback: feedbackTexts
    };
  }

  /**
   * Calculates score for a specific reaction category
   */
  private static calculateCategoryScore(reactions: MessageReaction[]): number {
    if (reactions.length === 0) return 50; // Neutral default

    const positiveReactions = reactions.filter(r => r.reactionType.sentiment === 'positive').length;
    const negativeReactions = reactions.filter(r => r.reactionType.sentiment === 'negative').length;
    
    if (positiveReactions === 0 && negativeReactions === 0) return 50;
    
    return Math.round((positiveReactions / (positiveReactions + negativeReactions)) * 100);
  }

  /**
   * Gets reaction statistics for AI learning
   */
  static getReactionInsights(reactions: MessageReaction[]): {
    mostLikedEmojis: string[];
    mostDislikedEmojis: string[];
    averageSatisfaction: number;
    improvementAreas: string[];
  } {
    if (reactions.length === 0) {
      return {
        mostLikedEmojis: [],
        mostDislikedEmojis: [],
        averageSatisfaction: 50,
        improvementAreas: []
      };
    }

    // Count emoji usage
    const emojiCounts = new Map<string, { count: number; sentiment: string }>();
    
    reactions.forEach(reaction => {
      const emoji = reaction.reactionType.emoji;
      const current = emojiCounts.get(emoji) || { count: 0, sentiment: reaction.reactionType.sentiment };
      emojiCounts.set(emoji, { count: current.count + 1, sentiment: reaction.reactionType.sentiment });
    });

    // Get most used emojis by sentiment
    const mostLikedEmojis = Array.from(emojiCounts.entries())
      .filter(([_, data]) => data.sentiment === 'positive')
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([emoji]) => emoji);

    const mostDislikedEmojis = Array.from(emojiCounts.entries())
      .filter(([_, data]) => data.sentiment === 'negative')
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([emoji]) => emoji);

    // Calculate average satisfaction
    const positiveReactions = reactions.filter(r => r.reactionType.sentiment === 'positive').length;
    const averageSatisfaction = Math.round((positiveReactions / reactions.length) * 100);

    // Identify improvement areas
    const improvementAreas: string[] = [];
    
    const negativeCategories = reactions
      .filter(r => r.reactionType.sentiment === 'negative')
      .map(r => r.reactionType.category);
    
    const categoryFrequency = new Map<string, number>();
    negativeCategories.forEach(category => {
      categoryFrequency.set(category, (categoryFrequency.get(category) || 0) + 1);
    });

    // Add areas that have significant negative feedback
    Array.from(categoryFrequency.entries())
      .filter(([_, count]) => count >= 2) // At least 2 negative reactions
      .forEach(([category]) => {
        switch (category) {
          case 'helpfulness':
            improvementAreas.push('Make responses more actionable and practical');
            break;
          case 'accuracy':
            improvementAreas.push('Improve factual accuracy and evidence-based advice');
            break;
          case 'emotion':
            improvementAreas.push('Enhance emotional intelligence and empathy');
            break;
          case 'engagement':
            improvementAreas.push('Increase relevance and personalization');
            break;
        }
      });

    return {
      mostLikedEmojis,
      mostDislikedEmojis,
      averageSatisfaction,
      improvementAreas
    };
  }

  /**
   * Generates AI improvement suggestions based on reaction data
   */
  static generateImprovementSuggestions(analytics: ReactionAnalytics): string[] {
    const suggestions: string[] = [];

    // Helpfulness suggestions
    if (analytics.helpfulnessScore < 70) {
      suggestions.push("Provide more specific, actionable advice");
      suggestions.push("Include step-by-step instructions when appropriate");
      suggestions.push("Ask follow-up questions to better understand user needs");
    }

    // Accuracy suggestions
    if (analytics.accuracyScore < 70) {
      suggestions.push("Cite reliable health sources when making claims");
      suggestions.push("Be more precise with medical terminology");
      suggestions.push("Clearly distinguish between general advice and medical guidance");
    }

    // Satisfaction suggestions
    if (analytics.userSatisfaction < 60) {
      suggestions.push("Show more empathy and emotional understanding");
      suggestions.push("Personalize responses based on user's health profile");
      suggestions.push("Use encouraging and motivational language");
    }

    // Engagement suggestions
    if (analytics.totalReactions < 3) {
      suggestions.push("Make responses more interactive and engaging");
      suggestions.push("Include relevant health tips or interesting facts");
      suggestions.push("End responses with thoughtful questions");
    }

    return suggestions;
  }
}


