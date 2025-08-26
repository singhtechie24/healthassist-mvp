# Utils

## `shouldTriggerProgress(message: string, keywords?: string[]): boolean`

- Purpose: Returns `true` if `message` contains any of the provided keywords (case-insensitive). Defaults include: progress, dashboard, mood, medicine, etc.

- Example:
```ts
import { shouldTriggerProgress } from '@/utils/progressHelpers';

shouldTriggerProgress('Show me my health progress'); // true
shouldTriggerProgress('Tell me a joke'); // false
```

## `generateProgressMessage(userId: string, requestType?: string): Promise<ProgressVisualization[]>`

- Purpose: Fetches `ProgressVisualization[]` for the given `userId`. Optional `requestType` narrows to 'mood' | 'medicine' | 'health'.

- Example:
```ts
import { generateProgressMessage } from '@/utils/progressHelpers';

const items = await generateProgressMessage('user_123', 'mood');
```

## `getProgressInsightsForAI(userId: string): Promise<string>`

- Purpose: Produces a concise insights string for inclusion in AI responses.

- Example:
```ts
import { getProgressInsightsForAI } from '@/utils/progressHelpers';

const insights = await getProgressInsightsForAI('user_123');
// "Current mood trend: improving (average: 6.7/10), Medicine adherence: 82% (stable), ..."
```