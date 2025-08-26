import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

export interface MoodEntry {
  id: string;
  mood: number;
  notes: string;
  trigger?: string;
  date: Date;
  userId?: string;
}

export interface MedicineLog {
  id: string;
  reminderId: string;
  userId: string;
  date: Date;
  time: string;
  taken: boolean;
}

export interface Reminder {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  times: string[];
  days: string[];
  notes: string;
  currentStock: number;
  lowStockThreshold: number;
  userId: string;
  createdAt: Date;
  isActive: boolean;
}

export interface ProgressMetrics {
  // Mood metrics
  averageMood: number;
  moodTrend: 'improving' | 'stable' | 'declining';
  moodStreakDays: number;
  weeklyMoodChange: number;
  
  // Medicine adherence
  medicineAdherence: number; // 0-100%
  adherenceTrend: 'improving' | 'stable' | 'declining';
  consistentDays: number;
  missedDoses: number;
  
  // Overall health
  healthScore: number; // 0-100
  activeGoals: number;
  completedTasks: number;
  
  // Time-based insights
  bestPerformanceDays: string[];
  challengingPeriods: string[];
  lastUpdated: Date;
}

export interface ProgressVisualization {
  type: 'mood_chart' | 'medicine_adherence' | 'health_score' | 'weekly_summary' | 'goals_progress';
  title: string;
  data: any;
  insights: string[];
  actionable_tips: string[];
}

export class ProgressTracking {
  /**
   * Loads comprehensive progress metrics for a user
   */
  static async getProgressMetrics(userId: string): Promise<ProgressMetrics> {
    try {
      const [moodData, medicineData, reminderData] = await Promise.all([
        this.getMoodData(userId),
        this.getMedicineData(userId),
        this.getReminderData(userId)
      ]);

      // Calculate mood metrics
      const moodMetrics = this.calculateMoodMetrics(moodData);
      
      // Calculate medicine adherence
      const adherenceMetrics = this.calculateAdherenceMetrics(medicineData, reminderData);
      
      // Calculate overall health score
      const healthScore = this.calculateHealthScore(moodMetrics, adherenceMetrics);

      return {
        // Mood metrics
        averageMood: moodMetrics.average,
        moodTrend: moodMetrics.trend,
        moodStreakDays: moodMetrics.streakDays,
        weeklyMoodChange: moodMetrics.weeklyChange,
        
        // Medicine adherence
        medicineAdherence: adherenceMetrics.adherenceRate,
        adherenceTrend: adherenceMetrics.trend,
        consistentDays: adherenceMetrics.consistentDays,
        missedDoses: adherenceMetrics.missedDoses,
        
        // Overall health
        healthScore,
        activeGoals: reminderData.filter(r => r.isActive).length,
        completedTasks: adherenceMetrics.completedTasks,
        
        // Time-based insights
        bestPerformanceDays: moodMetrics.bestDays,
        challengingPeriods: moodMetrics.challengingPeriods,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting progress metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Generates progress visualizations for chat display
   */
  static async generateProgressVisualizations(userId: string, requestType?: string): Promise<ProgressVisualization[]> {
    const metrics = await this.getProgressMetrics(userId);
    const visualizations: ProgressVisualization[] = [];

    // Mood trend visualization
    if (!requestType || requestType.includes('mood')) {
      const moodData = await this.getMoodData(userId, 14); // Last 14 days
      
      // If no mood data, create demo/placeholder data
      const chartData = moodData.length > 0 
        ? moodData.map(entry => ({
            date: entry.date.toLocaleDateString(),
            mood: entry.mood,
            emoji: this.getMoodEmoji(entry.mood),
            notes: entry.notes
          }))
        : this.generateDemoMoodData();
      
      visualizations.push({
        type: 'mood_chart',
        title: moodData.length > 0 ? '📈 Mood Trend (Last 2 Weeks)' : '📈 Mood Tracking (Get Started)',
        data: {
          chartData,
          average: metrics.averageMood,
          trend: metrics.moodTrend,
          streakDays: metrics.moodStreakDays
        },
        insights: moodData.length > 0 
          ? this.generateMoodInsights(metrics)
          : ['Start logging your mood to see personalized insights and trends over time.'],
        actionable_tips: moodData.length > 0 
          ? this.generateMoodTips(metrics)
          : ['Visit the Mood page to log your daily feelings and track patterns.', 'Set a daily reminder to check in with your mental health.']
      });
    }

    // Medicine adherence visualization
    if (!requestType || requestType.includes('medicine')) {
      const medicineData = await this.getMedicineData(userId, 7);
      const weeklyPattern = await this.getWeeklyAdherencePattern(userId);
      
      visualizations.push({
        type: 'medicine_adherence',
        title: medicineData.length > 0 ? '💊 Medicine Adherence (Last 7 Days)' : '💊 Medicine Tracking (Get Started)',
        data: {
          adherenceRate: metrics.medicineAdherence,
          trend: metrics.adherenceTrend,
          consistentDays: metrics.consistentDays,
          missedDoses: metrics.missedDoses,
          weeklyPattern: weeklyPattern.length > 0 ? weeklyPattern : this.generateDemoAdherencePattern()
        },
        insights: medicineData.length > 0 
          ? this.generateAdherenceInsights(metrics)
          : ['Set up medicine reminders to track adherence and build healthy habits.'],
        actionable_tips: medicineData.length > 0 
          ? this.generateAdherenceTips(metrics)
          : ['Visit the Reminders page to add your medications and set schedules.', 'Use pill organizers to improve consistency.']
      });
    }

    // Overall health score
    if (!requestType || requestType.includes('health')) {
      visualizations.push({
        type: 'health_score',
        title: '🏆 Overall Health Score',
        data: {
          score: metrics.healthScore,
          breakdown: {
            mood: Math.round(metrics.averageMood * 10),
            adherence: metrics.medicineAdherence,
            consistency: metrics.consistentDays > 5 ? 85 : 65
          },
          goals: {
            active: metrics.activeGoals,
            completed: metrics.completedTasks
          }
        },
        insights: this.generateHealthScoreInsights(metrics),
        actionable_tips: this.generateHealthScoreTips(metrics)
      });
    }

    return visualizations;
  }

  /**
   * Gets recent mood data from Firebase
   */
  private static async getMoodData(userId: string, days: number = 30): Promise<MoodEntry[]> {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      const q = query(
        collection(db, 'moodLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(days)
      );

      const querySnapshot = await getDocs(q);
      const moodData: MoodEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        moodData.push({
          id: doc.id,
          mood: data.mood,
          notes: data.notes || '',
          trigger: data.trigger,
          date: data.date.toDate(),
          userId: data.userId
        });
      });

      return moodData.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      console.error('Error loading mood data:', error);
      return [];
    }
  }

  /**
   * Gets recent medicine log data from Firebase
   */
  private static async getMedicineData(userId: string, days: number = 7): Promise<MedicineLog[]> {
    try {
      const q = query(
        collection(db, 'medicineLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(days * 3) // Assuming 3 doses per day max
      );

      const querySnapshot = await getDocs(q);
      const medicineData: MedicineLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        medicineData.push({
          id: doc.id,
          reminderId: data.reminderId,
          userId: data.userId,
          date: data.date.toDate(),
          time: data.time,
          taken: data.taken
        });
      });

      return medicineData;
    } catch (error) {
      console.error('Error loading medicine data:', error);
      return [];
    }
  }

  /**
   * Gets active reminders from Firebase
   */
  private static async getReminderData(userId: string): Promise<Reminder[]> {
    try {
      const q = query(
        collection(db, 'reminders'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const reminderData: Reminder[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reminderData.push({
          id: doc.id,
          medicineName: data.medicineName,
          dosage: data.dosage,
          frequency: data.frequency,
          times: data.times || [],
          days: data.days || [],
          notes: data.notes || '',
          currentStock: data.currentStock || 0,
          lowStockThreshold: data.lowStockThreshold || 7,
          userId: data.userId,
          createdAt: data.createdAt?.toDate() || new Date(),
          isActive: data.isActive !== false // Default to true
        });
      });

      return reminderData;
    } catch (error) {
      console.error('Error loading reminder data:', error);
      return [];
    }
  }

  /**
   * Calculates mood-related metrics
   */
  private static calculateMoodMetrics(moodData: MoodEntry[]) {
    if (moodData.length === 0) {
      return {
        average: 5,
        trend: 'stable' as const,
        streakDays: 0,
        weeklyChange: 0,
        bestDays: [],
        challengingPeriods: []
      };
    }

    const average = moodData.reduce((sum, entry) => sum + entry.mood, 0) / moodData.length;
    
    // Calculate trend (comparing first half vs second half)
    const midPoint = Math.floor(moodData.length / 2);
    const firstHalf = moodData.slice(0, midPoint);
    const secondHalf = moodData.slice(midPoint);
    
    const firstAvg = firstHalf.reduce((sum, entry) => sum + entry.mood, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, entry) => sum + entry.mood, 0) / secondHalf.length;
    
    let trend: 'improving' | 'stable' | 'declining';
    const difference = secondAvg - firstAvg;
    if (difference > 0.5) trend = 'improving';
    else if (difference < -0.5) trend = 'declining';
    else trend = 'stable';

    // Calculate streak days (consecutive days with mood >= 6)
    let streakDays = 0;
    for (let i = moodData.length - 1; i >= 0; i--) {
      if (moodData[i].mood >= 6) {
        streakDays++;
      } else {
        break;
      }
    }

    // Weekly change
    const weeklyChange = moodData.length >= 7 ? 
      ((moodData.slice(-7).reduce((sum, entry) => sum + entry.mood, 0) / 7) - 
       (moodData.slice(-14, -7).reduce((sum, entry) => sum + entry.mood, 0) / 7)) : 0;

    // Best performance days
    const bestDays = moodData
      .filter(entry => entry.mood >= 8)
      .map(entry => entry.date.toLocaleDateString())
      .slice(0, 3);

    // Challenging periods
    const challengingPeriods = moodData
      .filter(entry => entry.mood <= 3)
      .map(entry => entry.date.toLocaleDateString())
      .slice(0, 3);

    return {
      average,
      trend,
      streakDays,
      weeklyChange,
      bestDays,
      challengingPeriods
    };
  }

  /**
   * Calculates medicine adherence metrics
   */
  private static calculateAdherenceMetrics(medicineData: MedicineLog[], reminderData: Reminder[]) {
    if (medicineData.length === 0) {
      return {
        adherenceRate: 0,
        trend: 'stable' as const,
        consistentDays: 0,
        missedDoses: 0,
        completedTasks: 0
      };
    }

    const takenDoses = medicineData.filter(log => log.taken).length;
    const adherenceRate = Math.round((takenDoses / medicineData.length) * 100);
    
    // Calculate trend (last 3 days vs previous 3 days)
    const recent3 = medicineData.slice(0, 3);
    const previous3 = medicineData.slice(3, 6);
    
    const recentRate = recent3.filter(log => log.taken).length / recent3.length;
    const previousRate = previous3.filter(log => log.taken).length / previous3.length;
    
    let trend: 'improving' | 'stable' | 'declining';
    const difference = recentRate - previousRate;
    if (difference > 0.1) trend = 'improving';
    else if (difference < -0.1) trend = 'declining';
    else trend = 'stable';

    const missedDoses = medicineData.filter(log => !log.taken).length;
    
    // Count consistent days (days with all doses taken)
    const dayGroups = new Map<string, MedicineLog[]>();
    medicineData.forEach(log => {
      const dayKey = log.date.toDateString();
      if (!dayGroups.has(dayKey)) {
        dayGroups.set(dayKey, []);
      }
      dayGroups.get(dayKey)!.push(log);
    });

    let consistentDays = 0;
    dayGroups.forEach((logs) => {
      if (logs.every(log => log.taken)) {
        consistentDays++;
      }
    });

    return {
      adherenceRate,
      trend,
      consistentDays,
      missedDoses,
      completedTasks: takenDoses
    };
  }

  /**
   * Calculates overall health score
   */
  private static calculateHealthScore(moodMetrics: any, adherenceMetrics: any): number {
    const moodScore = (moodMetrics.average / 10) * 40; // 40% weight
    const adherenceScore = (adherenceMetrics.adherenceRate / 100) * 35; // 35% weight
    const consistencyScore = (adherenceMetrics.consistentDays / 7) * 25; // 25% weight
    
    return Math.round(moodScore + adherenceScore + consistencyScore);
  }

  /**
   * Generates weekly adherence pattern
   */
  private static async getWeeklyAdherencePattern(userId: string): Promise<any[]> {
    const medicineData = await this.getMedicineData(userId, 7);
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const pattern = weekDays.map(day => ({ day, adherence: 0, total: 0 }));
    
    medicineData.forEach(log => {
      const dayIndex = log.date.getDay();
      pattern[dayIndex].total++;
      if (log.taken) {
        pattern[dayIndex].adherence++;
      }
    });
    
    return pattern.map(item => ({
      day: item.day,
      rate: item.total > 0 ? Math.round((item.adherence / item.total) * 100) : 0
    }));
  }

  /**
   * Helper method to get mood emoji
   */
  private static getMoodEmoji(mood: number): string {
    const emojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];
    return emojis[Math.max(0, Math.min(mood - 1, 9))];
  }

  /**
   * Generate insights and tips
   */
  private static generateMoodInsights(metrics: ProgressMetrics): string[] {
    const insights: string[] = [];
    
    if (metrics.moodTrend === 'improving') {
      insights.push(`Your mood has been improving! Average mood: ${metrics.averageMood.toFixed(1)}/10`);
    } else if (metrics.moodTrend === 'declining') {
      insights.push(`Your mood has declined recently. Consider what factors might be contributing.`);
    }
    
    if (metrics.moodStreakDays > 0) {
      insights.push(`You've had ${metrics.moodStreakDays} consecutive good mood days! 🎉`);
    }
    
    return insights;
  }

  private static generateMoodTips(metrics: ProgressMetrics): string[] {
    const tips: string[] = [];
    
    if (metrics.averageMood < 5) {
      tips.push("Try the 5-4-3-2-1 grounding technique when feeling down");
      tips.push("Consider gentle exercise like a 10-minute walk");
    } else {
      tips.push("Keep up the positive momentum with your current routine");
      tips.push("Consider journaling to maintain awareness of mood patterns");
    }
    
    return tips;
  }

  private static generateAdherenceInsights(metrics: ProgressMetrics): string[] {
    const insights: string[] = [];
    
    if (metrics.medicineAdherence >= 90) {
      insights.push(`Excellent adherence rate of ${metrics.medicineAdherence}%! Keep it up! 💪`);
    } else if (metrics.medicineAdherence >= 70) {
      insights.push(`Good adherence rate of ${metrics.medicineAdherence}%. Room for improvement.`);
    } else {
      insights.push(`Adherence rate is ${metrics.medicineAdherence}%. Let's work on consistency.`);
    }
    
    return insights;
  }

  private static generateAdherenceTips(metrics: ProgressMetrics): string[] {
    const tips: string[] = [];
    
    if (metrics.medicineAdherence < 80) {
      tips.push("Set phone alarms for medication times");
      tips.push("Use a pill organizer to pre-sort medications");
      tips.push("Link medication taking to daily routines (like meals)");
    }
    
    return tips;
  }

  private static generateHealthScoreInsights(metrics: ProgressMetrics): string[] {
    const insights: string[] = [];
    
    if (metrics.healthScore >= 80) {
      insights.push(`Outstanding health score of ${metrics.healthScore}/100! 🌟`);
    } else if (metrics.healthScore >= 60) {
      insights.push(`Good health score of ${metrics.healthScore}/100. Keep improving!`);
    } else {
      insights.push(`Health score is ${metrics.healthScore}/100. Focus on consistency.`);
    }
    
    return insights;
  }

  private static generateHealthScoreTips(metrics: ProgressMetrics): string[] {
    const tips: string[] = [];
    
    if (metrics.healthScore < 70) {
      tips.push("Focus on medication consistency for better health outcomes");
      tips.push("Track daily mood to identify patterns and triggers");
      tips.push("Set realistic daily health goals");
    }
    
    return tips;
  }

  /**
   * Default metrics for new users or error cases
   */
  private static getDefaultMetrics(): ProgressMetrics {
    return {
      averageMood: 5,
      moodTrend: 'stable',
      moodStreakDays: 0,
      weeklyMoodChange: 0,
      medicineAdherence: 0,
      adherenceTrend: 'stable',
      consistentDays: 0,
      missedDoses: 0,
      healthScore: 50,
      activeGoals: 0,
      completedTasks: 0,
      bestPerformanceDays: [],
      challengingPeriods: [],
      lastUpdated: new Date()
    };
  }

  /**
   * Generates demo mood data for new users
   */
  private static generateDemoMoodData(): Array<{date: string; mood: number; emoji: string; notes: string}> {
    const demoData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      demoData.push({
        date: date.toLocaleDateString(),
        mood: 5, // Neutral mood
        emoji: this.getMoodEmoji(5),
        notes: 'Start tracking your mood to see insights here'
      });
    }
    
    return demoData;
  }

  /**
   * Generates demo adherence pattern for new users
   */
  private static generateDemoAdherencePattern(): Array<{day: string; rate: number}> {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekDays.map(day => ({
      day,
      rate: 0 // No data yet
    }));
  }
}
