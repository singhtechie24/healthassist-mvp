import { useState } from 'react';
import { MessageReactions as ReactionService, type ReactionType } from '../services/messageReactions';
import type { Message } from '../types/conversation';

interface MessageReactionsProps {
  message: Message;
  onReactionAdd: (messageId: string, reactionType: ReactionType, feedback?: string) => void;
  onReactionRemove: (messageId: string, reactionId: string) => void;
  currentUserId: string;
}

export default function MessageReactions({ 
  message, 
  onReactionAdd, 
  onReactionRemove, 
  currentUserId 
}: MessageReactionsProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<ReactionType | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showAllReactions, setShowAllReactions] = useState(false);

  // Get user's existing reactions for this message
  const userReactions = message.reactions?.filter(r => r.userId === currentUserId) || [];
  const hasUserReacted = userReactions.length > 0;

  // Count reactions by type
  const reactionCounts = new Map<string, number>();
  message.reactions?.forEach(reaction => {
    const emoji = reaction.reactionType.emoji;
    reactionCounts.set(emoji, (reactionCounts.get(emoji) || 0) + 1);
  });

  const handleQuickReaction = (reactionType: ReactionType) => {
    // Check if user already used this reaction
    const existingReaction = userReactions.find(r => r.reactionType.emoji === reactionType.emoji);
    
    if (existingReaction) {
      // Remove existing reaction
      onReactionRemove(message.id, existingReaction.id);
    } else {
      // Add new reaction
      onReactionAdd(message.id, reactionType);
    }
  };

  const handleReactionWithFeedback = (reactionType: ReactionType) => {
    setSelectedReaction(reactionType);
    setShowFeedbackModal(true);
  };

  const submitFeedback = () => {
    if (selectedReaction) {
      onReactionAdd(message.id, selectedReaction, feedbackText || undefined);
      setShowFeedbackModal(false);
      setFeedbackText('');
      setSelectedReaction(null);
    }
  };

  // Only show reactions for AI messages
  if (message.sender !== 'ai') {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Quick Reaction Buttons */}
      <div className="flex flex-wrap gap-1">
        {ReactionService.REACTION_TYPES.slice(0, 6).map((reactionType) => {
          const count = reactionCounts.get(reactionType.emoji) || 0;
          const isUserReacted = userReactions.some(r => r.reactionType.emoji === reactionType.emoji);
          
          return (
            <button
              key={reactionType.emoji}
              onClick={() => handleQuickReaction(reactionType)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all duration-200 ${
                isUserReacted
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-2 ring-blue-300 dark:ring-blue-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={reactionType.name}
            >
              <span className="text-base">{reactionType.emoji}</span>
              {count > 0 && <span className="font-medium">{count}</span>}
            </button>
          );
        })}
        
        {/* Show More Reactions Button */}
        <button
          onClick={() => setShowAllReactions(!showAllReactions)}
          className="px-2 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="More reactions"
        >
          {showAllReactions ? '−' : '+'}
        </button>
      </div>

      {/* Extended Reaction Options */}
      {showAllReactions && (
        <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {ReactionService.REACTION_TYPES.slice(6).map((reactionType) => {
            const count = reactionCounts.get(reactionType.emoji) || 0;
            const isUserReacted = userReactions.some(r => r.reactionType.emoji === reactionType.emoji);
            
            return (
              <button
                key={reactionType.emoji}
                onClick={() => handleQuickReaction(reactionType)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all duration-200 ${
                  isUserReacted
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-2 ring-blue-300 dark:ring-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
                title={reactionType.name}
              >
                <span className="text-base">{reactionType.emoji}</span>
                {count > 0 && <span className="font-medium">{count}</span>}
              </button>
            );
          })}
          
          {/* Feedback Button */}
          <button
            onClick={() => handleReactionWithFeedback({ emoji: '💬', name: 'feedback', sentiment: 'neutral', category: 'engagement' })}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            💬 Add feedback
          </button>
        </div>
      )}

      {/* Reaction Summary */}
      {message.reactionSummary && message.reactionSummary.totalReactions > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {message.reactionSummary.totalReactions} reaction{message.reactionSummary.totalReactions !== 1 ? 's' : ''}
          </span>
          {message.reactionSummary.userSatisfaction >= 70 && (
            <span className="text-green-600 dark:text-green-400">✨ Helpful</span>
          )}
          {message.reactionSummary.userSatisfaction < 40 && (
            <span className="text-orange-600 dark:text-orange-400">⚡ Needs improvement</span>
          )}
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Share your feedback
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How can this response be improved?
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Your feedback helps improve the AI's responses..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={4}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
