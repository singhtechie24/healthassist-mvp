import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import type { ProgressVisualization as ProgressVizType } from '../services/progressTracking';

interface ProgressVisualizationProps {
  visualization: ProgressVizType;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function ProgressVisualization({ 
  visualization, 
  isExpanded = false, 
  onToggleExpand 
}: ProgressVisualizationProps) {
  const [showDetails, setShowDetails] = useState(false);

  const renderVisualization = () => {
    switch (visualization.type) {
      case 'mood_chart':
        return renderMoodChart();
      case 'medicine_adherence':
        return renderAdherenceChart();
      case 'health_score':
        return renderHealthScore();
      case 'weekly_summary':
        return renderWeeklySummary();
      default:
        return renderDefaultView();
    }
  };

  const renderMoodChart = () => {
    const { chartData, average, trend, streakDays } = visualization.data;
    
    return (
      <div className="space-y-4">
        {/* Mood Chart */}
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                stroke="#6b7280"
              />
              <YAxis 
                domain={[1, 10]}
                fontSize={12}
                stroke="#6b7280"
              />
              <Tooltip 
                formatter={(value: any, name: any) => [`${value}/10`, 'Mood']}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="mood" 
                stroke="#059669" 
                strokeWidth={3}
                dot={{ fill: '#059669', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mood Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {average.toFixed(1)}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">Average Mood</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {getTrendEmoji(trend)} {trend}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">Trend</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {streakDays}
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400">Good Days Streak</div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdherenceChart = () => {
    const { adherenceRate, trend, consistentDays, weeklyPattern } = visualization.data;
    
    return (
      <div className="space-y-4">
        {/* Weekly Pattern Bar Chart */}
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyPattern}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="day" 
                fontSize={12}
                stroke="#6b7280"
              />
              <YAxis 
                domain={[0, 100]}
                fontSize={12}
                stroke="#6b7280"
              />
              <Tooltip 
                formatter={(value: any) => [`${value}%`, 'Adherence']}
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="rate" 
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Adherence Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {adherenceRate}%
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">Overall Adherence</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {consistentDays}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">Consistent Days</div>
          </div>
        </div>
      </div>
    );
  };

  const renderHealthScore = () => {
    const { score, breakdown, goals } = visualization.data;
    
    const pieData = [
      { name: 'Mood', value: breakdown.mood, color: '#059669' },
      { name: 'Adherence', value: breakdown.adherence, color: '#3b82f6' },
      { name: 'Consistency', value: breakdown.consistency, color: '#8b5cf6' }
    ];

    return (
      <div className="space-y-4">
        {/* Health Score Circle */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={getScoreColor(score)}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.51} 251`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {score}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Health Score
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          {pieData.map((item, index) => (
            <div key={index} className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div 
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: item.color }}
              />
              <div className="font-medium text-gray-900 dark:text-white">
                {item.value}
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                {item.name}
              </div>
            </div>
          ))}
        </div>

        {/* Goals */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700 dark:text-gray-300">Active Goals</span>
            <span className="font-semibold text-gray-900 dark:text-white">{goals.active}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">Completed Tasks</span>
            <span className="font-semibold text-gray-900 dark:text-white">{goals.completed}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderWeeklySummary = () => {
    return (
      <div className="space-y-4">
        <div className="text-center text-gray-600 dark:text-gray-400">
          Weekly summary visualization coming soon!
        </div>
      </div>
    );
  };

  const renderDefaultView = () => {
    return (
      <div className="space-y-4">
        <div className="text-center text-gray-600 dark:text-gray-400">
          Progress visualization not available for this type.
        </div>
      </div>
    );
  };

  const getTrendEmoji = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#059669'; // Green
    if (score >= 60) return '#d97706'; // Orange
    return '#dc2626'; // Red
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {visualization.title}
        </h3>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Visualization */}
      {renderVisualization()}

      {/* Insights */}
      {visualization.insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            💡 Key Insights
          </h4>
          <ul className="space-y-1">
            {visualization.insights.map((insight, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                <span className="text-green-500 mr-2">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actionable Tips */}
      {isExpanded && visualization.actionable_tips.length > 0 && (
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🎯 Actionable Tips
          </h4>
          <ul className="space-y-1">
            {visualization.actionable_tips.map((tip, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                <span className="text-blue-500 mr-2">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toggle Details Button */}
      {!onToggleExpand && visualization.actionable_tips.length > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm py-2 border-t border-gray-200 dark:border-gray-700"
        >
          {showDetails ? 'Hide Details' : 'Show Actionable Tips'}
        </button>
      )}

      {/* Details when toggled */}
      {showDetails && (
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🎯 Actionable Tips
          </h4>
          <ul className="space-y-1">
            {visualization.actionable_tips.map((tip, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                <span className="text-blue-500 mr-2">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


