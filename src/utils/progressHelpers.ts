import { ProgressTracking, type ProgressVisualization } from '../services/progressTracking';

// Helper function to check if message should trigger progress
export const shouldTriggerProgress = (message: string, keywords: string[] = [
  'progress', 'how am i doing', 'my health', 'dashboard', 'statistics', 
  'mood', 'medicine', 'adherence', 'health score', 'trending'
]): boolean => {
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
};

// Helper function to generate progress message
export const generateProgressMessage = async (userId: string, requestType?: string): Promise<ProgressVisualization[]> => {
  try {
    return await ProgressTracking.generateProgressVisualizations(userId, requestType);
  } catch (error) {
    console.error('Error generating progress message:', error);
    return [];
  }
};

// Helper function to get progress insights for AI responses
export const getProgressInsightsForAI = async (userId: string): Promise<string> => {
  try {
    const metrics = await ProgressTracking.getProgressMetrics(userId);
    
    const insights = [
      `Current mood trend: ${metrics.moodTrend} (average: ${metrics.averageMood.toFixed(1)}/10)`,
      `Medicine adherence: ${metrics.medicineAdherence}% (${metrics.adherenceTrend})`,
      `Overall health score: ${metrics.healthScore}/100`,
      `Consecutive good mood days: ${metrics.moodStreakDays}`,
      `Consistent medication days: ${metrics.consistentDays}`
    ];

    return insights.join(', ');
  } catch (error) {
    console.error('Error getting progress insights:', error);
    return 'Unable to load progress insights at this time.';
  }
};


