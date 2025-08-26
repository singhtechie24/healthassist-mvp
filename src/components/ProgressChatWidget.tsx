import { useState, useEffect, useCallback } from 'react';
import { ProgressTracking, type ProgressVisualization as ProgressVizType } from '../services/progressTracking';
import ProgressVisualization from './ProgressVisualization';

interface ProgressChatWidgetProps {
  userId: string;
  triggerKeywords?: string[];
  onProgressUpdate?: (metrics: import('../services/progressTracking').ProgressMetrics) => void;
}

export default function ProgressChatWidget({ 
  userId, 
  onProgressUpdate 
}: Omit<ProgressChatWidgetProps, 'triggerKeywords'>) {
  const [isLoading, setIsLoading] = useState(false);
  const [visualizations, setVisualizations] = useState<ProgressVizType[]>([]);
  const [expandedViz, setExpandedViz] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadProgressData = useCallback(async (requestType?: string) => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      console.log('Loading progress data for user:', userId, 'requestType:', requestType);
      const progressViz = await ProgressTracking.generateProgressVisualizations(userId, requestType);
      console.log('Generated visualizations:', progressViz.length, 'items');
      setVisualizations(progressViz);
      setLastUpdated(new Date());
      
      // Also get metrics for callback
      if (onProgressUpdate) {
        const metrics = await ProgressTracking.getProgressMetrics(userId);
        onProgressUpdate(metrics);
      }
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, onProgressUpdate]);

  // Auto-load progress data when component mounts
  useEffect(() => {
    if (userId) {
      loadProgressData();
    }
  }, [userId, loadProgressData]);

  // Note: Helper functions available for future expansion if needed

  const handleToggleExpand = (vizType: string) => {
    setExpandedViz(expandedViz === vizType ? null : vizType);
  };

  const renderProgressSummary = () => {
    console.log('Rendering progress summary with', visualizations.length, 'visualizations');
    if (visualizations.length === 0) return null;

    return (
      <div className="space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            📊 Your Health Progress
          </h3>
          {lastUpdated && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {visualizations.map((viz, index) => (
          <ProgressVisualization
            key={index}
            visualization={viz}
            isExpanded={expandedViz === viz.type}
            onToggleExpand={() => handleToggleExpand(viz.type)}
          />
        ))}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => loadProgressData('mood')}
            className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            📈 Mood Trends
          </button>
          <button
            onClick={() => loadProgressData('medicine')}
            className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
          >
            💊 Medicine Adherence
          </button>
          <button
            onClick={() => loadProgressData('health')}
            className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
          >
            🏆 Health Score
          </button>
          <button
            onClick={() => loadProgressData()}
            className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            🔄 Refresh All
          </button>
        </div>
      </div>
    );
  };

  const renderLoadingState = () => (
    <div className="my-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <span className="text-blue-700 dark:text-blue-300">Analyzing your health progress...</span>
      </div>
    </div>
  );

  // Note: Handlers are available internally for the component

  console.log('ProgressChatWidget render state:', { isLoading, visualizationsCount: visualizations.length, userId });

  // If loading, show loading state
  if (isLoading) {
    return renderLoadingState();
  }

  // If we have visualizations, show them
  if (visualizations.length > 0) {
    return renderProgressSummary();
  }

  // Return null if no progress data to show
  return null;
}

// Export types only
export type { ProgressChatWidgetProps };
