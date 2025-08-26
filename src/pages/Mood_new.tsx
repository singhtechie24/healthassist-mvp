import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ToastService from '../services/toastService';

interface MoodEntry {
  id: string;
  mood: number;
  notes: string;
  trigger?: string;
  date: Date;
  userId?: string;
}

export default function Mood() {
  const [currentMood, setCurrentMood] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [moodTrigger, setMoodTrigger] = useState<string>('');
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const moodLabels = [
    '😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'
  ];

  const moodDescriptions = [
    'Terrible', 'Very Bad', 'Bad', 'Poor', 'Neutral', 
    'Good', 'Very Good', 'Great', 'Excellent', 'Amazing'
  ];

  const moodTriggers = [
    { value: '', label: 'Select what influenced your mood...' },
    { value: 'work', label: '💼 Work/Career' },
    { value: 'sleep', label: '😴 Sleep/Rest' },
    { value: 'health', label: '🏥 Health/Physical' },
    { value: 'social', label: '👥 Social/Relationships' },
    { value: 'exercise', label: '🏃 Exercise/Activity' },
    { value: 'weather', label: '🌤️ Weather/Environment' },
    { value: 'stress', label: '😰 Stress/Pressure' },
    { value: 'achievement', label: '🎯 Achievement/Success' },
    { value: 'other', label: '🤔 Other' }
  ];

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load mood history when user changes
  useEffect(() => {
    if (!authLoading) {
      loadMoodHistory();
    }
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoodHistory = async () => {
    try {
      if (user) {
        // Load from Firebase for logged-in users
        const q = query(
          collection(db, 'moodLogs'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const moods: MoodEntry[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          moods.push({
            id: doc.id,
            mood: data.mood,
            notes: data.notes,
            trigger: data.trigger || '',
            date: data.date.toDate(),
            userId: data.userId
          });
        });
        setMoodHistory(moods);
      } else {
        // No data for unauthenticated users
        setMoodHistory([]);
      }
    } catch (error) {
      console.error('Error loading mood history:', error);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this mood entry?')) return;
    
    try {
      if (user) {
        // Delete from Firebase
        await deleteDoc(doc(db, 'moodLogs', entryId));
      }
      
      // Remove from local state
      setMoodHistory(prev => prev.filter(entry => entry.id !== entryId));
      ToastService.success('Entry deleted successfully! 🗑️');
    } catch (error) {
      console.error('Error deleting entry:', error);
      ToastService.error('Error deleting entry. Please try again.');
    }
  };

  const handleSaveMood = async () => {
    // Validate that mood influence is selected
    if (!moodTrigger) {
      ToastService.warning('Please select what influenced your mood before logging.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (user) {
        // Save to Firebase for authenticated users only
        await addDoc(collection(db, 'moodLogs'), {
          mood: currentMood,
          notes: notes.trim(),
          trigger: moodTrigger,
          date: Timestamp.fromDate(new Date()),
          userId: user.uid
        });
      }

      // Reset form
      setCurrentMood(5);
      setNotes('');
      setMoodTrigger('');
      
      // Reload history
      await loadMoodHistory();
      
      ToastService.success('Mood logged successfully! 🎯');
    } catch (error) {
      console.error('Error saving mood:', error);
      ToastService.error('Error saving mood. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getAverageMood = () => {
    if (moodHistory.length === 0) return 0;
    const sum = moodHistory.reduce((acc, entry) => acc + entry.mood, 0);
    return (sum / moodHistory.length).toFixed(1);
  };

  // Helper functions for insights
  const getMostCommonMood = () => {
    if (moodHistory.length === 0) return null;
    const counts: Record<number, number> = {};
    moodHistory.forEach(entry => {
      counts[entry.mood] = (counts[entry.mood] || 0) + 1;
    });
    const mostCommon = Object.keys(counts).reduce((a, b) => counts[parseInt(a)] > counts[parseInt(b)] ? a : b);
    return {
      mood: parseInt(mostCommon),
      count: counts[parseInt(mostCommon)],
      emoji: moodLabels[parseInt(mostCommon) - 1],
      description: moodDescriptions[parseInt(mostCommon) - 1]
    };
  };

  const getCurrentStreak = () => {
    if (moodHistory.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const hasEntry = moodHistory.some(entry => 
        entry.date.toDateString() === checkDate.toDateString()
      );
      if (hasEntry) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const getWeekComparison = () => {
    const thisWeek = [];
    const lastWeek = [];
    const today = new Date();
    
    // This week (last 7 days)
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const entry = moodHistory.find(e => e.date.toDateString() === date.toDateString());
      if (entry) thisWeek.push(entry.mood);
    }
    
    // Last week (8-14 days ago)
    for (let i = 7; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const entry = moodHistory.find(e => e.date.toDateString() === date.toDateString());
      if (entry) lastWeek.push(entry.mood);
    }
    
    if (thisWeek.length === 0 || lastWeek.length === 0) return null;
    
    const thisAvg = thisWeek.reduce((a, b) => a + b, 0) / thisWeek.length;
    const lastAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
    const difference = thisAvg - lastAvg;
    
    return {
      difference: difference.toFixed(1),
      isImprovement: difference > 0,
      thisWeekAvg: thisAvg.toFixed(1),
      lastWeekAvg: lastAvg.toFixed(1)
    };
  };

  const getBestDay = () => {
    if (moodHistory.length === 0) return null;
    const best = moodHistory.reduce((prev, current) => 
      current.mood > prev.mood ? current : prev
    );
    return {
      mood: best.mood,
      date: best.date.toLocaleDateString(),
      emoji: moodLabels[best.mood - 1],
      description: moodDescriptions[best.mood - 1]
    };
  };

  const getMoodRange = () => {
    if (moodHistory.length === 0) return null;
    const moods = moodHistory.map(entry => entry.mood);
    const min = Math.min(...moods);
    const max = Math.max(...moods);
    return {
      min,
      max,
      range: max - min,
      minEmoji: moodLabels[min - 1],
      maxEmoji: moodLabels[max - 1]
    };
  };

  // Prepare chart data (last 7 days)
  const getChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      
      // Find mood entry for this date
      const dayEntry = moodHistory.find(entry => 
        entry.date.toLocaleDateString() === dateStr
      );
      
      last7Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        mood: dayEntry ? dayEntry.mood : 0, // Show 0 instead of null for better chart display
        hasEntry: !!dayEntry,
        emoji: dayEntry ? moodLabels[dayEntry.mood - 1] : '❓',
        description: dayEntry ? moodDescriptions[dayEntry.mood - 1] : 'No entry'
      });
    }
    return last7Days;
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login required message for unauthenticated users
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Mood Tracking</h1>
            <div className="flex justify-center mb-4">
              <span className="text-6xl">🔒</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Account Required</h2>
            <p className="text-gray-600 mb-6">
              Mood tracking requires an account to securely save and analyze your personal data over time.
            </p>
            <div className="space-y-3">
              <a
                href="/login"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Sign Up / Login
              </a>
              <p className="text-sm text-gray-500">
                Or continue using our <a href="/chat" className="text-blue-600 hover:underline">AI Chat</a> without an account
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg animate-pulse">
            <span className="text-3xl">🎭</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Mood Tracking
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Track your daily emotions and discover patterns in your mental wellness journey
          </p>
        </div>

        {/* Main Mood Logging Card */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 mb-8 transition-all duration-300 hover:shadow-3xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">How are you feeling today?</h2>
            <p className="text-gray-600">Move the slider to express your current mood</p>
          </div>
          
          {/* Animated Mood Display */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4 shadow-lg transition-all duration-500 ease-out transform hover:scale-110">
              <span className="text-6xl animate-bounce" style={{ animationDuration: '2s' }}>
                {moodLabels[currentMood - 1]}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-2">
              {currentMood}/10
            </div>
            <div className="text-lg text-gray-600 font-medium">
              {moodDescriptions[currentMood - 1]}
            </div>
          </div>

          {/* Custom Animated Slider */}
          <div className="mb-8">
            <div className="relative">
              <input
                type="range"
                min="1"
                max="10"
                value={currentMood}
                onChange={(e) => setCurrentMood(parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer transition-all duration-300 hover:shadow-lg mood-slider"
                style={{
                  background: `linear-gradient(to right, 
                    #fecaca 0%, #fed7aa 20%, #fef3c7 40%, 
                    #d9f99d 60%, #a7f3d0 80%, #bfdbfe 100%)`
                }}
              />
              
              {/* Slider Labels */}
              <div className="flex justify-between mt-3 px-1">
                <span className="text-sm text-gray-500 font-medium">😭 Terrible</span>
                <span className="text-sm text-gray-500 font-medium">🤩 Amazing</span>
              </div>
            </div>
          </div>

          {/* Mood Influence Selection */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-800 mb-4">
              What influenced your mood? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {moodTriggers.slice(1).map((trigger) => (
                <button
                  key={trigger.value}
                  onClick={() => setMoodTrigger(trigger.value)}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 text-left hover:scale-105 ${
                    moodTrigger === trigger.value
                      ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800">
                    {trigger.label}
                  </div>
                </button>
              ))}
            </div>
            {!moodTrigger && (
              <p className="text-red-500 text-sm mt-2 animate-pulse">
                Please select what influenced your mood
              </p>
            )}
          </div>

          {/* Notes Section */}
          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-800 mb-3">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share more details about your mood, thoughts, or what's on your mind..."
              className="w-full h-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 resize-none bg-white/50 backdrop-blur-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSaveMood}
              disabled={isLoading || !moodTrigger}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-8 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving Mood...
                </div>
              ) : (
                'Log My Mood 🎯'
              )}
            </button>
            
            <button
              onClick={() => {
                setCurrentMood(5);
                setNotes('');
                setMoodTrigger('');
              }}
              className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:shadow-md transition-all duration-300"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Charts Section */}
        {moodHistory.length > 0 && (
          <div className="mb-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
                Your Mood Journey
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Discover patterns and insights from your emotional wellness tracking
              </p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* 7-Day Trend Chart */}
              <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
                <div className="flex items-center mb-4">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3"></div>
                  <h3 className="text-2xl font-bold text-gray-800">Last 7 Days</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  📈 Track your emotional patterns and discover trends in your daily mood
                </p>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={getChartData()}>
                    <defs>
                      <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      tickFormatter={(value) => value === 0 ? 'No entry' : `${value}`}
                    />
                    <Tooltip 
                      formatter={(value, _name, props) => {
                        if (value === 0) return ['No mood entry', ''];
                        return [`${props.payload.emoji} ${value}/10 - ${props.payload.description}`, 'Mood'];
                      }}
                      labelFormatter={(label) => `📅 ${label}`}
                      contentStyle={{
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="mood" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 8 }}
                      activeDot={{ r: 10, fill: '#2563EB' }}
                      connectNulls={false}
                      fill="url(#moodGradient)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Mood Insights Cards */}
              <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
                <div className="flex items-center mb-4">
                  <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mr-3"></div>
                  <h3 className="text-2xl font-bold text-gray-800">Mood Insights</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  🧠 Smart insights about your emotional patterns and wellness progress
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Most Common Mood */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-3xl mb-2">🎯</div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Most Common</div>
                    {(() => {
                      const mostCommon = getMostCommonMood();
                      return mostCommon ? (
                        <>
                          <div className="text-lg font-semibold text-gray-900">
                            {mostCommon.emoji} {mostCommon.description}
                          </div>
                          <div className="text-xs text-gray-600">
                            {mostCommon.count} {mostCommon.count === 1 ? 'time' : 'times'}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500">No data yet</div>
                      );
                    })()}
                  </div>

                  {/* Current Streak */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-3xl mb-2">🔥</div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Logging Streak</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {getCurrentStreak()} {getCurrentStreak() === 1 ? 'day' : 'days'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {getCurrentStreak() > 0 ? 'Keep it up!' : 'Start today!'}
                    </div>
                  </div>

                  {/* Week Comparison */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-3xl mb-2">📈</div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">This Week</div>
                    {(() => {
                      const weekComparison = getWeekComparison();
                      return weekComparison ? (
                        <>
                          <div className={`text-lg font-semibold ${weekComparison.isImprovement ? 'text-green-600' : 'text-red-600'}`}>
                            {weekComparison.isImprovement ? '+' : ''}{weekComparison.difference}
                          </div>
                          <div className="text-xs text-gray-600">
                            vs last week
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold text-gray-900">
                            {getAverageMood()}/10
                          </div>
                          <div className="text-xs text-gray-600">
                            Average mood
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Highest Mood */}
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-3xl mb-2">🏆</div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Highest Mood</div>
                    {(() => {
                      const bestDay = getBestDay();
                      return bestDay ? (
                        <>
                          <div className="text-lg font-semibold text-gray-900">
                            {bestDay.emoji} {bestDay.mood}/10
                          </div>
                          <div className="text-xs text-gray-600">
                            on {bestDay.date}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500">No data yet</div>
                      );
                    })()}
                  </div>

                  {/* Mood Range */}
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-3xl mb-2">⚡</div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Mood Range</div>
                    {(() => {
                      const moodRange = getMoodRange();
                      return moodRange ? (
                        <>
                          <div className="text-lg font-semibold text-gray-900">
                            {moodRange.minEmoji} - {moodRange.maxEmoji}
                          </div>
                          <div className="text-xs text-gray-600">
                            {moodRange.range} point spread
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500">No data yet</div>
                      );
                    })()}
                  </div>

                  {/* Notes Average */}
                  <div className="bg-gradient-to-br from-pink-50 to-pink-100 border-2 border-pink-200 rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-3xl mb-2">📝</div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Notes Average</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {moodHistory.length > 0 
                        ? Math.round(moodHistory.reduce((acc, entry) => acc + entry.notes.split(' ').length, 0) / moodHistory.length)
                        : 0
                      } words
                    </div>
                    <div className="text-xs text-gray-600">
                      per entry
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mood History & Stats */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Stats */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mr-3"></div>
              <h3 className="text-2xl font-bold text-gray-800">Your Mood Stats</h3>
            </div>
            <p className="text-gray-600 mb-6">
              📋 Key metrics about your mood tracking journey and emotional wellness patterns
            </p>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                <span className="text-gray-700 font-medium">Total Entries:</span>
                <span className="font-bold text-lg text-gray-800">{moodHistory.length}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl">
                <span className="text-gray-700 font-medium">Average Mood:</span>
                <span className="font-bold text-lg text-blue-600">{getAverageMood()}/10</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl">
                <span className="text-gray-700 font-medium">Highest Recorded:</span>
                <span className="font-bold text-lg text-green-600">
                  {moodHistory.length > 0 ? Math.max(...moodHistory.map(m => m.mood)) : 'N/A'}/10
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl">
                <span className="text-gray-700 font-medium">Lowest Recorded:</span>
                <span className="font-bold text-lg text-red-600">
                  {moodHistory.length > 0 ? Math.min(...moodHistory.map(m => m.mood)) : 'N/A'}/10
                </span>
              </div>
            </div>
          </div>

          {/* Recent History */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mr-3"></div>
              <h3 className="text-2xl font-bold text-gray-800">Recent Entries</h3>
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
              {moodHistory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-all duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{moodLabels[entry.mood - 1]}</span>
                      <div>
                        <span className="text-lg font-bold text-gray-800">{entry.mood}/10</span>
                        <div className="text-sm text-gray-600">{moodDescriptions[entry.mood - 1]}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500 font-medium">
                        {entry.date.toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-500 hover:text-red-700 hover:scale-110 transition-all duration-200 p-2"
                        title="Delete entry"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {entry.trigger && (
                    <div className="mb-2">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {moodTriggers.find(t => t.value === entry.trigger)?.label || entry.trigger}
                      </span>
                    </div>
                  )}
                  {entry.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{entry.notes}</p>
                  )}
                </div>
              ))}
              {moodHistory.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎭</div>
                  <p className="text-gray-500 text-lg">No mood entries yet</p>
                  <p className="text-gray-400 text-sm">Start tracking your emotional wellness journey!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


