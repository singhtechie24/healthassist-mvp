import { useState } from 'react';
import type { MemoryContext, HealthMemory } from '../services/contextualMemory';

interface MemoryIndicatorProps {
  memoryContext: MemoryContext;
  onMemoryInvalidate?: (memoryId: string, reason: string) => void;
}

export default function MemoryIndicator({ memoryContext, onMemoryInvalidate }: MemoryIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  const { relevantMemories, criticalMemories, contextSummary } = memoryContext;
  const totalMemories = relevantMemories.length + criticalMemories.length;

  if (totalMemories === 0) return null;

  const getMemoryIcon = (type: string) => {
    const icons: Record<string, string> = {
      health_condition: '🏥',
      medication: '💊',
      allergy: '⚠️',
      goal: '🎯',
      preference: '⭐',
      habit: '🔄',
      symptom: '🤒',
      measurement: '📊',
      appointment: '📅',
      lifestyle: '🌱'
    };
    return icons[type] || '📝';
  };

  const getImportanceColor = (importance: string) => {
    const colors: Record<string, string> = {
      critical: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
      high: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800',
      medium: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
      low: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-800'
    };
    return colors[importance] || colors.medium;
  };

  const renderMemory = (memory: HealthMemory) => {
    const isExpanded = expandedMemory === memory.id;
    
    return (
      <div 
        key={memory.id}
        className={`border rounded-lg p-3 ${getImportanceColor(memory.importance)}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2 flex-1">
            <span className="text-lg">{getMemoryIcon(memory.type)}</span>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium uppercase tracking-wide">
                  {memory.type.replace('_', ' ')}
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded">
                  {memory.importance}
                </span>
              </div>
              <p className="text-sm mt-1 font-medium">
                {memory.content}
              </p>
              {isExpanded && (
                <div className="mt-2 space-y-1 text-xs">
                  <p><strong>Context:</strong> {memory.context}</p>
                  <p><strong>Category:</strong> {memory.category}</p>
                  <p><strong>Created:</strong> {memory.createdAt.toLocaleDateString()}</p>
                  {memory.lastReferencedAt && (
                    <p><strong>Last used:</strong> {memory.lastReferencedAt.toLocaleDateString()}</p>
                  )}
                  <p><strong>References:</strong> {memory.referenceCount}</p>
                  {memory.keywords.length > 0 && (
                    <p><strong>Keywords:</strong> {memory.keywords.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setExpandedMemory(isExpanded ? null : memory.id)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
              title={isExpanded ? 'Show less' : 'Show more'}
            >
              {isExpanded ? '−' : '+'}
            </button>
            {onMemoryInvalidate && (
              <button
                onClick={() => {
                  const reason = prompt('Why is this information no longer accurate?');
                  if (reason) {
                    onMemoryInvalidate(memory.id, reason);
                  }
                }}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 p-1"
                title="Mark as incorrect"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 my-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🧠</span>
          <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200">
            Health Memory Active
          </h3>
          <span className="text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 px-2 py-1 rounded-full">
            {totalMemories} {totalMemories === 1 ? 'memory' : 'memories'}
          </span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 px-2 py-1 rounded hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Context Summary */}
      {contextSummary && (
        <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium text-purple-700 dark:text-purple-300">Context: </span>
            {contextSummary}
          </p>
        </div>
      )}

      {/* Critical Memories */}
      {criticalMemories.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center">
            <span className="mr-1">🚨</span>
            Critical Information
          </h4>
          <div className="grid gap-2">
            {criticalMemories.slice(0, showDetails ? criticalMemories.length : 2).map(renderMemory)}
          </div>
        </div>
      )}

      {/* Relevant Memories */}
      {relevantMemories.length > 0 && showDetails && (
        <div>
          <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center">
            <span className="mr-1">💡</span>
            Relevant Context
          </h4>
          <div className="grid gap-2">
            {relevantMemories.slice(0, 5).map(renderMemory)}
          </div>
        </div>
      )}

      {/* Memory Actions */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700 flex flex-wrap gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            The AI remembers this information to provide personalized care.
          </span>
        </div>
      )}
    </div>
  );
}


