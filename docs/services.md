# Services

This document covers public service classes and singletons.

## `ProgressTracking`

- Interfaces:
  - `MoodEntry`, `MedicineLog`, `Reminder`, `ProgressMetrics`, `ProgressVisualization`
- Methods:
  - `getProgressMetrics(userId: string): Promise<ProgressMetrics>`
  - `generateProgressVisualizations(userId: string, requestType?: string): Promise<ProgressVisualization[]>`

- Example:
```ts
import { ProgressTracking } from '@/services/progressTracking';

const metrics = await ProgressTracking.getProgressMetrics('user_123');
const charts = await ProgressTracking.generateProgressVisualizations('user_123', 'mood');
```

## `MessageReactions`

- Types: `MessageReaction`, `ReactionType`, `ReactionAnalytics`
- Constants: `REACTION_TYPES: ReactionType[]`
- Methods:
  - `createReaction(messageId, userId, reactionType, feedback?) => MessageReaction`
  - `analyzeMessageReactions(reactions) => ReactionAnalytics`
  - `getReactionInsights(reactions) => { mostLikedEmojis, mostDislikedEmojis, averageSatisfaction, improvementAreas }`
  - `generateImprovementSuggestions(analytics) => string[]`

- Example:
```ts
import { MessageReactions } from '@/services/messageReactions';

const r = MessageReactions.createReaction('msg1', 'userA', { emoji: '👍', name: 'helpful', sentiment: 'positive', category: 'helpfulness' });
const analytics = MessageReactions.analyzeMessageReactions([r]);
```

## `ConversationManager` and `conversationManager`

- Methods:
  - `generateTitle(firstMessage: string): string`
  - `createAPIContext(conversation: Conversation): { role, content }[]`
  - `addMessage(conversation: Conversation, message: Message): Conversation`
  - `createNewConversation(userId: string, firstMessage?: string): Conversation`
  - `estimateTokens(text: string): number`
  - `calculateContextCost(context): { tokens, estimatedCost }`
  - `addReaction(conversation, messageId, reactionType, userId, feedback?): Conversation`
  - `removeReaction(conversation, messageId, reactionId): Conversation`
  - `getConversationReactionInsights(conversation) => { averageSatisfaction, mostHelpfulMessages, improvementAreas }`

- Example:
```ts
import { conversationManager } from '@/services/conversationManager';

const conv = conversationManager.createNewConversation('userA', 'Help me eat healthier');
const withMessage = conversationManager.addMessage(conv, { id: 'm1', sender: 'user', text: 'Hi', timestamp: new Date() });
const context = conversationManager.createAPIContext(withMessage);
```

## `OpenAIRealtimeService` and `openaiRealtime`

- Methods:
  - `setUserId(userId: string | null): void`
  - `on(event: string, callback: (data?: unknown) => void): void`
  - `off(event: string, callback: (data?: unknown) => void): void`
  - `canStartConversation(): { allowed: boolean; reason?: string }`
  - `getUsageStats(): { conversationsUsed, conversationsRemaining, maxConversations, maxDurationSeconds, totalCostToday, currentSession, isConnected }`
  - `getCurrentSession(): RealtimeSession | null`
  - `isConnected(): boolean`
  - `connect(): Promise<void>`
  - `startAudioInput(): Promise<void>`
  - `commitAudioBuffer(): void`
  - `configureVAD(options: { silenceThreshold?: number; volumeThreshold?: number }): void`
  - `clearAudioBuffer(): void`
  - `createResponse(): void`
  - `isAudioRecording(): boolean`
  - `isAudioPlaying(): boolean`
  - `stopAudioPlayback(): void`

- Types: `RealtimeSession`, `RealtimeUsage`, `RealtimeLimits`

- Example:
```ts
import { openaiRealtime } from '@/services/openaiRealtime';

openaiRealtime.setUserId('userA');
await openaiRealtime.connect();
await openaiRealtime.startAudioInput();
// speak... then commit audio to trigger response
openaiRealtime.commitAudioBuffer();
```

## Other services

- Additional domain services exist under `src/services` (e.g., `healthAssessment`, `dynamicHealthAI`, `gnewsApi`, `usdaApi`). Prefer reading source to understand specialized methods; they follow similar patterns with typed interfaces and exported singletons where applicable.