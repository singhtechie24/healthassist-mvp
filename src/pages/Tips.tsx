import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { usdaApi, type NutritionTip } from '../services/usdaApi';
import { gnewsApi, type HealthArticle as GNewsHealthArticle } from '../services/gnewsApi';
import ToastService from '../services/toastService';

interface HealthTip {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'nutrition' | 'exercise' | 'mental-health' | 'sleep';
  icon: string;
  readTime?: string;
}

interface TipCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface UserTipPreference {
  id?: string;
  userId: string;
  tipId: string;
  action: 'saved' | 'deleted' | 'read' | 'completed';
  timestamp: Date;
}

interface UserStreakData {
  id?: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // YYYY-MM-DD format
  streakStartDate: string; // YYYY-MM-DD format
}

interface UserArticlePreference {
  id?: string;
  userId: string;
  articleId: string;
  action: 'saved' | 'completed' | 'bookmarked';
  timestamp: Date;
  readingTime?: number; // in seconds
}

interface HealthArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: 'general' | 'nutrition' | 'exercise' | 'mental-health' | 'sleep' | 'prevention';
  author: string;
  readTime: string;
  publishDate: string;
  tags: string[];
  featured?: boolean;
}

export default function Tips() {
  // Smart caching keys - defined first
  const CACHE_KEYS = useMemo(() => ({
    USDA_TIPS: 'healthapp_usda_tips',
    USDA_DATE: 'healthapp_usda_date',
    GNEWS_ARTICLES: 'healthapp_gnews_articles', 
    GNEWS_DATE: 'healthapp_gnews_date',
    CURRENT_PAGE: 'healthapp_current_page',
    CURRENT_CATEGORY: 'healthapp_current_category'
  }), []);

  // Helper functions for cache management - defined before useState
  const loadFromCache = (key: string): unknown => {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Failed to load from cache:', error);
      return null;
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const cached = loadFromCache(CACHE_KEYS.CURRENT_CATEGORY);
    return (cached as string) || 'all';
  });
  const [currentTip, setCurrentTip] = useState<HealthTip | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'readTime'>('default');
  const [contentType, setContentType] = useState<'tips' | 'articles' | 'progress'>(() => {
    const cached = loadFromCache(CACHE_KEYS.CURRENT_PAGE);
    return (cached as 'tips' | 'articles' | 'progress') || 'tips';
  });
  const [selectedArticle, setSelectedArticle] = useState<HealthArticle | null>(null);
  
  // User and preferences state
  const [user, setUser] = useState<User | null>(null);
  const [savedTips, setSavedTips] = useState<Set<string>>(new Set());
  const [deletedTips, setDeletedTips] = useState<Set<string>>(new Set());
  const [readTips, setReadTips] = useState<Set<string>>(new Set());
  const [completedTips, setCompletedTips] = useState<Set<string>>(new Set());
  const [completedArticles, setCompletedArticles] = useState<Set<string>>(new Set());
  const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());
  const [streakData, setStreakData] = useState<{currentStreak: number; longestStreak: number; lastActivityDate: string}>({
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: ''
  });
  const [usdaTips, setUsdaTips] = useState<NutritionTip[]>([]);
  const [loadingUsdaTips, setLoadingUsdaTips] = useState(false);
  const [gnewsArticles, setGnewsArticles] = useState<GNewsHealthArticle[]>([]);
  const [loadingGnewsArticles, setLoadingGnewsArticles] = useState(false);

  // Additional helper functions for cache management
  const isNewDay = (cachedDate: string): boolean => {
    const today = new Date().toDateString();
    return cachedDate !== today;
  };

  const getTodayString = (): string => {
    return new Date().toDateString();
  };

  const saveToCache = (key: string, data: unknown): void => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  };

  const clearCache = useCallback((): void => {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🧹 Cleared all cache data');
  }, [CACHE_KEYS]);

  // Debug: Make clearCache available in console
  useEffect(() => {
    // @ts-expect-error - Recharts types are sometimes incomplete
    window.clearHealthCache = clearCache;
    console.log('🔧 Debug: clearHealthCache() available in console');
  }, [clearCache]);

    // Health tips database - Mix of USDA API and fallback static tips
  // All content comes from USDA FoodData Central for accurate nutrition information
  const staticFallbackTips: HealthTip[] = useMemo(() => [
    {
      id: 'static-1',
      title: '🥬 Leafy Greens: Nature\'s Multivitamin',
      content: 'Spinach, kale, and other leafy greens are packed with iron, vitamin K, and folate. These nutrients support healthy blood, strong bones, and energy production. Add a handful to smoothies, salads, or cook them lightly to preserve nutrients.',
      category: 'nutrition',
      icon: '🥬',
      readTime: '2 min read'
    },
    {
      id: 'static-2', 
      title: '🐟 Omega-3 Rich Fish for Brain Health',
      content: 'Salmon, mackerel, and sardines contain omega-3 fatty acids that support brain function and heart health. These healthy fats reduce inflammation and may improve memory. Aim for 2-3 servings of fatty fish per week.',
      category: 'nutrition',
      icon: '🐟',
      readTime: '2 min read'
    },
    {
      id: 'static-3',
      title: '🥜 Nuts and Seeds: Healthy Fats and Protein',
      content: 'Almonds, walnuts, and chia seeds provide healthy fats, protein, and fiber. They help control hunger, support heart health, and provide sustained energy. A small handful makes a perfect snack.',
      category: 'nutrition', 
      icon: '🥜',
      readTime: '2 min read'
    },
    {
      id: 'static-4',
      title: '🫐 Antioxidant-Rich Berries',
      content: 'Blueberries, strawberries, and raspberries are loaded with antioxidants that fight free radicals and support immune function. They\'re also high in fiber and vitamin C. Add them to yogurt, oatmeal, or enjoy as a snack.',
      category: 'nutrition',
      icon: '🫐', 
      readTime: '2 min read'
    },
    {
      id: 'static-5',
      title: '💧 Stay Hydrated Throughout the Day',
      content: 'Proper hydration supports every function in your body. Aim for 8 glasses of water daily to maintain energy, support digestion, and keep skin healthy. Start your day with water and carry a bottle with you.',
      category: 'general',
      icon: '💧',
      readTime: '1 min read'
    }
  ], []);
  
  const healthTips: HealthTip[] = staticFallbackTips;

   // Educational articles database - Now 100% dynamic from GNews API
   // All articles come from GNews for fresh, real-time health content
   const healthArticles: HealthArticle[] = gnewsArticles;

   // Get daily tip (consistent per day) - uses USDA tips or static fallback
  const getDailyTip = useCallback((): HealthTip | null => {
    // Prefer USDA tips if available, otherwise use static tips
    let availableTips: HealthTip[] = [];
    
    if (usdaTips.length > 0) {
      // Convert USDA tips to HealthTip format for daily display
      availableTips = usdaTips.map(usdaTip => ({
        id: usdaTip.id,
        title: usdaTip.title,
        content: usdaTip.content,
        category: usdaTip.category === 'Vegetables' || usdaTip.category === 'Fruits' ? 'nutrition' as const : 'general' as const,
        icon: '🥗',
        readTime: '2 min read'
      }));
      console.log(`🌟 Using USDA tip for daily tip from ${availableTips.length} USDA tips`);
    } else {
      // Fallback to static tips
      availableTips = staticFallbackTips;
      console.log(`🌟 Using static fallback tip for daily tip from ${availableTips.length} static tips`);
    }
    
    if (availableTips.length === 0) return null;
    
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const tipIndex = dayOfYear % availableTips.length;
    return availableTips[tipIndex];
  }, [usdaTips, staticFallbackTips]);

  // Get random tip - uses USDA tips or static fallback
  const getRandomTip = (): HealthTip | null => {
    // Prefer USDA tips if available, otherwise use static tips
    let availableTips: HealthTip[] = [];
    
    if (usdaTips.length > 0) {
      // Convert USDA tips to HealthTip format
      availableTips = usdaTips.map(usdaTip => ({
        id: usdaTip.id,
        title: usdaTip.title,
        content: usdaTip.content,
        category: usdaTip.category === 'Vegetables' || usdaTip.category === 'Fruits' ? 'nutrition' as const : 'general' as const,
        icon: '🥗',
        readTime: '2 min read'
      }));
    } else {
      // Fallback to static tips
      availableTips = staticFallbackTips;
    }
    
    if (availableTips.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableTips.length);
    return availableTips[randomIndex];
  };

  // Calculate achievements and progress statistics
  const getProgressStats = () => {
    const totalTips = staticFallbackTips.length + usdaTips.length; // Static + USDA tips
    const totalArticles = healthArticles.length;
    const completedTipsCount = completedTips.size;
    const completedArticlesCount = completedArticles.size;
    const savedTipsCount = savedTips.size;
    const savedArticlesCount = savedArticles.size;
    const readTipsCount = readTips.size;

    // Calculate completion percentages
    const tipsCompletionRate = Math.round((completedTipsCount / totalTips) * 100);
    const articlesCompletionRate = Math.round((completedArticlesCount / totalArticles) * 100);
    const overallCompletionRate = Math.round(((completedTipsCount + completedArticlesCount) / (totalTips + totalArticles)) * 100);

    // Calculate achievements
    const achievements = [];
    
    if (completedTipsCount >= 1) achievements.push({ id: 'first_tip', title: 'First Step', description: 'Completed your first tip!', icon: '🎯', achieved: true });
    if (completedTipsCount >= 5) achievements.push({ id: 'five_tips', title: 'Getting Started', description: 'Completed 5 tips!', icon: '🌟', achieved: true });
    if (completedTipsCount >= 10) achievements.push({ id: 'ten_tips', title: 'Committed Learner', description: 'Completed 10 tips!', icon: '🏆', achieved: true });
    if (completedTipsCount >= totalTips) achievements.push({ id: 'all_tips', title: 'Tip Master', description: 'Completed all tips!', icon: '👑', achieved: true });
    
    if (completedArticlesCount >= 1) achievements.push({ id: 'first_article', title: 'Deep Learner', description: 'Completed your first article!', icon: '📚', achieved: true });
    if (completedArticlesCount >= 3) achievements.push({ id: 'article_reader', title: 'Knowledge Seeker', description: 'Completed 3 articles!', icon: '🎓', achieved: true });
    if (completedArticlesCount >= totalArticles) achievements.push({ id: 'all_articles', title: 'Scholar', description: 'Completed all articles!', icon: '🔬', achieved: true });
    
    if (savedTipsCount >= 5) achievements.push({ id: 'collector', title: 'Collector', description: 'Saved 5+ tips!', icon: '📌', achieved: true });
    if (savedTipsCount + savedArticlesCount >= 10) achievements.push({ id: 'curator', title: 'Curator', description: 'Saved 10+ items!', icon: '📋', achieved: true });

    // Recent activity (mock data for now)
    const recentActivity = [
      { action: 'completed', type: 'tip', title: 'Stay Hydrated Throughout the Day', date: new Date().toLocaleDateString() },
      { action: 'saved', type: 'article', title: 'The Science Behind Hydration', date: new Date().toLocaleDateString() },
    ];

    return {
      totalTips,
      totalArticles,
      completedTipsCount,
      completedArticlesCount,
      savedTipsCount,
      savedArticlesCount,
      readTipsCount,
      tipsCompletionRate,
      articlesCompletionRate,
      overallCompletionRate,
      achievements,
      recentActivity
    };
  };

  // Share achievement functionality
  const shareAchievement = async (achievement: {id: string; title: string; description: string; icon: string}) => {
    const shareText = `🏆 Achievement Unlocked! ${achievement.title}: ${achievement.description} #HealthJourney #HealthAssist`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Achievement: ${achievement.title}`,
          text: shareText,
          url: window.location.origin
        });
      } catch {
        // Fallback to clipboard
        copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  // Share overall progress
  const shareProgress = async () => {
    const stats = getProgressStats();
    const shareText = `📊 My Health Learning Progress: ${stats.overallCompletionRate}% complete! 💡 ${stats.completedTipsCount} tips & 📚 ${stats.completedArticlesCount} articles finished. 🏆 ${stats.achievements.length} achievements earned! #HealthJourney #HealthAssist`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Health Learning Progress',
          text: shareText,
          url: window.location.origin
        });
      } catch {
        copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  // Copy to clipboard fallback
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        ToastService.success('📋 Copied to clipboard! You can now paste and share your achievement.');
      }).catch(() => {
        // Fallback for older browsers
        fallbackCopyToClipboard(text);
      });
    } else {
      fallbackCopyToClipboard(text);
    }
  };

  // Fallback copy method for older browsers
  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      ToastService.success('📋 Copied to clipboard! You can now paste and share your achievement.');
    } catch {
      ToastService.error('❌ Unable to copy to clipboard. Please manually copy your achievement text.');
    }
    
    document.body.removeChild(textArea);
  };

  // Update reading streak
  const updateReadingStreak = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // If already updated today, don't update again
    if (streakData.lastActivityDate === today) return;

    let newCurrentStreak = 1;
    let newLongestStreak = streakData.longestStreak;

    // If last activity was yesterday, continue streak
    if (streakData.lastActivityDate === yesterday) {
      newCurrentStreak = streakData.currentStreak + 1;
    }

    // Update longest streak if current exceeds it
    if (newCurrentStreak > newLongestStreak) {
      newLongestStreak = newCurrentStreak;
    }

    const newStreakData = {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: today
    };

    setStreakData(newStreakData);

    // Save to Firebase
    try {
      const streakQuery = query(collection(db, 'userStreaks'), where('userId', '==', user.uid));
      const streakSnapshot = await getDocs(streakQuery);

      if (streakSnapshot.docs.length > 0) {
        // Update existing streak record
        const streakDoc = streakSnapshot.docs[0];
        await updateDoc(streakDoc.ref, {
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          lastActivityDate: today,
          timestamp: new Date()
        });
      } else {
        // Create new streak record
        await addDoc(collection(db, 'userStreaks'), {
          userId: user.uid,
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          lastActivityDate: today,
          streakStartDate: today,
          timestamp: new Date()
        });
      }

      console.log(`🔥 Reading streak updated: ${newCurrentStreak} days!`);
    } catch (error) {
      console.error('Error updating reading streak:', error);
    }
  };

  // Load reading streak data
  const loadReadingStreak = async (userId: string) => {
    try {
      const streakQuery = query(collection(db, 'userStreaks'), where('userId', '==', userId));
      const streakSnapshot = await getDocs(streakQuery);

      if (streakSnapshot.docs.length > 0) {
        const streakDoc = streakSnapshot.docs[0].data() as UserStreakData;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Check if streak should be reset (more than 1 day gap)
        let currentStreak = streakDoc.currentStreak;
        if (streakDoc.lastActivityDate !== today && streakDoc.lastActivityDate !== yesterday) {
          currentStreak = 0; // Reset streak if more than 1 day gap
        }

        setStreakData({
          currentStreak,
          longestStreak: streakDoc.longestStreak,
          lastActivityDate: streakDoc.lastActivityDate
        });

        console.log('🔥 Loaded reading streak:', {
          current: currentStreak,
          longest: streakDoc.longestStreak,
          lastActivity: streakDoc.lastActivityDate
        });
      }
    } catch (error) {
      console.error('Error loading reading streak:', error);
    }
  };

  // Load USDA nutrition tips with smart caching
  const loadUsdaTips = useCallback(async (forceRefresh: boolean = false) => {
    console.log('🚀 loadUsdaTips called with forceRefresh:', forceRefresh);
    console.log('📊 loadingUsdaTips state:', loadingUsdaTips);
    
    if (loadingUsdaTips) {
      console.log('⏸️ Already loading USDA tips, skipping...');
      return; // Don't reload if currently loading
    }

    // Check cache first
    const cachedTips = loadFromCache(CACHE_KEYS.USDA_TIPS);
    const cachedDate = loadFromCache(CACHE_KEYS.USDA_DATE);
    
    console.log('📦 Cache check - Tips:', !!cachedTips, 'Date:', cachedDate);
    
    if (!forceRefresh && cachedTips && cachedDate && !isNewDay(cachedDate as string)) {
      console.log('📦 Using cached USDA tips from', cachedDate, 'found', (cachedTips as NutritionTip[]).length, 'tips');
      setUsdaTips(cachedTips as NutritionTip[]);
      return;
    }

    setLoadingUsdaTips(true);
    console.log('🥗 Fetching fresh USDA nutrition tips...');

    try {
      console.log('📡 Calling usdaApi.generateNutritionTips()...');
      const tips = await usdaApi.generateNutritionTips();
      console.log(`🥗 USDA API returned ${tips.length} tips:`, tips.map(t => t.title));
      setUsdaTips(tips);
      
      // Save to cache
      saveToCache(CACHE_KEYS.USDA_TIPS, tips);
      saveToCache(CACHE_KEYS.USDA_DATE, getTodayString());
      
      console.log(`✅ Loaded ${tips.length} fresh USDA tips and saved to cache`);
    } catch (error) {
      console.error('❌ Error loading USDA tips:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      
      // Fallback to cache if available
      if (cachedTips) {
        console.log('📦 Falling back to cached USDA tips');
        setUsdaTips(cachedTips as NutritionTip[]);
      } else {
        console.log('⚠️ No cached tips available, daily tip will use fallback');
        setUsdaTips([]); // Ensure empty array
      }
    } finally {
      setLoadingUsdaTips(false);
      console.log('🏁 loadUsdaTips completed');
    }
  }, [loadingUsdaTips, CACHE_KEYS.USDA_TIPS, CACHE_KEYS.USDA_DATE]);

  // Load GNews health articles with smart caching
  const loadGnewsArticles = useCallback(async (forceRefresh: boolean = false) => {
    console.log('🔄 loadGnewsArticles called with forceRefresh:', forceRefresh);
    if (loadingGnewsArticles) {
      console.log('⏳ Already loading GNews articles, skipping...');
      return; // Don't reload if currently loading
    }

    // Check cache first
    const cachedArticles = loadFromCache(CACHE_KEYS.GNEWS_ARTICLES);
    const cachedDate = loadFromCache(CACHE_KEYS.GNEWS_DATE);
    
    // Use cached articles if available and not forcing refresh
    if (!forceRefresh && cachedArticles && Array.isArray(cachedArticles) && cachedArticles.length > 0) {
      if (cachedDate && !isNewDay(cachedDate as string)) {
        console.log('📦 Using cached GNews articles from', cachedDate, '- found', (cachedArticles as GNewsHealthArticle[]).length, 'articles');
        setGnewsArticles(cachedArticles as GNewsHealthArticle[]);
        return;
      } else {
        console.log('📅 Cache is from a different day, but not forcing refresh...');
        // Still use cache if not forcing refresh, even if from different day
        setGnewsArticles(cachedArticles as GNewsHealthArticle[]);
        return;
      }
    }

    setLoadingGnewsArticles(true);
    console.log('📰 Fetching fresh health articles from GNews...');

    try {
      const articles = await gnewsApi.fetchHealthArticles(8); // Get 8 articles
      setGnewsArticles(articles);
      
      // Save to cache
      saveToCache(CACHE_KEYS.GNEWS_ARTICLES, articles);
      saveToCache(CACHE_KEYS.GNEWS_DATE, getTodayString());
      
      console.log(`✅ Loaded ${articles.length} fresh health articles from GNews`);
    } catch (error) {
      console.error('Error loading GNews articles:', error);
      
      // Fallback to cache if available
      if (cachedArticles) {
        console.log('📦 Falling back to cached GNews articles');
        setGnewsArticles(cachedArticles as GNewsHealthArticle[]);
      }
    } finally {
      setLoadingGnewsArticles(false);
    }
  }, [loadingGnewsArticles, CACHE_KEYS.GNEWS_ARTICLES, CACHE_KEYS.GNEWS_DATE]);

  // Handler for refresh buttons
  const handleRefreshArticles = useCallback(() => {
    console.log('🔄 Manual refresh articles requested');
    setGnewsArticles([]);
    loadGnewsArticles(true); // Force refresh
  }, [loadGnewsArticles]);

  const handleRefreshTips = useCallback(() => {
    console.log('🔄 Manual refresh tips requested');
    setUsdaTips([]);
    loadUsdaTips(true); // Force refresh
  }, [loadUsdaTips]);

  // Handle tip actions
  const handleSaveTip = async (tipId: string) => {
    if (savedTips.has(tipId)) {
      // Unsave tip
      setSavedTips(prev => {
        const newSet = new Set(prev);
        newSet.delete(tipId);
        return newSet;
      });
      // Remove from Firebase
      await removeTipPreference(tipId, 'saved');
    } else {
      // Save tip
      setSavedTips(prev => new Set(prev).add(tipId));
      await saveTipPreference(tipId, 'saved');
    }
  };

  // Remove tip preference from Firebase
  const removeTipPreference = async (tipId: string, action: 'saved' | 'deleted' | 'read') => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'tipPreferences'), 
        where('userId', '==', user.uid),
        where('tipId', '==', tipId),
        where('action', '==', action)
      );
      const querySnapshot = await getDocs(q);
      
      // Delete existing preferences
      await Promise.all(querySnapshot.docs.map(doc => deleteDoc(doc.ref)));
      
      console.log(`🗑️ Removed tip ${action}: ${tipId}`);
    } catch (error) {
      console.error('Error removing tip preference:', error);
    }
  };

  // Only unsave tips (remove from saved), don't actually "delete" hardcoded tips
  const handleUnsaveTip = async (tipId: string) => {
    // Remove from saved tips only
    setSavedTips(prev => {
      const newSet = new Set(prev);
      newSet.delete(tipId);
      return newSet;
    });
    
    // Remove saved preference from Firebase (but keep read status)
    await removeTipPreference(tipId, 'saved');
    console.log(`📤 Unsaved tip: ${tipId}`);
  };

  const handleMarkAsRead = async (tipId: string) => {
    if (!readTips.has(tipId)) {
      setReadTips(prev => new Set(prev).add(tipId));
      await saveTipPreference(tipId, 'read');
    }
  };

  // Mark tip as completed
  const handleMarkTipCompleted = async (tipId: string) => {
    if (!completedTips.has(tipId)) {
      setCompletedTips(prev => new Set(prev).add(tipId));
      await saveTipPreference(tipId, 'completed');
      await updateReadingStreak(); // Update streak when completing content
      console.log(`✅ Marked tip as completed: ${tipId}`);
    }
  };

  // Mark article as completed  
  const handleMarkArticleCompleted = async (articleId: string, readingTime?: number) => {
    if (!completedArticles.has(articleId)) {
      setCompletedArticles(prev => new Set(prev).add(articleId));
      await saveArticlePreference(articleId, 'completed', readingTime);
      await updateReadingStreak(); // Update streak when completing content
      console.log(`✅ Marked article as completed: ${articleId}`);
    }
  };

  // Save/unsave article
  const handleSaveArticle = async (articleId: string) => {
    if (savedArticles.has(articleId)) {
      // Unsave article
      setSavedArticles(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      // Remove from Firebase
      await removeArticlePreference(articleId, 'saved');
    } else {
      // Save article
      setSavedArticles(prev => new Set(prev).add(articleId));
      await saveArticlePreference(articleId, 'saved');
    }
  };

  // Remove article preference from Firebase
  const removeArticlePreference = async (articleId: string, action: 'saved' | 'completed' | 'bookmarked') => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'articlePreferences'), 
        where('userId', '==', user.uid),
        where('articleId', '==', articleId),
        where('action', '==', action)
      );
      const querySnapshot = await getDocs(q);
      
      // Delete existing preferences
      await Promise.all(querySnapshot.docs.map(doc => deleteDoc(doc.ref)));
      
      console.log(`🗑️ Removed article ${action}: ${articleId}`);
    } catch (error) {
      console.error('Error removing article preference:', error);
    }
  };

  // Filter and sort tips based on category, search, and sort preferences
  const filteredTips = (() => {
    // Start with static fallback tips (always available)
    let tips = [...healthTips];
    
    // Add USDA tips if loaded (these are premium dynamic tips)
    if (usdaTips.length > 0) {
      console.log(`🔄 Adding ${usdaTips.length} USDA tips to ${tips.length} static tips`);
      const convertedUsdaTips: HealthTip[] = usdaTips.map(usdaTip => {
        // Map USDA categories to our defined categories
        let category: "general" | "nutrition" | "exercise" | "mental-health" | "sleep" = "nutrition";
        if (usdaTip.category === 'Protein' || usdaTip.category === 'Vegetables' || usdaTip.category === 'Fruits') {
          category = "nutrition";
        } else if (usdaTip.category === 'Exercise') {
          category = "exercise";
        } else {
          category = "general";
        }
        
        return {
          id: usdaTip.id,
          title: usdaTip.title,
          content: usdaTip.content,
          category,
          icon: '🥗', // Default icon for USDA tips
          readTime: '2 min read', // Default read time for USDA tips
          source: 'USDA' // Add source indicator
        };
      });
      tips.push(...convertedUsdaTips);
    } else {
      console.log(`📋 Using ${tips.length} static fallback tips (USDA tips not loaded)`);
    }
    
    console.log('🔍 Filtering - Selected category:', selectedCategory);
    console.log('🔍 Search query:', searchQuery);
    console.log('🔍 Total tips available:', tips.length, `(${usdaTips.length} from USDA)`);
    
    // Filter by category
    if (selectedCategory === 'saved') {
      tips = tips.filter(tip => savedTips.has(tip.id));
      console.log('🔍 Saved tips filtered:', tips.length);
    } else if (selectedCategory !== 'all') {
      tips = tips.filter(tip => tip.category === selectedCategory);
      console.log(`🔍 Category '${selectedCategory}' filtered:`, tips.length);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      tips = tips.filter(tip => 
        tip.title.toLowerCase().includes(query) ||
        tip.content.toLowerCase().includes(query) ||
        tip.category.toLowerCase().includes(query)
      );
      console.log('🔍 Search filtered:', tips.length);
    }
    
    // Sort tips
    if (sortBy === 'title') {
      tips = [...tips].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'readTime') {
      tips = [...tips].sort((a, b) => {
        const aTime = parseInt(a.readTime?.split(' ')[0] || '0');
        const bTime = parseInt(b.readTime?.split(' ')[0] || '0');
        return aTime - bTime;
      });
    }
    
    console.log('🔍 Final tips:', tips.length);
    return tips;
  })();

  // Filter articles based on category and search
  const filteredArticles = (() => {
    let articles = healthArticles;
    
    console.log('📚 Filtering articles - Selected category:', selectedCategory);
    console.log('📚 Search query:', searchQuery);
    console.log('📚 Total articles available:', articles.length);
    
    // Filter by category
    if (selectedCategory === 'saved') {
      articles = articles.filter(article => savedArticles.has(article.id));
      console.log('📚 Saved articles filtered:', articles.length);
    } else if (selectedCategory !== 'all') {
      articles = articles.filter(article => article.category === selectedCategory);
      console.log(`📚 Category '${selectedCategory}' filtered:`, articles.length);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      articles = articles.filter(article => 
        article.title.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query) ||
        article.tags.some(tag => tag.toLowerCase().includes(query))
      );
      console.log('📚 Search filtered articles:', articles.length);
    }
    
    // Sort articles
    if (sortBy === 'title') {
      articles = [...articles].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'readTime') {
      articles = [...articles].sort((a, b) => {
        const aTime = parseInt(a.readTime.split(' ')[0] || '0');
        const bTime = parseInt(b.readTime.split(' ')[0] || '0');
        return aTime - bTime;
      });
    }
    
    console.log('📚 Final articles:', articles.length);
    return articles;
  })();

  // Load user tip preferences from Firebase
  const loadUserPreferences = useCallback(async (userId: string) => {
    try {
      // Load tip preferences
      const tipQuery = query(collection(db, 'tipPreferences'), where('userId', '==', userId));
      const tipSnapshot = await getDocs(tipQuery);
      
      const saved = new Set<string>();
      const deleted = new Set<string>();
      const read = new Set<string>();
      const completed = new Set<string>();
      
      console.log('📚 Loading tip preferences, found docs:', tipSnapshot.docs.length);
      
      tipSnapshot.docs.forEach(doc => {
        const pref = doc.data() as UserTipPreference;
        if (pref.action === 'saved') saved.add(pref.tipId);
        if (pref.action === 'deleted') deleted.add(pref.tipId);
        if (pref.action === 'read') read.add(pref.tipId);
        if (pref.action === 'completed') completed.add(pref.tipId);
      });
      
      setSavedTips(saved);
      setDeletedTips(deleted);
      setReadTips(read);
      setCompletedTips(completed);
      
      // Load article preferences
      const articleQuery = query(collection(db, 'articlePreferences'), where('userId', '==', userId));
      const articleSnapshot = await getDocs(articleQuery);
      
      const savedArticlesSet = new Set<string>();
      const completedArticlesSet = new Set<string>();
      
      console.log('📖 Loading article preferences, found docs:', articleSnapshot.docs.length);
      
      articleSnapshot.docs.forEach(doc => {
        const pref = doc.data() as UserArticlePreference;
        if (pref.action === 'saved') savedArticlesSet.add(pref.articleId);
        if (pref.action === 'completed') completedArticlesSet.add(pref.articleId);
      });
      
      setSavedArticles(savedArticlesSet);
      setCompletedArticles(completedArticlesSet);
      
      console.log('✅ Loaded all preferences:');
      console.log('💡 Tips - Saved:', saved.size, 'Read:', read.size, 'Completed:', completed.size);
      console.log('📚 Articles - Saved:', savedArticlesSet.size, 'Completed:', completedArticlesSet.size);
      
      // Load reading streak data
      await loadReadingStreak(userId);
      
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }, []);

  // Save tip preference to Firebase
  const saveTipPreference = async (tipId: string, action: 'saved' | 'deleted' | 'read' | 'completed') => {
    if (!user) {
      console.log('❌ No user logged in, cannot save preference');
      return;
    }
    
    try {
      console.log(`🔄 Saving tip preference: ${action} for tip ${tipId}`);
      
      // Remove existing preference of same type for this tip
      const q = query(
        collection(db, 'tipPreferences'), 
        where('userId', '==', user.uid),
        where('tipId', '==', tipId),
        where('action', '==', action)
      );
      const existingDocs = await getDocs(q);
      
      // Delete existing preferences
      if (existingDocs.docs.length > 0) {
        await Promise.all(existingDocs.docs.map(doc => deleteDoc(doc.ref)));
        console.log(`🗑️ Removed ${existingDocs.docs.length} existing preferences`);
      }
      
      // Add new preference
      await addDoc(collection(db, 'tipPreferences'), {
        userId: user.uid,
        tipId,
        action,
        timestamp: new Date()
      });
      
      console.log(`✅ Successfully saved tip ${action}: ${tipId}`);
    } catch (error) {
      console.error(`❌ Error saving tip preference:`, error);
      ToastService.error(`Error saving tip preference: ${error}`);
    }
  };

  // Save article preference to Firebase
  const saveArticlePreference = async (articleId: string, action: 'saved' | 'completed' | 'bookmarked', readingTime?: number) => {
    if (!user) {
      console.log('❌ No user logged in, cannot save article preference');
      return;
    }
    
    try {
      console.log(`🔄 Saving article preference: ${action} for article ${articleId}`);
      
      // Remove existing preference of same type for this article
      const q = query(
        collection(db, 'articlePreferences'), 
        where('userId', '==', user.uid),
        where('articleId', '==', articleId),
        where('action', '==', action)
      );
      const existingDocs = await getDocs(q);
      
      // Delete existing preferences
      if (existingDocs.docs.length > 0) {
        await Promise.all(existingDocs.docs.map(doc => deleteDoc(doc.ref)));
        console.log(`🗑️ Removed ${existingDocs.docs.length} existing article preferences`);
      }
      
      // Add new preference
      const data: {
        userId: string;
        articleId: string;
        action: string;
        timestamp: Date;
        readingTime?: number;
      } = {
        userId: user.uid,
        articleId,
        action,
        timestamp: new Date()
      };
      
      if (readingTime) {
        data.readingTime = readingTime;
      }
      
      await addDoc(collection(db, 'articlePreferences'), data);
      
      console.log(`✅ Successfully saved article ${action}: ${articleId}`);
    } catch (error) {
      console.error(`❌ Error saving article preference:`, error);
      ToastService.error(`Error saving article preference: ${error}`);
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserPreferences(currentUser.uid);
      } else {
        // Reset preferences if no user
        setSavedTips(new Set());
        setDeletedTips(new Set());
        setReadTips(new Set());
        setCompletedTips(new Set());
        setCompletedArticles(new Set());
        setSavedArticles(new Set());
        setStreakData({ currentStreak: 0, longestStreak: 0, lastActivityDate: '' });
        
        // Clear cache on logout to ensure fresh data for new user
        clearCache();
        setUsdaTips([]);
        setGnewsArticles([]);
        
        console.log('🔄 User logged out, cleared all preferences and cache');
      }
    });

    return () => unsubscribe();
  }, [loadUserPreferences, clearCache]);

  // Load USDA tips on component mount
  useEffect(() => {
    console.log('🚀 Component mounted, loading USDA tips...');
    loadUsdaTips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Debug functions - after loadUsdaTips is defined
  useEffect(() => {
    // @ts-expect-error - Debug functions
    window.testUSDAAPI = async () => {
      console.log('🧪 Manual USDA API test starting...');
      try {
        const result = await usdaApi.generateNutritionTips();
        console.log('✅ USDA API test result:', result);
        return result;
      } catch (error) {
        console.error('❌ USDA API test failed:', error);
        return error;
      }
    };
    // @ts-expect-error - Debug functions  
    window.forceLoadUSDA = () => {
      console.log('🔄 Force loading USDA tips...');
      loadUsdaTips(true);
    };
    console.log('🔧 Additional debug functions available:');
    console.log('  - testUSDAAPI() - Test USDA API directly');
    console.log('  - forceLoadUSDA() - Force reload USDA tips');
  }, [loadUsdaTips]);

  // Load GNews articles when Articles tab is accessed (but respect daily cache)
  useEffect(() => {
    console.log('🔧 useEffect for GNews articles triggered, contentType:', contentType);
    if (contentType === 'articles' && gnewsArticles.length === 0) {
      console.log('📰 Articles tab active and no articles loaded, checking for cached articles...');
      // Only load if we don't already have articles
      loadGnewsArticles(false); // Don't force refresh, respect cache
    } else if (contentType === 'articles' && gnewsArticles.length > 0) {
      console.log('📰 Articles tab active but already have', gnewsArticles.length, 'articles loaded');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, gnewsArticles.length]); // Add gnewsArticles.length to prevent unnecessary calls (loadGnewsArticles intentionally excluded)

  // Save page state to localStorage
  useEffect(() => {
    saveToCache(CACHE_KEYS.CURRENT_PAGE, contentType);
  }, [contentType, CACHE_KEYS.CURRENT_PAGE]);

  useEffect(() => {
    saveToCache(CACHE_KEYS.CURRENT_CATEGORY, selectedCategory);
  }, [selectedCategory, CACHE_KEYS.CURRENT_CATEGORY]);

  // Set daily tip after USDA tips are loaded
  useEffect(() => {
    console.log('🔧 Daily tip useEffect triggered');
    console.log('📊 usdaTips.length:', usdaTips.length);
    console.log('📊 loadingUsdaTips:', loadingUsdaTips);
    
    if (usdaTips.length > 0) {
      const dailyTip = getDailyTip();
      setCurrentTip(dailyTip);
      console.log('✅ Daily tip set from USDA:', dailyTip?.title);
      console.log('📋 Available USDA tips:', usdaTips.map(tip => tip.title));
    } else {
      console.log('⏳ Waiting for USDA tips to load...');
      console.log('📊 Current state - Loading:', loadingUsdaTips, 'Tips count:', usdaTips.length);
      
      // Set a fallback tip if no USDA tips after 8 seconds (increased from 5)
      const fallbackTimer = setTimeout(() => {
        console.log('⏰ Fallback timer triggered');
        console.log('📊 Final check - USDA tips:', usdaTips.length, 'Loading:', loadingUsdaTips);
        
        if (usdaTips.length === 0) {
          console.log('⚠️ USDA tips failed to load, using fallback tip');
          const fallbackTip: HealthTip = {
            id: 'fallback-daily',
            title: '💧 Stay Hydrated for Better Health',
            content: 'Drinking adequate water throughout the day supports every function in your body. Aim for 8 glasses of water daily to maintain energy levels, support digestion, and keep your skin healthy. Start your day with a glass of water to kickstart your metabolism!',
            category: 'general',
            icon: '💧',
            readTime: '1 min read'
          };
          setCurrentTip(fallbackTip);
        }
      }, 8000);
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [usdaTips, getDailyTip, loadingUsdaTips]); // Added loadingUsdaTips to dependencies

  // Health tip categories
  const categories: TipCategory[] = [
    { id: 'all', name: 'All Tips', icon: '💡', description: 'View all health tips' },
    ...(user ? [{ id: 'saved', name: 'Saved Tips', icon: '❤️', description: `Your saved favorites (${savedTips.size})` }] : []),
    { id: 'general', name: 'General Health', icon: '🏥', description: 'Overall wellness tips' },
    { id: 'nutrition', name: 'Nutrition', icon: '🥗', description: 'Healthy eating advice' },
    { id: 'exercise', name: 'Exercise', icon: '💪', description: 'Fitness and movement' },
    { id: 'mental-health', name: 'Mental Health', icon: '🧠', description: 'Emotional wellbeing' },
    { id: 'sleep', name: 'Sleep', icon: '😴', description: 'Better sleep habits' }
  ];

  // Debug logging
  console.log('User:', user ? 'logged in' : 'not logged in');
  console.log('Categories:', categories.length);
  console.log('Saved tips count:', savedTips.size);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-green-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-500 to-blue-600 rounded-full mb-6 shadow-lg animate-pulse">
            <span className="text-3xl">
              {contentType === 'tips' ? '💡' : contentType === 'articles' ? '📚' : '📊'}
            </span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
            {contentType === 'tips' ? 'Health Tips' : contentType === 'articles' ? 'Health Articles' : 'Progress Dashboard'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            {contentType === 'tips' 
              ? 'Daily health tips and educational content to support your wellness journey'
              : contentType === 'articles'
              ? 'In-depth articles and guides for comprehensive health education'
              : 'Track your learning progress, achievements, and health journey insights'
            }
          </p>
          
          {user && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/20 dark:border-gray-700/20 rounded-3xl shadow-xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-xl">👤</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Welcome back, {user.email?.split('@')[0] || 'User'}!</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Your learning progress</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-2xl p-4 border border-green-200 dark:border-green-700">
                  <h4 className="text-sm font-bold text-green-800 dark:text-green-200 mb-2">💡 Tips Progress</h4>
                  <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <div>❤️ {savedTips.size} saved • 📖 {readTips.size} read</div>
                    <div>✅ {completedTips.size} completed</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-700">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">📚 Articles Progress</h4>
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <div>✅ {completedArticles.size} completed</div>
                    <div>🔖 {savedArticles.size} saved</div>
                  </div>
                </div>
              </div>
              
              {deletedTips.size > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button 
                    onClick={async () => {
                      if (confirm('This will clear corrupted "deleted tips" data. Continue?')) {
                        // Only clear local state, don't delete from Firebase
                        setDeletedTips(new Set());
                        
                        // Clear corrupted "deleted" preferences from Firebase
                        if (user) {
                          try {
                            const q = query(
                              collection(db, 'tipPreferences'), 
                              where('userId', '==', user.uid),
                              where('action', '==', 'deleted')
                            );
                            const querySnapshot = await getDocs(q);
                            
                            await Promise.all(querySnapshot.docs.map(doc => deleteDoc(doc.ref)));
                            console.log(`🗑️ Cleared ${querySnapshot.docs.length} corrupted deleted preferences`);
                          } catch (error) {
                            console.error('Error clearing deleted preferences:', error);
                          }
                        }
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  >
                    🔄 Clear Corrupted Data
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Type Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/20 dark:border-gray-700/20 rounded-3xl shadow-xl p-2 flex">
            <button
              onClick={() => {
                setContentType('tips');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className={`px-8 py-4 rounded-2xl font-semibold transition-all duration-300 ${
                contentType === 'tips'
                  ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              💡 Quick Tips
            </button>
            <button
              onClick={() => {
                setContentType('articles');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className={`px-8 py-4 rounded-2xl font-semibold transition-all duration-300 ${
                contentType === 'articles'
                  ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              📚 Articles
            </button>
            <button
              onClick={() => {
                setContentType('progress');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className={`px-8 py-4 rounded-2xl font-semibold transition-all duration-300 ${
                contentType === 'progress'
                  ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              📊 Progress
            </button>
          </div>
        </div>

      {contentType === 'tips' ? (
        <>
          {/* Categories */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`group p-6 rounded-3xl border transition-all duration-300 text-left transform hover:scale-105 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 border-green-200 dark:border-green-700 shadow-xl scale-105'
                    : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-white/20 dark:border-gray-700/20 hover:bg-white/90 dark:hover:bg-gray-800/90 shadow-lg hover:shadow-xl'
                }`}
              >
                <div className={`text-3xl mb-4 transition-transform duration-300 ${
                  selectedCategory === category.id ? 'transform scale-110' : 'group-hover:transform group-hover:scale-110'
                }`}>
                  {category.icon}
                </div>
                <h3 className={`font-bold text-lg mb-2 ${
                  selectedCategory === category.id
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {category.name}
                </h3>
                <p className={`text-sm ${
                  selectedCategory === category.id
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {category.description}
                </p>
              </button>
            ))}
          </div>

          {/* USDA Loading Indicator */}
          {loadingUsdaTips && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-green-200 dark:border-green-700 rounded-3xl shadow-xl p-6 mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                  <div className="animate-spin text-white">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-800 dark:text-green-200">🥗 Loading USDA Nutrition Tips</h3>
                  <p className="text-sm text-green-600 dark:text-green-400">Fetching fresh health content from the US Department of Agriculture...</p>
                </div>
              </div>
            </div>
          )}

          {/* USDA Success Indicator */}
          {!loadingUsdaTips && usdaTips.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-green-200 dark:border-green-700 rounded-3xl shadow-xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-xl text-white">✅</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-200">
                      🥗 {usdaTips.length} Fresh USDA Tips Loaded
                    </h3>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Nutrition content from the US Department of Agriculture
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRefreshTips}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}

          {/* Search and Filter Controls */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/20 dark:border-gray-700/20 rounded-3xl shadow-xl p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search Bar */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search tips by title, content, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-12 pr-12 py-4 border border-gray-300 dark:border-gray-600 rounded-2xl leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Sort Dropdown */}
              <div className="w-full lg:w-64">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'title' | 'readTime')}
                  className="block w-full px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-300"
                >
                  <option value="default">📋 Default Order</option>
                  <option value="title">🔤 Sort by Title</option>
                  <option value="readTime">⏱️ Sort by Read Time</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="flex items-center justify-center lg:justify-start">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-2xl px-6 py-4 border border-green-200 dark:border-green-700">
                  <div className="text-sm font-bold text-green-800 dark:text-green-200">
                    📊 {filteredTips.length} {filteredTips.length === 1 ? 'tip' : 'tips'} found
                  </div>
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {(searchQuery || selectedCategory !== 'all' || sortBy !== 'default') && (
              <div className="mt-6 flex flex-wrap gap-3">
                {selectedCategory !== 'all' && (
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                    {categories.find(cat => cat.id === selectedCategory)?.name}
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700">
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery('')}
                      className="ml-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )}
                {sortBy !== 'default' && (
                  <span className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700">
                    Sorted by {sortBy}
                    <button
                      onClick={() => setSortBy('default')}
                      className="ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Daily Tip Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/20 dark:border-gray-700/20 rounded-3xl shadow-2xl p-8 mb-8 transition-all duration-300 hover:shadow-3xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-xl">🌟</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Health Tip</h2>
              </div>
              <button
                onClick={() => setCurrentTip(getRandomTip())}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🎲 Random Tip
              </button>
            </div>
            
            {currentTip ? (
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start space-x-6">
                  <div className="text-4xl">{currentTip.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{currentTip.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">{currentTip.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                          {categories.find(cat => cat.id === currentTip.category)?.name || currentTip.category}
                        </span>
                        {readTips.has(currentTip.id) && (
                          <span className="text-sm text-green-600 dark:text-green-400 font-semibold">✓ Read</span>
                        )}
                        {completedTips.has(currentTip.id) && (
                          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">✅ Completed</span>
                        )}
                        {currentTip.readTime && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">📖 {currentTip.readTime}</span>
                        )}
                        <span className="inline-flex items-center px-3 py-1 text-sm font-semibold bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 rounded-full border border-green-200 dark:border-green-700">
                          🥗 USDA
                        </span>
                      </div>
                      
                      {/* Daily tip action buttons */}
                      <div className="flex items-center space-x-3">
                        {!readTips.has(currentTip.id) && (
                          <button 
                            onClick={() => handleMarkAsRead(currentTip.id)}
                            className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-300"
                          >
                            Mark as Read
                          </button>
                        )}
                        
                        {user && (
                          <>
                            <button
                              onClick={() => handleSaveTip(currentTip.id)}
                              className={`p-3 rounded-xl transition-all duration-300 ${
                                savedTips.has(currentTip.id)
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500'
                              }`}
                              title={savedTips.has(currentTip.id) ? 'Unsave tip' : 'Save tip'}
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                              </svg>
                            </button>
                            
                            {!completedTips.has(currentTip.id) && (
                              <button
                                onClick={() => handleMarkTipCompleted(currentTip.id)}
                                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-all duration-300"
                                title="Mark as completed"
                              >
                                ✅ Complete
                              </button>
                            )}
                            
                            {completedTips.has(currentTip.id) && (
                              <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-semibold">
                                ✅ Completed
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-950 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-300 text-center py-8">
                  Loading daily tip...
                </p>
              </div>
            )}
          </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {selectedCategory === 'all' ? 'All Health Tips' : categories.find(cat => cat.id === selectedCategory)?.name}
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            ({filteredTips.length} tips)
          </span>
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Grid View"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="List View"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
            </svg>
          </button>
        </div>
      </div>

          {/* Tips Display */}
          <div className={viewMode === 'grid' ? 'grid gap-8 md:grid-cols-2 lg:grid-cols-2' : 'space-y-6'}>
            {filteredTips.map((tip) => (
              <div key={tip.id} className={`group bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/20 dark:border-gray-700/20 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 ${
                viewMode === 'grid' ? 'p-8' : 'p-6'
              }`}>
                <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'items-start space-x-6'}`}>
                  {/* Icon and Title */}
                  <div className={`flex items-start ${viewMode === 'grid' ? 'justify-between mb-6' : 'flex-shrink-0'}`}>
                    <div className="flex items-center space-x-4">
                      <div className={`text-4xl transition-transform duration-300 ${viewMode === 'grid' ? 'group-hover:scale-110' : ''}`}>{tip.icon}</div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{tip.title}</h3>
                        <div className="flex items-center space-x-3 text-sm">
                          {tip.readTime && (
                            <span className="text-gray-500 dark:text-gray-400">📖 {tip.readTime}</span>
                          )}
                          {(tip as HealthTip & {source?: string}).source === 'USDA' && (
                            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 rounded-full border border-green-200 dark:border-green-700">
                              🥗 USDA
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <p className={`text-gray-600 dark:text-gray-300 leading-relaxed mb-6 ${
                      viewMode === 'list' ? 'text-sm' : 'text-base'
                    }`}>
                      {viewMode === 'list' ? `${tip.content.substring(0, 120)}...` : tip.content}
                    </p>
                    
                    {/* Category badge and status */}
                    <div className={`${viewMode === 'grid' ? 'mb-6' : 'mb-4'} flex items-center justify-between`}>
                      <div className="flex items-center space-x-3">
                        <span className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                          {categories.find(cat => cat.id === tip.category)?.name || tip.category}
                        </span>
                        {readTips.has(tip.id) && (
                          <span className="text-sm text-green-600 dark:text-green-400 font-semibold">✓ Read</span>
                        )}
                        {completedTips.has(tip.id) && (
                          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">✅ Completed</span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {!readTips.has(tip.id) && (
                          <button 
                            onClick={() => handleMarkAsRead(tip.id)}
                            className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-300"
                          >
                            {viewMode === 'list' ? 'Read More' : 'Mark as Read'}
                          </button>
                        )}
                        
                        {user && (
                          <>
                            <button
                              onClick={() => handleSaveTip(tip.id)}
                              className={`p-3 rounded-xl transition-all duration-300 ${
                                savedTips.has(tip.id)
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500'
                              }`}
                              title={savedTips.has(tip.id) ? 'Unsave tip' : 'Save tip'}
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                              </svg>
                            </button>
                            
                            {!completedTips.has(tip.id) && (
                              <button
                                onClick={() => handleMarkTipCompleted(tip.id)}
                                className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-500 transition-all duration-300"
                                title="Mark as completed"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            
                            {/* Only show delete button for saved tips in the "Saved Tips" category */}
                            {selectedCategory === 'saved' && savedTips.has(tip.id) && (
                              <button
                                onClick={() => handleUnsaveTip(tip.id)}
                                className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all duration-300"
                                title="Remove from saved tips"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 102 0v3a1 1 0 11-2 0V9zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V9z" clipRule="evenodd"/>
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

      {/* No tips message */}
      {filteredTips.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">
            {selectedCategory === 'saved' ? '❤️' : '🔍'}
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {selectedCategory === 'saved' ? 'No saved tips yet' : 'No tips found'}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {selectedCategory === 'saved' 
              ? 'Start saving tips by clicking the heart ❤️ button on tips you like!'
              : 'Try selecting a different category to view health tips.'
            }
                     </p>
         </div>
       )}
        </>
      ) : contentType === 'articles' ? (
        <>
          {/* Article Categories */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-4 rounded-lg border transition-colors text-left ${
                  selectedCategory === category.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="text-2xl mb-2">{category.icon}</div>
                <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
              </button>
            ))}
          </div>

          {/* GNews Loading Indicator */}
          {loadingGnewsArticles && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3">
                <div className="animate-spin text-blue-600 dark:text-blue-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">📰 Loading Health Articles</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Fetching latest health news from GNews.io...</p>
                </div>
              </div>
            </div>
          )}

          {/* GNews Success Indicator */}
          {!loadingGnewsArticles && gnewsArticles.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-blue-600 dark:text-blue-400">✅</div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      📰 {gnewsArticles.length} Fresh Health Articles Loaded
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Real-time health news from global sources via GNews.io
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRefreshArticles}
                  className="px-3 py-1 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}

          {/* Article Search and Filter Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Bar */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search articles by title, content, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Sort Dropdown */}
              <div className="w-full md:w-48">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'title' | 'readTime')}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="default">📋 Default Order</option>
                  <option value="title">🔤 Sort by Title</option>
                  <option value="readTime">⏱️ Sort by Read Time</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                📊 {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'} found
              </div>
            </div>

            {/* Active Filters */}
            {(searchQuery || selectedCategory !== 'all' || sortBy !== 'default') && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCategory !== 'all' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                    {categories.find(cat => cat.id === selectedCategory)?.name}
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      ×
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery('')}
                      className="ml-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    >
                      ×
                    </button>
                  </span>
                )}
                {sortBy !== 'default' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                    Sorted by {sortBy}
                    <button
                      onClick={() => setSortBy('default')}
                      className="ml-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Articles Section */}
          <div className="space-y-6">
            {/* Featured Articles */}
            {selectedCategory === 'all' && !searchQuery && filteredArticles.some(article => article.featured) && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">🌟 Featured Articles</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {filteredArticles.filter(article => article.featured).map((article) => (
                    <div
                      key={article.id}
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedArticle(article)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          {categories.find(cat => cat.id === article.category)?.name || article.category}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{article.readTime}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{article.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{article.excerpt}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>By {article.author}</span>
                        <span>{new Date(article.publishDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Articles */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                📖 {selectedCategory === 'saved' ? 'Saved Articles' : selectedCategory === 'all' ? 'All Articles' : categories.find(cat => cat.id === selectedCategory)?.name + ' Articles'}
              </h2>
              <div className="space-y-4">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {categories.find(cat => cat.id === article.category)?.name || article.category}
                        </span>
                        {article.featured && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                            ⭐ Featured
                          </span>
                        )}
                        {savedArticles.has(article.id) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                            ❤️ Saved
                          </span>
                        )}
                        {completedArticles.has(article.id) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                            ✅ Completed
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{article.readTime}</span>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{article.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">{article.excerpt}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>By {article.author}</span>
                        <span>{new Date(article.publishDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-xs text-gray-400 dark:text-gray-500">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        
                        {user && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveArticle(article.id);
                              }}
                              className={`p-1 rounded transition-colors ${
                                savedArticles.has(article.id)
                                  ? 'text-red-500 hover:text-red-600'
                                  : 'text-gray-400 hover:text-red-500'
                              }`}
                              title={savedArticles.has(article.id) ? 'Unsave article' : 'Save article'}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* No articles message */}
                {filteredArticles.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">
                      {selectedCategory === 'saved' ? '❤️' : '🔍'}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {selectedCategory === 'saved' ? 'No saved articles yet' : 'No articles found'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedCategory === 'saved' 
                        ? 'Start saving articles by clicking the heart ❤️ button on articles you like!'
                        : 'Try selecting a different category or adjusting your search to view articles.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : contentType === 'progress' ? (
        <>
          {/* Progress Dashboard */}
          {user ? (
            <div className="space-y-8">
              {/* Progress Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Overall Progress */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">Overall Progress</h3>
                    <div className="text-2xl">📊</div>
                  </div>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-200 mb-2">
                    {getProgressStats().overallCompletionRate}%
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {getProgressStats().completedTipsCount + getProgressStats().completedArticlesCount} of {getProgressStats().totalTips + getProgressStats().totalArticles} items completed
                  </p>
                  <div className="mt-4 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div 
                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressStats().overallCompletionRate}%` }}
                    ></div>
                  </div>
                  <button
                    onClick={shareProgress}
                    className="mt-3 w-full px-3 py-1 text-xs bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                    title="Share your progress"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                    </svg>
                    <span>Share Progress</span>
                  </button>
                </div>

                {/* Tips Progress */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-200">Tips Completed</h3>
                    <div className="text-2xl">💡</div>
                  </div>
                  <div className="text-3xl font-bold text-green-900 dark:text-green-200 mb-2">
                    {getProgressStats().completedTipsCount}
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    of {getProgressStats().totalTips} tips ({getProgressStats().tipsCompletionRate}%)
                  </p>
                  <div className="mt-4 bg-green-200 dark:bg-green-800 rounded-full h-2">
                    <div 
                      className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressStats().tipsCompletionRate}%` }}
                    ></div>
                  </div>
                </div>

                {/* Articles Progress */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200">Articles Completed</h3>
                    <div className="text-2xl">📚</div>
                  </div>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-200 mb-2">
                    {getProgressStats().completedArticlesCount}
                  </div>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    of {getProgressStats().totalArticles} articles ({getProgressStats().articlesCompletionRate}%)
                  </p>
                  <div className="mt-4 bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                    <div 
                      className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressStats().articlesCompletionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Achievements Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  🏆 Achievements
                  <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({getProgressStats().achievements.length} earned)
                  </span>
                </h2>
                
                {getProgressStats().achievements.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getProgressStats().achievements.map((achievement) => (
                      <div key={achievement.id} className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">{achievement.icon}</div>
                            <div>
                              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">{achievement.title}</h3>
                              <p className="text-sm text-yellow-700 dark:text-yellow-300">{achievement.description}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => shareAchievement(achievement)}
                            className="ml-3 p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
                            title="Share this achievement"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🎯</div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Start Your Journey</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Complete your first tip or article to earn your first achievement!
                    </p>
                  </div>
                )}
              </div>

              {/* Reading Streak Section */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-200 flex items-center">
                    🔥 Reading Streak
                  </h2>
                  <button
                    onClick={() => {
                      const shareText = `🔥 ${streakData.currentStreak} day reading streak! Longest streak: ${streakData.longestStreak} days! #HealthJourney #ReadingStreak #HealthAssist`;
                      if (navigator.share) {
                        navigator.share({ title: 'My Reading Streak', text: shareText, url: window.location.origin }).catch(() => copyToClipboard(shareText));
                      } else {
                        copyToClipboard(shareText);
                      }
                    }}
                    className="px-3 py-1 text-sm bg-orange-500 dark:bg-orange-600 text-white rounded hover:bg-orange-600 dark:hover:bg-orange-700 transition-colors flex items-center space-x-1"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                    </svg>
                    <span>Share</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">{streakData.currentStreak}</div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">Current Streak</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">
                      {streakData.currentStreak === 0 ? 'Complete content to start!' : streakData.currentStreak === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">{streakData.longestStreak}</div>
                    <div className="text-sm text-red-700 dark:text-red-300">Longest Streak</div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {streakData.longestStreak === 0 ? 'Keep learning!' : streakData.longestStreak === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                </div>
                {streakData.currentStreak > 0 && (
                  <div className="mt-4 text-center">
                    <div className="text-sm text-orange-700 dark:text-orange-300">
                      🗓️ Last activity: {streakData.lastActivityDate ? new Date(streakData.lastActivityDate).toLocaleDateString() : 'Today'}
                    </div>
                  </div>
                )}
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{getProgressStats().savedTipsCount}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tips Saved</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{getProgressStats().savedArticlesCount}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Articles Saved</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{getProgressStats().readTipsCount}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tips Read</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{getProgressStats().achievements.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Achievements</div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  💡 Recommendations
                </h2>
                <div className="space-y-4">
                  {getProgressStats().completedTipsCount === 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">🎯 Start with Tips</h3>
                      <p className="text-blue-700 dark:text-blue-300 text-sm">
                        Begin your health journey by completing a few quick tips. They're easy to digest and implement!
                      </p>
                    </div>
                  )}
                  
                  {getProgressStats().completedTipsCount > 0 && getProgressStats().completedArticlesCount === 0 && (
                    <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                      <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">📚 Dive Deeper</h3>
                      <p className="text-purple-700 dark:text-purple-300 text-sm">
                        Great job on completing tips! Ready for more detailed information? Try reading some articles.
                      </p>
                    </div>
                  )}
                  
                  {getProgressStats().savedTipsCount < 3 && getProgressStats().savedArticlesCount < 3 && (
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-700">
                      <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">🔖 Save for Later</h3>
                      <p className="text-green-700 dark:text-green-300 text-sm">
                        Found something interesting? Save tips and articles to revisit them anytime!
                      </p>
                    </div>
                  )}
                  
                  {getProgressStats().overallCompletionRate >= 50 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                      <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">🌟 Amazing Progress!</h3>
                      <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                        You're doing great! You've completed over half of the available content. Keep up the excellent work!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔐</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Login Required</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Please log in to view your progress dashboard and track your health learning journey.
              </p>
            </div>
          )}
        </>
      ) : null}

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedArticle.title}</h2>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>By {selectedArticle.author}</span>
                    <span>{selectedArticle.readTime}</span>
                    <span>{new Date(selectedArticle.publishDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {user && (
                    <>
                      <button
                        onClick={() => handleSaveArticle(selectedArticle.id)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          savedArticles.has(selectedArticle.id)
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {savedArticles.has(selectedArticle.id) ? '❤️ Saved' : '🔖 Save'}
                      </button>
                      
                      {!completedArticles.has(selectedArticle.id) && (
                        <button
                          onClick={() => handleMarkArticleCompleted(selectedArticle.id)}
                          className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          ✅ Mark Complete
                        </button>
                      )}
                      
                      {completedArticles.has(selectedArticle.id) && (
                        <span className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          ✅ Completed
                        </span>
                      )}
                    </>
                  )}
                  
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="prose dark:prose-invert max-w-none">
                {selectedArticle.content.split('\n').map((paragraph, index) => {
                  if (paragraph.startsWith('# ')) {
                    return <h1 key={index} className="text-3xl font-bold mb-4">{paragraph.substring(2)}</h1>;
                  } else if (paragraph.startsWith('## ')) {
                    return <h2 key={index} className="text-2xl font-semibold mb-3 mt-6">{paragraph.substring(3)}</h2>;
                  } else if (paragraph.startsWith('### ')) {
                    return <h3 key={index} className="text-xl font-semibold mb-2 mt-4">{paragraph.substring(4)}</h3>;
                  } else if (paragraph.startsWith('- ')) {
                    return <li key={index} className="mb-1">{paragraph.substring(2)}</li>;
                  } else if (paragraph.match(/^\d+\./)) {
                    return <li key={index} className="mb-1">{paragraph}</li>;
                  } else if (paragraph.includes('**')) {
                    const formattedText = paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    return <p key={index} className="mb-3" dangerouslySetInnerHTML={{__html: formattedText}} />;
                  } else if (paragraph.trim()) {
                    return <p key={index} className="mb-3">{paragraph}</p>;
                  }
                  return <br key={index} />;
                })}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {selectedArticle.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
            )}
      </div>
    </div>
  );
}

