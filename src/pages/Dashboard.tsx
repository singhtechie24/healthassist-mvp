import { useEffect, useState, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, limit, Timestamp } from 'firebase/firestore';
import { conversationStorage } from '../services/conversationStorage';
import { gnewsApi, type HealthArticle as GNewsHealthArticle } from '../services/gnewsApi';
import ToastService from '../services/toastService';

// Interfaces for dashboard data
interface MoodEntry {
  id: string;
  mood: number;
  notes: string;
  trigger?: string;
  date: Date;
  userId?: string;
}

interface MedicineLog {
  id: string;
  reminderId: string;
  userId: string;
  date: Date;
  time: string;
  taken: boolean;
}

interface DashboardMetrics {
  totalChats: number;
  weeklyChats: number;
  averageMood: number;
  moodTrend: number[];
  medicationAdherence: number;
  healthScore: number;
  recentActivity: ActivityItem[];
  latestTips: GNewsHealthArticle[];
}

interface ActivityItem {
  id: string;
  type: 'chat' | 'mood' | 'medication' | 'tip';
  description: string;
  timestamp: Date;
  icon: string;
  color: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Connecting...');
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalChats: 0,
    weeklyChats: 0,
    averageMood: 0,
    moodTrend: [],
    medicationAdherence: 0,
    healthScore: 0,
    recentActivity: [],
    latestTips: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Reading progress tracking
  const getReadingProgress = () => {
    try {
      const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
      const savedArticles = JSON.parse(localStorage.getItem('savedArticles') || '[]');
      const lastReadDate = localStorage.getItem('lastReadDate');
      const readingStreak = parseInt(localStorage.getItem('readingStreak') || '0');
      
      return {
        articlesRead: readArticles.length,
        savedArticles: savedArticles.length,
        readingStreak,
        lastReadDate,
        weeklyGoal: 5,
        currentlyReading: metrics.latestTips[0]?.title || 'No current article'
      };
    } catch {
      return {
        articlesRead: 0,
        savedArticles: 0,
        readingStreak: 0,
        lastReadDate: null,
        weeklyGoal: 5,
        currentlyReading: 'No current article'
      };
    }
  };

  // Initialize demo data if needed
  const initializeDemoData = () => {
    const readArticles = localStorage.getItem('readArticles');
    if (!readArticles) {
      // Add some demo reading data
      localStorage.setItem('readArticles', JSON.stringify([
        { id: 1, title: 'Health Benefits of Regular Exercise', date: new Date().toISOString() },
        { id: 2, title: 'Understanding Mental Health', date: new Date().toISOString() },
        { id: 3, title: 'Nutrition for Better Sleep', date: new Date().toISOString() }
      ]));
      localStorage.setItem('savedArticles', JSON.stringify([
        { id: 4, title: 'Managing Stress Effectively', date: new Date().toISOString() },
        { id: 5, title: '10 Healthy Eating Tips', date: new Date().toISOString() }
      ]));
      localStorage.setItem('readingStreak', '7');
      localStorage.setItem('lastReadDate', new Date().toISOString());
    }
  };
  const navigate = useNavigate();

  // Load all dashboard data
  const loadDashboardData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const [chatData, moodData, medicationData, tipsData] = await Promise.all([
        loadChatMetrics(userId),
        loadMoodMetrics(userId),
        loadMedicationMetrics(userId),
        loadLatestTips()
      ]);

      const recentActivity = await loadRecentActivity(userId);
      const healthScore = calculateHealthScore(moodData.average, medicationData.adherence);

      setMetrics({
        totalChats: chatData.total,
        weeklyChats: chatData.weekly,
        averageMood: moodData.average,
        moodTrend: moodData.trend,
        medicationAdherence: medicationData.adherence,
        healthScore,
        recentActivity,
        latestTips: tipsData
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initialize demo data for reading progress
    initializeDemoData();
    
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setFirebaseStatus('✅ Firebase Connected & User Logged In!');
        await loadDashboardData(currentUser.uid);
      } else {
        setUser(null);
        setFirebaseStatus('❌ Not logged in');
        setIsLoading(false);
        navigate('/'); // Redirect to landing page
      }
    });

    return () => unsubscribe();
  }, [navigate, loadDashboardData]);

  // Load chat/conversation metrics
  const loadChatMetrics = async (userId: string) => {
    try {
      const conversations = await conversationStorage.loadUserConversations(userId);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weeklyChats = conversations.filter(conv => conv.lastActive >= oneWeekAgo).length;
      const totalMessages = conversations.reduce((sum, conv) => sum + conv.totalMessages, 0);

      return {
        total: totalMessages,
        weekly: weeklyChats
      };
    } catch (error) {
      console.error('Error loading chat metrics:', error);
      return { total: 0, weekly: 0 };
    }
  };

  // Load mood metrics (7-day average with 1-10 scale)
  const loadMoodMetrics = async (userId: string) => {
    try {
      // Get the date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const q = query(
        collection(db, 'moodLogs'),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(sevenDaysAgo)),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const moodEntries: MoodEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        moodEntries.push({
          id: doc.id,
          mood: data.mood, // Already 1-10 scale
          notes: data.notes || '',
          trigger: data.trigger,
          date: data.date.toDate(),
          userId: data.userId
        });
      });

      // Calculate 7-day average (1-10 scale)
      const average = moodEntries.length > 0 
        ? moodEntries.reduce((sum, entry) => sum + entry.mood, 0) / moodEntries.length
        : 0;

      // Get trend for the last 7 days
      const trend = moodEntries.reverse().map(entry => entry.mood);

      console.log(`📊 Mood Metrics: ${moodEntries.length} entries in last 7 days, average: ${average.toFixed(1)}/10`);

      return {
        average: Math.round(average * 10) / 10, // Round to 1 decimal place
        trend: trend.length > 0 ? trend : [] // No fallback data - show empty state
      };
    } catch (error) {
      console.error('Error loading mood metrics:', error);
      return { average: 0, trend: [] };
    }
  };

  // Load medication adherence metrics
  const loadMedicationMetrics = async (userId: string) => {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const q = query(
        collection(db, 'medicineLogs'),
        where('userId', '==', userId),
        where('date', '>=', oneMonthAgo),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const medicineLogs: MedicineLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        medicineLogs.push({
          id: doc.id,
          reminderId: data.reminderId,
          userId: data.userId,
          date: data.date.toDate(),
          time: data.time,
          taken: data.taken
        });
      });

      if (medicineLogs.length === 0) {
        return { adherence: 0 };
      }

      const takenCount = medicineLogs.filter(log => log.taken).length;
      const adherence = Math.round((takenCount / medicineLogs.length) * 100);

      return { adherence };
    } catch (error) {
      console.error('Error loading medication metrics:', error);
      return { adherence: 0 };
    }
  };

  // Load recent activity
  const loadRecentActivity = async (userId: string): Promise<ActivityItem[]> => {
    const activities: ActivityItem[] = [];

    try {
      // Recent chats
      const conversations = await conversationStorage.loadUserConversations(userId);
      conversations.slice(0, 2).forEach(conv => {
        activities.push({
          id: `chat-${conv.id}`,
          type: 'chat',
          description: `Health consultation: "${conv.title}"`,
          timestamp: conv.lastActive,
          icon: 'chat',
          color: 'emerald-500'
        });
      });

      // Recent mood logs
      const moodQuery = query(
        collection(db, 'moodLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(2)
      );
      const moodSnapshot = await getDocs(moodQuery);
      moodSnapshot.forEach((doc) => {
        const data = doc.data();
        const moodLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Great'];
        activities.push({
          id: `mood-${doc.id}`,
          type: 'mood',
          description: `Mood logged: ${moodLabels[data.mood - 1] || 'Unknown'} (${data.mood}/5)`,
          timestamp: data.date.toDate(),
          icon: 'mood',
          color: 'blue-500'
        });
      });

      // Recent medication logs
      const medQuery = query(
        collection(db, 'medicineLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(2)
      );
      const medSnapshot = await getDocs(medQuery);
      medSnapshot.forEach((doc) => {
        const data = doc.data();
        activities.push({
          id: `med-${doc.id}`,
          type: 'medication',
          description: data.taken ? 'Medication taken on time' : 'Medication reminder missed',
          timestamp: data.date.toDate(),
          icon: 'medication',
          color: data.taken ? 'purple-500' : 'red-500'
        });
      });

      // Sort by timestamp and return top 4
      return activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 4);

    } catch (error) {
      console.error('Error loading recent activity:', error);
      return [];
    }
  };

  // Load latest health tips/articles
  const loadLatestTips = async (): Promise<GNewsHealthArticle[]> => {
    try {
      console.log('🔄 Dashboard: Attempting to fetch real GNews articles...');
      const articles = await gnewsApi.fetchHealthArticles(3); // Get 3 latest articles for dashboard
      console.log('Dashboard - Loaded articles:', articles);
      console.log('Dashboard - Articles sourceUrls:', articles.map(a => ({ title: a.title, sourceUrl: a.sourceUrl, source: a.source })));
      
      // Check if we got real articles or fallback articles
      const realArticles = articles.filter(article => 
        article.sourceUrl && 
        article.sourceUrl !== '#' && 
        !article.sourceUrl.includes('fallback') &&
        article.source !== 'Fallback'
      );
      
      console.log(`📊 Dashboard: Got ${realArticles.length} real articles out of ${articles.length} total`);
      
      // If we have some real articles, prioritize them
      if (realArticles.length > 0) {
        console.log('✅ Dashboard: Using real GNews articles with valid URLs');
        return realArticles.slice(0, 3); // Take up to 3 real articles
      } else {
        console.log('⚠️ Dashboard: No real articles available, all are fallback content');
        // Still return fallback articles but user will see toast content
        return articles.slice(0, 3);
      }
    } catch (error) {
      console.error('❌ Dashboard: Error loading latest tips:', error);
      return [];
    }
  };

  // Calculate overall health score
  const calculateHealthScore = (averageMood: number, medicationAdherence: number): number => {
    if (averageMood === 0 && medicationAdherence === 0) return 0;
    
    // Weight: 60% mood, 40% medication adherence
    const moodScore = (averageMood / 5) * 60;
    const adherenceScore = (medicationAdherence / 100) * 40;
    
    return Math.round(moodScore + adherenceScore);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/'); // Redirect to landing page instead of login
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getUserDisplayName = () => {
    if (!user) return 'Not logged in';
    return user.email || user.displayName || 'User';
  };

  const getUserType = () => {
    if (!user) return '';
    if (user.providerData.some(p => p.providerId === 'google.com')) return '(Google)';
    return '(Email)';
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-emerald-50/50 to-teal-50/50 relative overflow-hidden">
      {/* Decorative circular elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-emerald-100/30 to-teal-100/30 rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      <div className="absolute top-20 right-0 w-72 h-72 bg-gradient-to-bl from-blue-100/20 to-purple-100/20 rounded-full translate-x-1/3 -translate-y-1/3 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-gradient-to-tr from-orange-100/25 to-pink-100/25 rounded-full translate-y-1/2 animate-pulse" style={{ animationDelay: '4s' }}></div>
      
      {/* Welcome Header Section - Rounded with transparency */}
      <div className="relative z-10 mx-4 lg:mx-8 mt-6 mb-8 p-6 lg:p-8 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl shadow-emerald-500/10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div className="animate-fade-in-up">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Welcome back, {getUserDisplayName().split('@')[0] || 'User'}! 👋
          </h1>
          <p className="text-gray-600 text-lg">
            Here's your health overview for today
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 lg:mt-0 animate-fade-in-right">
          {/* Search Bar */}
          <div className="relative group">
            <input
              type="text"
              placeholder="Search health data..."
              className="w-64 px-4 py-3 pl-12 bg-white/90 border border-emerald-200/50 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:shadow-xl"
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-emerald-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Export Data Button */}
          <button className="px-5 py-3 bg-white/90 border border-emerald-200/50 text-emerald-600 rounded-full hover:bg-emerald-50 hover:scale-105 transition-all duration-300 flex items-center space-x-2 shadow-lg backdrop-blur-sm group">
            <svg className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-medium">Export</span>
          </button>

          {/* User Menu */}
          {user && (
            <div className="flex items-center space-x-3 group">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform duration-300 ring-4 ring-white/50">
                {getUserDisplayName().charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-bold text-gray-900">{getUserDisplayName().split('@')[0]}</p>
                <p className="text-xs text-emerald-600 font-medium">{getUserType()} User</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 hover:scale-110 transition-all duration-300 p-2 rounded-full hover:bg-red-50"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Health Metrics Cards */}
      <div className="relative z-10 mx-4 lg:mx-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Weekly Chats */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-emerald-500/20 hover:scale-105 transition-all duration-300 animate-fade-in-up group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-gray-600">AI Consultations</h3>
            </div>
            <button 
              onClick={() => navigate('/chat')}
              className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
            >
              View more
            </button>
          </div>
          <div className="mb-4">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900">{metrics.totalChats}</div>
                <div className="text-sm text-emerald-600 font-medium">
                  {metrics.weeklyChats > 0 ? `+${metrics.weeklyChats} this week` : 'No chats this week'}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            <span>Total messages</span>
            <span className="w-2 h-2 bg-emerald-300 rounded-full"></span>
            <span>Health advice</span>
          </div>
        </div>

        {/* Mood Score */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-105 transition-all duration-300 animate-fade-in-up group" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-gray-600">Mood Average</h3>
            </div>
            <button 
              onClick={() => navigate('/mood')}
              className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
            >
              View more
            </button>
          </div>
          <div className="mb-4">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.averageMood > 0 ? metrics.averageMood : '—'}
                </div>
                <div className="text-sm text-green-600 font-medium">
                  {metrics.averageMood >= 4 ? 'Good mood trend' : metrics.averageMood >= 3 ? 'Stable mood' : metrics.averageMood > 0 ? 'Needs attention' : 'No data yet'}
                </div>
              </>
            )}
          </div>
          {/* Mood progress bar */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="w-full bg-gray-200 rounded-full h-3"></div>
                <div className="h-2 bg-gray-200 rounded w-16 mt-1"></div>
              </div>
            ) : metrics.averageMood > 0 ? (
              <>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-700 ease-out shadow-sm ${
                      metrics.averageMood >= 8 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                      metrics.averageMood >= 6 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                      metrics.averageMood >= 4 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${Math.min((metrics.averageMood / 10) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {metrics.averageMood}/10 • {Math.round((metrics.averageMood / 10) * 100)}%
                  </span>
                  <span className={`text-xs font-medium ${
                    metrics.averageMood >= 8 ? 'text-green-600' :
                    metrics.averageMood >= 6 ? 'text-blue-600' :
                    metrics.averageMood >= 4 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {metrics.averageMood >= 9 ? 'Excellent' : 
                     metrics.averageMood >= 8 ? 'Very Good' :
                     metrics.averageMood >= 7 ? 'Good' : 
                     metrics.averageMood >= 6 ? 'Above Average' :
                     metrics.averageMood >= 5 ? 'Average' :
                     metrics.averageMood >= 4 ? 'Below Average' :
                     metrics.averageMood >= 3 ? 'Low' : 'Very Low'}
                  </span>
                </div>
              </>
            ) : (
              // Empty state
              <div className="text-center py-1">
                <div className="w-full bg-gray-200 rounded-full h-3"></div>
                <p className="text-xs text-gray-400 mt-1">No mood data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Medication Adherence */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-105 transition-all duration-300 animate-fade-in-up group" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-gray-600">Med Adherence</h3>
            </div>
            <button 
              onClick={() => navigate('/reminders')}
              className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
            >
              View more
            </button>
          </div>
          <div className="mb-4">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.medicationAdherence > 0 ? `${metrics.medicationAdherence}%` : '—'}
                </div>
                <div className="text-sm text-green-600 font-medium">
                  {metrics.medicationAdherence >= 80 ? 'Great adherence' : metrics.medicationAdherence >= 60 ? 'Good progress' : metrics.medicationAdherence > 0 ? 'Needs improvement' : 'No data yet'}
                </div>
              </>
            )}
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            {isLoading ? (
              <div className="bg-gray-300 h-2 rounded-full animate-pulse w-3/4"></div>
            ) : (
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${metrics.medicationAdherence}%` }}
              ></div>
            )}
          </div>
        </div>

        {/* Health Score */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-orange-500/20 hover:scale-105 transition-all duration-300 animate-fade-in-up group" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-gray-600">Health Score</h3>
            </div>
            <button 
              onClick={() => {
                // Show detailed health score breakdown via toast
                const moodScore = Math.round((metrics.averageMood / 5) * 60);
                const adherenceScore = Math.round((metrics.medicationAdherence / 100) * 40);
                const details = `📊 Health Score Breakdown\n\n• Mood Score (60%): ${moodScore}/60\n• Medication Adherence (40%): ${adherenceScore}/40\n• Total Score: ${metrics.healthScore}/100`;
                ToastService.info(details, { duration: 6000 });
              }}
              className="text-emerald-600 text-sm font-medium hover:text-emerald-700 transition-colors duration-200"
            >
              View details
            </button>
          </div>
          <div className="mb-4">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.healthScore > 0 ? metrics.healthScore : '—'}
                </div>
                <div className="text-sm text-green-600 font-medium">
                  {metrics.healthScore >= 80 ? 'Excellent' : metrics.healthScore >= 60 ? 'Good' : metrics.healthScore >= 40 ? 'Fair' : metrics.healthScore > 0 ? 'Needs attention' : 'No data yet'}
                </div>
              </>
            )}
          </div>
          {/* Circular progress */}
          <div className="relative w-12 h-12">
            {isLoading ? (
              <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
            ) : (
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="3" fill="none" />
                <circle cx="20" cy="20" r="16" stroke="#f97316" strokeWidth="3" fill="none" 
                  strokeDasharray={`${Math.max(metrics.healthScore * 0.628, 0)} 100`} strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>

      </div>

      {/* Main Content Grid - 3 Equal Columns */}
      <div className="relative z-10 mx-4 lg:mx-8 grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 overflow-hidden">
        {/* Quick Actions - Left Column */}
        <div className="animate-fade-in-up flex min-w-0" style={{ animationDelay: '0.4s' }}>
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 w-full flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
              <span className="text-sm text-gray-500">Choose your activity</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
              <button 
                onClick={() => navigate('/chat')}
                className="group p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200/50 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Health Chat</h3>
                    <p className="text-sm text-gray-600">Get personalized health guidance</p>
                  </div>
                </div>
              </button>

              <button 
                onClick={() => navigate('/mood')}
                className="group p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1a4 4 0 014 4v2a4 4 0 01-4 4H9m11-7H4m18-2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2h16a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Mood Tracker</h3>
                    <p className="text-sm text-gray-600">Log your daily mood and feelings</p>
                  </div>
                </div>
              </button>

              <button 
                onClick={() => navigate('/reminders')}
                className="group p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Med Reminders</h3>
                    <p className="text-sm text-gray-600">Manage your medications</p>
                  </div>
                </div>
              </button>

              <button 
                onClick={() => navigate('/emergency')}
                className="group p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Emergency</h3>
                    <p className="text-sm text-gray-600">Practice emergency response</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Reading Progress - Center Column */}
        <div className="animate-fade-in-up flex min-w-0" style={{ animationDelay: '0.5s' }}>
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 w-full flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Reading Progress</h2>
                <p className="text-sm text-gray-500 mt-1">Your health learning journey</p>
              </div>
              <button 
                onClick={() => navigate('/tips')}
                className="px-3 py-2 text-amber-600 text-sm font-medium hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all duration-200"
              >
                View library
              </button>
            </div>
            
            <div className="space-y-4 flex-grow">
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : (
                <>
                  {/* Articles Read */}
                  <div className="flex items-center justify-between p-2 bg-green-50/50 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">📚</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Articles Read</p>
                        <p className="text-xs text-gray-600">Total completed</p>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {getReadingProgress().articlesRead}
                    </div>
                  </div>

                  {/* Saved to Read */}
                  <div className="flex items-center justify-between p-2 bg-blue-50/50 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">🔖</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Saved to Read</p>
                        <p className="text-xs text-gray-600">Bookmarked articles</p>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {getReadingProgress().savedArticles}
                    </div>
                  </div>

                  {/* Reading Streak */}
                  <div className="flex items-center justify-between p-2 bg-orange-50/50 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">🔥</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Reading Streak</p>
                        <p className="text-xs text-gray-600">Days active</p>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">
                      {getReadingProgress().readingStreak}
                    </div>
                  </div>

                  {/* Currently Reading */}
                  {metrics.latestTips.length > 0 && (
                    <div className="p-2 bg-purple-50/50 rounded-xl">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xs">📍</span>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">Currently Reading</p>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {getReadingProgress().currentlyReading}
                      </p>
                    </div>
                  )}

                  {/* Weekly Goal */}
                  <div className="p-2 bg-emerald-50/50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xs">🎯</span>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">Weekly Goal</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-600">
                        {Math.min(getReadingProgress().articlesRead, getReadingProgress().weeklyGoal)}/{getReadingProgress().weeklyGoal}
                      </span>
                    </div>
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min((getReadingProgress().articlesRead / getReadingProgress().weeklyGoal) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity - Right Column */}
        <div className="animate-fade-in-up flex min-w-0" style={{ animationDelay: '0.6s' }}>
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg shadow-emerald-500/10 border border-white/50 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 w-full flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <button 
              onClick={() => {
                // Show detailed activity modal or expand view
                const allActivity = [
                  ...metrics.recentActivity,
                  // Add some example extended activity
                  ...(metrics.totalChats > 0 ? [{
                    id: 'extended-1',
                    type: 'chat' as const,
                    description: `Completed ${metrics.totalChats} total health consultations`,
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    icon: 'chat',
                    color: 'emerald-500'
                  }] : []),
                  ...(metrics.averageMood > 0 ? [{
                    id: 'extended-2', 
                    type: 'mood' as const,
                    description: `Average mood score: ${metrics.averageMood}/5`,
                    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                    icon: 'mood',
                    color: 'blue-500'
                  }] : [])
                ];
                
                const activitySummary = `📊 Your Complete Health Activity:\n\n${allActivity.map((activity, i) => `${i + 1}. ${activity.description}`).join('\n')}\n\n🎯 Total Activities: ${allActivity.length}\n📈 Keep up the great work!`;
                ToastService.custom(activitySummary, '📊', { duration: 8000, color: '#10B981' });
              }}
              className="text-emerald-600 text-sm font-medium hover:text-emerald-700 transition-colors duration-200"
            >
              View more
            </button>
          </div>
          
          <div className="space-y-4 flex-grow">
            {isLoading ? (
              // Loading state for recent activity
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 rounded-2xl bg-gray-50/50 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))
            ) : metrics.recentActivity.length > 0 ? (
              // Real activity data
              metrics.recentActivity.map((activity) => {
                const getActivityIcon = (type: string) => {
                  switch (type) {
                    case 'chat':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      );
                    case 'mood':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1a4 4 0 014 4v2a4 4 0 01-4 4H9m11-7H4m18-2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2h16a2 2 0 012 2z" />
                        </svg>
                      );
                    case 'medication':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      );
                    default:
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      );
                  }
                };

                const getTimeAgo = (date: Date) => {
                  const now = new Date();
                  const diff = now.getTime() - date.getTime();
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const days = Math.floor(hours / 24);
                  
                  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
                  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                  return 'Just now';
                };

                const getBgColor = (type: string) => {
                  switch (type) {
                    case 'chat': return 'bg-emerald-50/50';
                    case 'mood': return 'bg-blue-50/50';
                    case 'medication': return activity.color.includes('red') ? 'bg-red-50/50' : 'bg-purple-50/50';
                    default: return 'bg-green-50/50';
                  }
                };

                return (
                  <div key={activity.id} className={`flex items-center space-x-3 p-3 rounded-2xl ${getBgColor(activity.type)}`}>
                    <div className={`w-10 h-10 bg-${activity.color} rounded-full flex items-center justify-center`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{getTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              // No activity state
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-2">No recent activity</p>
                <p className="text-xs text-gray-400">Start by chatting with your AI health assistant!</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>

    {/* Latest Health Articles - Full Width Section - Outside main container */}
    <div className="relative mb-12 animate-fade-in-up w-full" style={{ animationDelay: '0.7s' }}>
      <div className="bg-white/80 backdrop-blur-sm p-6 shadow-lg shadow-emerald-500/10 border-t border-b border-white/50 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300">
        <div className="mx-4 lg:mx-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Latest Health Articles</h2>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.latestTips.length > 0 ? `${metrics.latestTips.length} fresh articles from trusted sources` : 'Loading latest health insights...'}
            </p>
          </div>
          <button 
            onClick={() => {
              // Navigate to tips page and set articles tab via localStorage
              localStorage.setItem('healthapp_current_page', 'articles');
              navigate('/tips');
            }}
            className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200 rounded-2xl transition-all duration-200 flex items-center space-x-2"
          >
            <span>View all articles</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading state for articles
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))
          ) : metrics.latestTips.length > 0 ? (
            // Real articles data
            metrics.latestTips.map((article, index) => (
              <div 
                key={article.id || index} 
                className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl p-6 border border-gray-200/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                onClick={() => {
                  console.log('Article clicked:', article);
                  console.log('Article sourceUrl:', article.sourceUrl);
                  
                  // Enhanced URL checking - handle real URLs from both GNews and trusted fallback sources
                  const articleUrl = article.sourceUrl;
                  
                  console.log('🔗 Article click details:', {
                    title: article.title,
                    sourceUrl: articleUrl,
                    source: article.source,
                    isRealUrl: !!(articleUrl && articleUrl.startsWith('https://'))
                  });
                  
                  if (articleUrl && articleUrl.startsWith('https://')) {
                    // Real external URL - open it
                    console.log('✅ Opening real article URL:', articleUrl);
                    window.open(articleUrl, '_blank');
                  } else {
                    // No valid external URL - show content preview
                    console.log('📝 No external URL available, showing content preview');
                    const contentPreview = `📰 ${article.title}\n\n${article.excerpt}\n\n📖 Read Time: ${article.readTime}\n📅 Published: ${article.publishDate}\n🏷️ Category: ${article.category}\n\n💡 This is a health tip from our curated collection. For more detailed information, please consult with healthcare professionals.`;
                    ToastService.custom(contentPreview, '📰', { 
                      duration: 8000
                    });
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    {article.category || 'Health'}
                  </span>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                
                <h3 className="font-bold text-gray-900 text-lg mb-3 group-hover:text-emerald-600 transition-colors duration-200 line-clamp-2">
                  {article.title}
                </h3>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {article.excerpt || 'Click to read this comprehensive health article with expert insights and practical tips.'}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-xs text-emerald-600 font-medium">
                      {article.source || 'Health News'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(article.publishDate).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {article.readTime || '5 min read'}
                    </span>
                    <span className="text-xs text-emerald-600 font-medium group-hover:text-emerald-700">
                      Read article →
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // No articles state
            <div className="col-span-3 text-center py-12">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9m0 0v6m0-6l3 3m-3-3l-3 3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No articles available</h3>
              <p className="text-sm text-gray-500">Check back later for fresh health insights and expert advice!</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>

    {/* Footer Status - Outside main container */}
    <footer className="w-full py-8 mt-8 border-t border-gray-200/30 bg-white/50 backdrop-blur-sm">
      <div className="mx-4 lg:mx-8 flex flex-col items-center space-y-3 text-center">
        <div className="flex items-center space-x-3 text-gray-600">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
          <p className="text-base font-medium">{firebaseStatus}</p>
          {user && (
            <span className="text-sm">
              • Connected as {getUserDisplayName().split('@')[0]}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          HealthAssist Dashboard • Secure & Private Health Monitoring
        </p>
      </div>
    </footer>
    </div>
  );
}
