// Voice Chat Limits Service - Manages daily voice chat limits per user with cost control
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';

export interface VoiceChatLimits {
  uid: string;
  dailyLimit: number;
  usedToday: number;
  lastResetDate: string;
  totalUsage: Array<{
    date: string;
    sessions: number;
    totalDuration: number;
    cost: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceChatUsage {
  canUseVoiceChat: boolean;
  reason?: string;
  remainingToday: number;
  totalUsed: number;
  dailyLimit: number;
  nextResetTime: string;
}

export class VoiceChatLimitsService {
  private static readonly COLLECTION = 'voiceChatLimits';
  private static readonly DAILY_LIMIT = 5; // Reduced to 5 for cost control
  private static readonly RESET_HOUR = 0; // 12 AM (midnight)
  private static readonly MAX_COST_PER_DAY = 2.00; // $2 max per user per day

  /**
   * Get or create voice chat limits for a user
   */
  static async getUserLimits(uid: string): Promise<VoiceChatLimits> {
    const docRef = doc(db, this.COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const limits: VoiceChatLimits = {
        uid: data.uid || uid,
        dailyLimit: data.dailyLimit || this.DAILY_LIMIT,
        usedToday: data.usedToday || 0,
        lastResetDate: data.lastResetDate || new Date().toDateString(),
        totalUsage: data.totalUsage || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };

      // Check if we need to reset daily limits
      if (this.shouldResetDaily(limits.lastResetDate)) {
        return await this.resetDailyLimits(uid, limits);
      }

      return limits;
    } else {
      // Create new user limits
      const newLimits: VoiceChatLimits = {
        uid,
        dailyLimit: this.DAILY_LIMIT,
        usedToday: 0,
        lastResetDate: new Date().toDateString(),
        totalUsage: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(docRef, newLimits);
      return newLimits;
    }
  }

  /**
   * Check if user can use voice chat
   */
  static async canUseVoiceChat(uid: string): Promise<VoiceChatUsage> {
    const limits = await this.getUserLimits(uid);
    const today = new Date().toDateString();

    console.log('🔍 Voice Chat Limits Debug:', {
      uid,
      usedToday: limits.usedToday,
      dailyLimit: limits.dailyLimit,
      lastResetDate: limits.lastResetDate,
      today,
      canUse: limits.usedToday < limits.dailyLimit
    });

    // Check if daily limit reached
    if (limits.usedToday >= limits.dailyLimit) {
      const nextReset = this.getNextResetTime();
      console.log('❌ Voice chat limit reached:', limits.usedToday, '/', limits.dailyLimit);
      return {
        canUseVoiceChat: false,
        reason: `Daily voice chat limit reached (${limits.dailyLimit}/day). Resets at ${nextReset}`,
        remainingToday: 0,
        totalUsed: limits.usedToday,
        dailyLimit: limits.dailyLimit,
        nextResetTime: nextReset,
      };
    }

    console.log('✅ Voice chat available:', limits.dailyLimit - limits.usedToday, 'remaining');
    return {
      canUseVoiceChat: true,
      remainingToday: limits.dailyLimit - limits.usedToday,
      totalUsed: limits.usedToday,
      dailyLimit: limits.dailyLimit,
      nextResetTime: this.getNextResetTime(),
    };
  }

  /**
   * Increment voice chat usage when session starts
   */
  static async incrementUsage(uid: string, sessionDuration: number = 0, cost: number = 0): Promise<void> {
    const docRef = doc(db, this.COLLECTION, uid);
    
    await updateDoc(docRef, {
      usedToday: increment(1),
      updatedAt: new Date(),
    });

    // Add to total usage for today
    const today = new Date().toDateString();
    const limits = await this.getUserLimits(uid);
    
    const todayUsage = limits.totalUsage.find(u => u.date === today);
    if (todayUsage) {
      todayUsage.sessions += 1;
      todayUsage.totalDuration += sessionDuration;
      todayUsage.cost += cost;
    } else {
      limits.totalUsage.push({
        date: today,
        sessions: 1,
        totalDuration: sessionDuration,
        cost: cost,
      });
    }

    await setDoc(docRef, limits);
  }

  /**
   * Reset daily limits if it's a new day
   */
  private static async resetDailyLimits(uid: string, currentLimits: VoiceChatLimits): Promise<VoiceChatLimits> {
    const docRef = doc(db, this.COLLECTION, uid);
    const today = new Date().toDateString();

    const updatedLimits: VoiceChatLimits = {
      uid: currentLimits.uid,
      dailyLimit: currentLimits.dailyLimit,
      usedToday: 0,
      lastResetDate: today,
      totalUsage: currentLimits.totalUsage,
      createdAt: currentLimits.createdAt,
      updatedAt: new Date(),
    };

    await setDoc(docRef, updatedLimits);
    return updatedLimits;
  }

  /**
   * Check if daily limits should be reset
   */
  private static shouldResetDaily(lastResetDate: string): boolean {
    const lastReset = new Date(lastResetDate);
    const now = new Date();
    
    // Reset if it's a different day
    return lastReset.toDateString() !== now.toDateString();
  }

  /**
   * Get next reset time (12 AM)
   */
  private static getNextResetTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.RESET_HOUR, 0, 0, 0);
    
    return tomorrow.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Listen to real-time updates of user limits
   */
  static subscribeToLimits(uid: string, callback: (limits: VoiceChatLimits) => void): () => void {
    const docRef = doc(db, this.COLLECTION, uid);
    
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const limits: VoiceChatLimits = {
          uid: data.uid || uid,
          dailyLimit: data.dailyLimit || this.DAILY_LIMIT,
          usedToday: data.usedToday || 0,
          lastResetDate: data.lastResetDate || new Date().toDateString(),
          totalUsage: data.totalUsage || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        callback(limits);
      }
    });
  }

  /**
   * Get usage statistics for a user
   */
  static async getUsageStats(uid: string): Promise<{
    today: { used: number; remaining: number; total: number };
    weekly: { total: number; average: number };
    monthly: { total: number; average: number };
  }> {
    const limits = await this.getUserLimits(uid);
    
    // Get weekly usage (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyUsage = limits.totalUsage
      .filter(u => new Date(u.date) >= weekAgo)
      .reduce((sum, u) => sum + u.sessions, 0);
    
    // Get monthly usage (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthlyUsage = limits.totalUsage
      .filter(u => new Date(u.date) >= monthAgo)
      .reduce((sum, u) => sum + u.sessions, 0);

    return {
      today: {
        used: limits.usedToday,
        remaining: limits.dailyLimit - limits.usedToday,
        total: limits.dailyLimit,
      },
      weekly: {
        total: weeklyUsage,
        average: Math.round((weeklyUsage / 7) * 100) / 100,
      },
      monthly: {
        total: monthlyUsage,
        average: Math.round((monthlyUsage / 30) * 100) / 100,
      },
    };
  }

  /**
   * Force reset limits for a specific user (admin utility)
   */
  static async forceResetUserLimits(uid: string): Promise<void> {
    console.log(`🔄 Force resetting limits for user: ${uid}`);
    
    const docRef = doc(db, this.COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const resetLimits: VoiceChatLimits = {
        uid,
        dailyLimit: this.DAILY_LIMIT,
        usedToday: 0,
        lastResetDate: new Date().toDateString(),
        totalUsage: [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: new Date(),
      };
      
      await setDoc(docRef, resetLimits);
      console.log(`✅ Force reset complete for user: ${uid}`);
    } else {
      // Create new limits if they don't exist
      await this.getUserLimits(uid);
      console.log(`✅ Created new limits for user: ${uid}`);
    }
  }
}
