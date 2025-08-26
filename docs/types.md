# Types

## `Message`

- Fields:
  - `id: string`
  - `text: string`
  - `sender: 'user' | 'ai'`
  - `timestamp: Date`
  - `reactions?: MessageReaction[]`
  - `reactionSummary?: { totalReactions: number; positiveCount: number; userSatisfaction: number }`

## `Conversation`

- Fields:
  - `id: string`
  - `title: string`
  - `summary?: string`
  - `recentMessages: Message[]`
  - `totalMessages: number`
  - `createdAt: Date`
  - `lastActive: Date`
  - `tokensUsed: number`

## `ConversationMeta`

- Fields:
  - `userId: string`
  - `conversationCount: number`
  - `totalTokensUsed: number`
  - `lastCleanup: Date`

## `CONTEXT_LIMITS`

- Constant with limits for context management used by `ConversationManager`:
  - `MAX_RECENT_MESSAGES: 10`
  - `MAX_CONTEXT_TOKENS: 1500`
  - `SUMMARIZE_THRESHOLD: 15`
  - `MAX_CONVERSATIONS: 20`
  - `AUTO_DELETE_DAYS: 30`

- Example:
```ts
import { CONTEXT_LIMITS } from '@/types/conversation';

if (conversation.recentMessages.length > CONTEXT_LIMITS.SUMMARIZE_THRESHOLD) {
  // summarize
}
```