// Voice Chat Limits Service - Manages daily voice chat limits per user
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
  private static readonly DAILY_LIMIT = 10;
  private static readonly RESET_HOUR = 0; // 12 AM (midnight)

  /**
   * Get or create voice chat limits for a user
   */
  static async getUserLimits(uid: string): Promise<VoiceChatLimits> {
    const docRef = doc(db, this.COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const limits: VoiceChatLimits = {
        ...data,
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

    // Check if daily limit reached
    if (limits.usedToday >= limits.dailyLimit) {
      const nextReset = this.getNextResetTime();
      return {
        canUseVoiceChat: false,
        reason: `Daily voice chat limit reached (${limits.dailyLimit}/day). Resets at ${nextReset}`,
        remainingToday: 0,
        totalUsed: limits.usedToday,
        dailyLimit: limits.dailyLimit,
        nextResetTime: nextReset,
      };
    }

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
      ...currentLimits,
      usedToday: 0,
      lastResetDate: today,
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
          ...data,
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
    const today = new Date().toDateString();
    
    // Get today's usage
    const todayUsage = limits.totalUsage.find(u => u.date === today) || { sessions: 0, totalDuration: 0, cost: 0 };
    
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
}
