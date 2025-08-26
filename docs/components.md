# Components

This document lists publicly exported React components, their props, and usage examples.

## `ProgressVisualization`

- Props:
  - `visualization: ProgressVisualization` from `services/progressTracking`
  - `isExpanded?: boolean` default `false`
  - `onToggleExpand?: () => void`

- Usage:
```tsx
import ProgressVisualization from '@/components/ProgressVisualization';
import type { ProgressVisualization as ProgressViz } from '@/services/progressTracking';

const viz: ProgressViz = {
  type: 'health_score',
  title: '🏆 Overall Health Score',
  data: { score: 72, breakdown: { mood: 65, adherence: 80, consistency: 60 }, goals: { active: 2, completed: 5 } },
  insights: ['Good adherence rate of 80%. Keep improving!'],
  actionable_tips: ['Track daily mood', 'Use a pill organizer']
};

export function Example() {
  return <ProgressVisualization visualization={viz} isExpanded onToggleExpand={() => {}} />;
}
```

## `ProgressChatWidget`

- Props:
  - `userId: string`
  - `onProgressUpdate?: (metrics: import('../services/progressTracking').ProgressMetrics) => void`

- Behavior: Fetches visualizations on mount with `ProgressTracking.generateProgressVisualizations(userId)` and renders a stack of `ProgressVisualization` cards. Includes quick action filters and refresh.

- Usage:
```tsx
import ProgressChatWidget from '@/components/ProgressChatWidget';

export function ProgressSection({ userId }: { userId: string }) {
  return (
    <div className="my-6">
      <ProgressChatWidget userId={userId} onProgressUpdate={(m) => console.log(m)} />
    </div>
  );
}
```

## `MessageReactions`

- Props:
  - `message: Message`
  - `onReactionAdd: (messageId: string, reactionType: ReactionType, feedback?: string) => void`
  - `onReactionRemove: (messageId: string, reactionId: string) => void`
  - `currentUserId: string`

- Notes: Renders quick emoji reactions and an optional feedback modal. Only displays for AI messages (`message.sender === 'ai'`).

- Usage:
```tsx
import MessageReactions from '@/components/MessageReactions';
import type { ReactionType } from '@/services/messageReactions';

function onAdd(messageId: string, reactionType: ReactionType, feedback?: string) {
  // persist reaction
}

function onRemove(messageId: string, reactionId: string) {
  // remove reaction
}

<MessageReactions message={msg} onReactionAdd={onAdd} onReactionRemove={onRemove} currentUserId={userId} />
```

## `RealtimeVoiceChat`

- Props:
  - `disabled?: boolean`
  - `onError?: (error: string) => void`
  - `onSessionStart?: () => void`
  - `userId?: string | null`

- Behavior: Manages a real-time audio chat session over WebSocket using `openaiRealtime` service. Displays connection, recording, and playback states and emits errors via `onError`.

- Usage:
```tsx
import RealtimeVoiceChat from '@/components/RealtimeVoiceChat';

export function VoicePage({ userId }: { userId: string }) {
  return <RealtimeVoiceChat userId={userId} onError={(e) => console.error(e)} onSessionStart={() => console.log('started')} />;
}
```

## Other components

- `Layout`, `MemoryIndicator`, `ConversationSidebar`, `GoogleMap` are app-internal UI components; they have no custom public API beyond their props and are used within pages. Consult source for advanced usage.