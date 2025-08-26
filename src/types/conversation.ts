// Optimized conversation types for cost-efficient chat
import type { MessageReaction } from '../services/messageReactions';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  reactions?: MessageReaction[];     // User reactions to this message
  reactionSummary?: {                // Quick analytics cache
    totalReactions: number;
    positiveCount: number;
    userSatisfaction: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  summary?: string;              // Compressed old messages for context
  recentMessages: Message[];     // Last 10 messages only
  totalMessages: number;         // Track actual count
  createdAt: Date;
  lastActive: Date;
  tokensUsed: number;           // Track API usage
}

export interface ConversationMeta {
  userId: string;
  conversationCount: number;
  totalTokensUsed: number;
  lastCleanup: Date;
}

// Context management settings
export const CONTEXT_LIMITS = {
  MAX_RECENT_MESSAGES: 10,      // Only send last 10 to API
  MAX_CONTEXT_TOKENS: 1500,     // Token budget per request
  SUMMARIZE_THRESHOLD: 15,      // Summarize when > 15 messages
  MAX_CONVERSATIONS: 20,        // Storage limit per user
  AUTO_DELETE_DAYS: 30          // Cleanup old conversations
} as const;
