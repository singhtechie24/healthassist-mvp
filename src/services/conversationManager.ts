// Smart conversation context management for cost optimization
import type { Conversation, Message } from '../types/conversation';
import { CONTEXT_LIMITS } from '../types/conversation';
import { MessageReactions, type MessageReaction, type ReactionType } from './messageReactions';

export class ConversationManager {
  private static instance: ConversationManager;
  
  static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  // Generate conversation title from first message
  generateTitle(firstMessage: string): string {
    const words = firstMessage.split(' ').slice(0, 6).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  }

  // Create optimized context for OpenAI API
  createAPIContext(conversation: Conversation): Array<{role: 'system' | 'user' | 'assistant', content: string}> {
    const context: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [];
    
    // System prompt (always included)
    context.push({
      role: 'system',
      content: `You are HealthAssist, an intelligent health assistant. Be empathetic, provide helpful health information, but always recommend consulting healthcare professionals for serious concerns. Keep responses concise and supportive.`
    });

    // Add conversation summary if exists (compressed old context)
    if (conversation.summary) {
      context.push({
        role: 'system',
        content: `Previous conversation context: ${conversation.summary}`
      });
    }

    // Add recent messages (last 10 for cost efficiency)
    const recentMessages = conversation.recentMessages.slice(-CONTEXT_LIMITS.MAX_RECENT_MESSAGES);
    
    recentMessages.forEach(message => {
      context.push({
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: message.text
      });
    });

    return context;
  }

  // Add message and manage context size
  addMessage(conversation: Conversation, message: Message): Conversation {
    const updatedConversation = { ...conversation };
    
    // Add to recent messages
    updatedConversation.recentMessages = [...conversation.recentMessages, message];
    updatedConversation.totalMessages = conversation.totalMessages + 1;
    updatedConversation.lastActive = new Date();

    // If we exceed the limit, summarize and trim
    if (updatedConversation.recentMessages.length > CONTEXT_LIMITS.SUMMARIZE_THRESHOLD) {
      updatedConversation.summary = this.summarizeOldMessages(
        conversation.summary,
        updatedConversation.recentMessages.slice(0, -CONTEXT_LIMITS.MAX_RECENT_MESSAGES)
      );
      
      // Keep only recent messages
      updatedConversation.recentMessages = updatedConversation.recentMessages.slice(-CONTEXT_LIMITS.MAX_RECENT_MESSAGES);
    }

    return updatedConversation;
  }

  // Simple message summarization (to keep costs low)
  private summarizeOldMessages(existingSummary: string | undefined, oldMessages: Message[]): string {
    if (oldMessages.length === 0) return existingSummary || '';
    
    const messageTexts = oldMessages.map(msg => 
      `${msg.sender}: ${msg.text.substring(0, 100)}`
    ).join('. ');
    
    const newSummary = `User discussed: ${messageTexts.substring(0, 200)}...`;
    
    if (existingSummary) {
      return `${existingSummary} | ${newSummary}`;
    }
    
    return newSummary;
  }

  // Create new conversation
  createNewConversation(_userId: string, firstMessage?: string): Conversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    return {
      id,
      title: firstMessage ? this.generateTitle(firstMessage) : 'New Conversation',
      recentMessages: [],
      totalMessages: 0,
      createdAt: now,
      lastActive: now,
      tokensUsed: 0
    };
  }

  // Estimate token usage (rough calculation)
  estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // Calculate API cost for context
  calculateContextCost(context: Array<{role: string, content: string}>): { tokens: number, estimatedCost: number } {
    const totalText = context.map(msg => msg.content).join(' ');
    const tokens = this.estimateTokens(totalText);
    
    // GPT-4o-mini pricing: ~$0.15/1M input tokens
    const estimatedCost = (tokens / 1000000) * 0.15;
    
    return { tokens, estimatedCost };
  }

  // Add reaction to a specific message
  addReaction(conversation: Conversation, messageId: string, reactionType: ReactionType, userId: string, feedback?: string): Conversation {
    const updatedConversation = { ...conversation };
    
    // Find the message in recent messages
    const messageIndex = updatedConversation.recentMessages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      const message = { ...updatedConversation.recentMessages[messageIndex] };
      
      // Initialize reactions array if not exists
      if (!message.reactions) {
        message.reactions = [];
      }
      
      // Create new reaction
      const newReaction = MessageReactions.createReaction(messageId, userId, reactionType, feedback);
      
      // Add reaction (remove existing reaction from same user with same emoji first)
      message.reactions = message.reactions.filter(
        r => !(r.userId === userId && r.reactionType.emoji === reactionType.emoji)
      );
      message.reactions.push(newReaction);
      
      // Update reaction summary
      const analytics = MessageReactions.analyzeMessageReactions(message.reactions);
      message.reactionSummary = {
        totalReactions: analytics.totalReactions,
        positiveCount: analytics.positiveCount,
        userSatisfaction: analytics.userSatisfaction
      };
      
      updatedConversation.recentMessages[messageIndex] = message;
    }
    
    return updatedConversation;
  }

  // Remove reaction from a specific message
  removeReaction(conversation: Conversation, messageId: string, reactionId: string): Conversation {
    const updatedConversation = { ...conversation };
    
    // Find the message in recent messages
    const messageIndex = updatedConversation.recentMessages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      const message = { ...updatedConversation.recentMessages[messageIndex] };
      
      if (message.reactions) {
        // Remove the specific reaction
        message.reactions = message.reactions.filter(r => r.id !== reactionId);
        
        // Update reaction summary
        if (message.reactions.length > 0) {
          const analytics = MessageReactions.analyzeMessageReactions(message.reactions);
          message.reactionSummary = {
            totalReactions: analytics.totalReactions,
            positiveCount: analytics.positiveCount,
            userSatisfaction: analytics.userSatisfaction
          };
        } else {
          message.reactionSummary = undefined;
        }
        
        updatedConversation.recentMessages[messageIndex] = message;
      }
    }
    
    return updatedConversation;
  }

  // Get reaction insights for AI learning
  getConversationReactionInsights(conversation: Conversation): {
    averageSatisfaction: number;
    mostHelpfulMessages: Message[];
    improvementAreas: string[];
  } {
    const messagesWithReactions = conversation.recentMessages.filter(msg => msg.reactions && msg.reactions.length > 0);
    
    if (messagesWithReactions.length === 0) {
      return {
        averageSatisfaction: 50,
        mostHelpfulMessages: [],
        improvementAreas: []
      };
    }

    // Calculate average satisfaction
    const satisfactionScores = messagesWithReactions
      .map(msg => msg.reactionSummary?.userSatisfaction || 50);
    const averageSatisfaction = satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length;

    // Find most helpful messages (high satisfaction)
    const mostHelpfulMessages = messagesWithReactions
      .filter(msg => (msg.reactionSummary?.userSatisfaction || 0) >= 80)
      .sort((a, b) => (b.reactionSummary?.userSatisfaction || 0) - (a.reactionSummary?.userSatisfaction || 0))
      .slice(0, 3);

    // Aggregate all reactions for improvement insights
    const allReactions: MessageReaction[] = [];
    messagesWithReactions.forEach(msg => {
      if (msg.reactions) {
        allReactions.push(...msg.reactions);
      }
    });

    const reactionInsights = MessageReactions.getReactionInsights(allReactions);

    return {
      averageSatisfaction,
      mostHelpfulMessages,
      improvementAreas: reactionInsights.improvementAreas
    };
  }
}

export const conversationManager = ConversationManager.getInstance();
