import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import ToastService from '../services/toastService';
import { gsap } from 'gsap';

interface Reminder {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: 'daily' | 'twice' | 'three-times' | 'custom';
  times: string[]; // ['08:00', '20:00']
  startDate: Date;
  isActive: boolean;
  userId: string;
  notes?: string;
  days?: string[]; // ['monday', 'tuesday', etc] or ['all'] for all days
  currentStock?: number; // Current number of pills/doses
  lowStockThreshold?: number; // Alert when stock falls below this
}

interface MedicineLog {
  id: string;
  reminderId: string;
  date: Date;
  time: string;
  taken: boolean;
  userId: string;
}

interface MoodEntry {
  id: string;
  mood: number;
  notes: string;
  trigger?: string;
  date: Date;
  userId?: string;
}

export default function Reminders() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Reminder states
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form states
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'twice' | 'three-times' | 'custom'>('daily');
  const [customTimes, setCustomTimes] = useState(['08:00']);
  const [notes, setNotes] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['all']);
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(7);
  
  // Edit mode states
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  
  // Medicine log tracking states
  const [medicineLogs, setMedicineLogs] = useState<MedicineLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Health trends states
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [showHealthTrends, setShowHealthTrends] = useState(false);
  
  // Smart reminders states
  const [snoozedReminders, setSnoozedReminders] = useState<{[key: string]: number}>({});
  const [customSnoozeMinutes, setCustomSnoozeMinutes] = useState<{[key: string]: number}>({});
  
  // Notification permission and user preferences
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [userNotificationsEnabled, setUserNotificationsEnabled] = useState<boolean>(true); // User preference from Settings

  // Refs for GSAP animations
  const formRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Load user notification settings from Firebase
  const loadUserNotificationSettings = async (userId: string) => {
    try {
      const q = query(collection(db, 'userSettings'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        if (userData.settings?.notifications !== undefined) {
          setUserNotificationsEnabled(userData.settings.notifications);
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadReminders(currentUser.uid);
        // Auto-load medicine logs for compliance dashboard
        loadMedicineLogs(currentUser.uid);
        // Auto-load mood history for health trends
        loadMoodHistory(currentUser.uid);
        // Load user notification preferences
        loadUserNotificationSettings(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check notification permission on load
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        ToastService.success('✅ Notifications enabled! You\'ll get reminders for your medicines.');
      } else {
        ToastService.warning('❌ Notifications disabled. You can enable them in your browser settings.');
      }
    }
  };

  // Note: Test notification function removed to reduce bundle size

  // Schedule automatic notifications
  const scheduleNotifications = useCallback((reminders: Reminder[]) => {
    // Clear any existing intervals
    if (typeof window !== 'undefined') {
      // Clear existing intervals (stored in window for persistence)
      if ((window as { reminderIntervals?: NodeJS.Timeout[] }).reminderIntervals) {
        (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals.forEach((interval: NodeJS.Timeout) => clearInterval(interval));
      }
      (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals = [];
    }

    if (notificationPermission !== 'granted') return;

    reminders.forEach((reminder) => {
      reminder.times.forEach((time) => {
        // Parse time (e.g., "08:00")
        const [hours, minutes] = time.split(':').map(Number);
        
        // Calculate milliseconds until next occurrence
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        const msUntilNotification = scheduledTime.getTime() - now.getTime();
        
        console.log(`Scheduling notification for ${reminder.medicineName} at ${time} (in ${Math.round(msUntilNotification / 1000 / 60)} minutes)`);
        
        // Schedule the notification
        const timeoutId = setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted' && userNotificationsEnabled) {
            new Notification(`💊 Medicine Time!`, {
              body: `Time to take ${reminder.medicineName} (${reminder.dosage})`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: `reminder-${reminder.id}-${time}`, // Prevent duplicates
              requireInteraction: true // Keep notification visible
            });
          } else if (!userNotificationsEnabled) {
            console.log(`⏰ Reminder scheduled but notifications disabled by user: ${reminder.medicineName} at ${time}`);
          }
          
          // Schedule recurring notification for next day
          const dailyInterval = setInterval(() => {
            if ('Notification' in window && Notification.permission === 'granted' && userNotificationsEnabled) {
              new Notification(`💊 Medicine Time!`, {
                body: `Time to take ${reminder.medicineName} (${reminder.dosage})`,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `reminder-${reminder.id}-${time}`,
                requireInteraction: true
              });
            }
          }, 24 * 60 * 60 * 1000); // 24 hours
          
          // Store interval for cleanup
          if (typeof window !== 'undefined') {
            if (!(window as unknown as { reminderIntervals?: NodeJS.Timeout[] }).reminderIntervals) {
              (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals = [];
            }
            (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals.push(dailyInterval);
          }
        }, msUntilNotification);
        
        // Store timeout for cleanup
        if (typeof window !== 'undefined') {
          if (!(window as unknown as { reminderIntervals?: NodeJS.Timeout[] }).reminderIntervals) {
            (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals = [];
          }
          (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals.push(timeoutId);
        }
      });
    });
  }, [userNotificationsEnabled, notificationPermission]);

  // Schedule notifications when reminders change or user settings change
  useEffect(() => {
    // Always clear existing notifications first
    if (typeof window !== 'undefined' && (window as unknown as { reminderIntervals?: NodeJS.Timeout[] }).reminderIntervals) {
      const intervals = (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals;
      console.log(`🔄 Clearing ${intervals.length} existing notification timers`);
      intervals.forEach((interval: NodeJS.Timeout) => {
        clearTimeout(interval);
        clearInterval(interval);
      });
      (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals = [];
    }
    
    // Only schedule new notifications if all conditions are met
    if (reminders.length > 0 && notificationPermission === 'granted' && userNotificationsEnabled) {
      console.log(`✅ Rescheduling notifications - User enabled: ${userNotificationsEnabled}, Browser granted: ${notificationPermission === 'granted'}`);
      scheduleNotifications(reminders);
    } else {
      console.log(`❌ Not scheduling notifications - User enabled: ${userNotificationsEnabled}, Browser granted: ${notificationPermission === 'granted'}, Reminders: ${reminders.length}`);
    }
    
    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && (window as unknown as { reminderIntervals?: NodeJS.Timeout[] }).reminderIntervals) {
        const intervals = (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals;
        intervals.forEach((interval: NodeJS.Timeout) => {
          clearTimeout(interval);
          clearInterval(interval);
        });
        (window as unknown as { reminderIntervals: NodeJS.Timeout[] }).reminderIntervals = [];
      }
    };
  }, [reminders, notificationPermission, userNotificationsEnabled, scheduleNotifications]);

  // Clean up expired snooze timers every minute
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setSnoozedReminders(prev => {
        const newState = { ...prev };
        let hasChanges = false;
        
        Object.keys(newState).forEach(reminderId => {
          if (newState[reminderId] <= now) {
            delete newState[reminderId];
            hasChanges = true;
          }
        });
        
        return hasChanges ? newState : prev;
      });
      
      // Also clear custom snooze inputs for expired reminders
      setCustomSnoozeMinutes(prev => {
        const newState = { ...prev };
        let hasChanges = false;
        
        Object.keys(newState).forEach(reminderId => {
          if (!snoozedReminders[reminderId] || snoozedReminders[reminderId] <= now) {
            if (newState[reminderId] !== 0) {
              newState[reminderId] = 0;
              hasChanges = true;
            }
          }
        });
        
        return hasChanges ? newState : prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, [snoozedReminders]);

  // GSAP Animation Functions
  const animateFormEntry = () => {
    if (formRef.current) {
      gsap.fromTo(formRef.current,
        { opacity: 0, y: -30, scale: 0.95 },
        { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.7)"
        }
      );
    }
  };

  const animateFormExit = () => {
    if (formRef.current) {
      gsap.to(formRef.current, {
        opacity: 0,
        y: -20,
        scale: 0.95,
        duration: 0.4,
        ease: "power2.in"
      });
    }
  };

  const animateCardsOnLoad = () => {
    if (cardsRef.current) {
      const cards = cardsRef.current.querySelectorAll('.reminder-card');
      gsap.fromTo(cards,
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out"
        }
      );
    }
  };

  const animateHeaderOnLoad = () => {
    if (headerRef.current) {
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: -20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out"
        }
      );
    }
  };

  // Load reminders from Firebase
  const loadReminders = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'reminders'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('startDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const loadedReminders: Reminder[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedReminders.push({
          id: doc.id,
          medicineName: data.medicineName,
          dosage: data.dosage,
          frequency: data.frequency,
          times: data.times,
          startDate: data.startDate.toDate(),
          isActive: data.isActive,
          userId: data.userId,
          notes: data.notes || '',
          days: data.days || ['all'],
          currentStock: data.currentStock || 0,
          lowStockThreshold: data.lowStockThreshold || 7
        });
      });
      
      setReminders(loadedReminders);
      console.log('Loaded reminders:', loadedReminders);
      
      // Animate cards after loading
      setTimeout(() => animateCardsOnLoad(), 100);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  // Animate on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      animateHeaderOnLoad();
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  // Animate form when it becomes visible
  useEffect(() => {
    if (showAddForm || showEditForm) {
      setTimeout(() => animateFormEntry(), 100);
    }
  }, [showAddForm, showEditForm]);

  // Get times based on frequency
  const getTimesForFrequency = (freq: string): string[] => {
    switch (freq) {
      case 'daily':
        return ['08:00'];
      case 'twice':
        return ['08:00', '20:00'];
      case 'three-times':
        return ['08:00', '14:00', '20:00'];
      case 'custom':
        return customTimes;
      default:
        return ['08:00'];
    }
  };

  // Reset form function
  const resetForm = () => {
    if (showAddForm || showEditForm) {
      animateFormExit();
      setTimeout(() => {
        setMedicineName('');
        setDosage('');
        setFrequency('daily');
        setCustomTimes(['08:00']);
        setNotes('');
        setSelectedDays(['all']);
        setCurrentStock(0);
        setLowStockThreshold(7);
        setEditingReminder(null);
        setShowAddForm(false);
        setShowEditForm(false);
      }, 400);
    } else {
      setMedicineName('');
      setDosage('');
      setFrequency('daily');
      setCustomTimes(['08:00']);
      setNotes('');
      setSelectedDays(['all']);
      setCurrentStock(0);
      setLowStockThreshold(7);
      setEditingReminder(null);
      setShowAddForm(false);
      setShowEditForm(false);
    }
  };

  // Start editing a reminder
  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setMedicineName(reminder.medicineName);
    setDosage(reminder.dosage);
    setFrequency(reminder.frequency);
    setCustomTimes(reminder.frequency === 'custom' ? reminder.times : ['08:00']);
    setNotes(reminder.notes || '');
    setSelectedDays(reminder.days || ['all']);
    setCurrentStock(reminder.currentStock || 0);
    setLowStockThreshold(reminder.lowStockThreshold || 7);
    setShowEditForm(true);
    setShowAddForm(false);
    
    // Animate form entry
    setTimeout(() => animateFormEntry(), 100);
  };

  // Add new reminder
  const handleAddReminder = async () => {
    if (!medicineName.trim() || !dosage.trim() || !user) return;
    
    setIsLoading(true);
    try {
      const times = getTimesForFrequency(frequency);
      
      await addDoc(collection(db, 'reminders'), {
        medicineName: medicineName.trim(),
        dosage: dosage.trim(),
        frequency,
        times,
        startDate: Timestamp.fromDate(new Date()),
        isActive: true,
        userId: user.uid,
        notes: notes.trim(),
        days: selectedDays,
        currentStock: currentStock || 0,
        lowStockThreshold: lowStockThreshold || 7
      });
      
      // Reset form and reload
      resetForm();
      loadReminders(user.uid);
      ToastService.success('Reminder added successfully! 💊');
    } catch (error) {
      console.error('Error adding reminder:', error);
      ToastService.error('Error adding reminder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update existing reminder
  const handleUpdateReminder = async () => {
    if (!medicineName.trim() || !dosage.trim() || !user || !editingReminder) return;
    
    setIsLoading(true);
    try {
      const times = getTimesForFrequency(frequency);
      
      await updateDoc(doc(db, 'reminders', editingReminder.id), {
        medicineName: medicineName.trim(),
        dosage: dosage.trim(),
        frequency,
        times,
        notes: notes.trim(),
        days: selectedDays,
        currentStock: currentStock || 0,
        lowStockThreshold: lowStockThreshold || 7
      });
      
      // Reset form and reload
      resetForm();
      loadReminders(user.uid);
      ToastService.success('Reminder updated successfully! ✏️');
    } catch (error) {
      console.error('Error updating reminder:', error);
      ToastService.error('Error updating reminder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete reminder
  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    
    try {
      await deleteDoc(doc(db, 'reminders', reminderId));
      setReminders(prev => prev.filter(reminder => reminder.id !== reminderId));
      ToastService.success('Reminder deleted successfully! 🗑️');
    } catch (error) {
      console.error('Error deleting reminder:', error);
      ToastService.error('Error deleting reminder. Please try again.');
    }
  };

  // Log medicine intake
  const handleLogMedicine = async (reminderId: string, medicineName: string, taken: boolean) => {
    if (!user) return;
    
    try {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      await addDoc(collection(db, 'medicineLogs'), {
        reminderId,
        userId: user.uid,
        date: Timestamp.fromDate(now),
        time: timeString,
        taken,
        medicineName,
        loggedAt: Timestamp.fromDate(now)
      });

      // Update stock count if medicine was taken
      if (taken) {
        const reminder = reminders.find(r => r.id === reminderId);
        if (reminder && reminder.currentStock && reminder.currentStock > 0) {
          const newStock = reminder.currentStock - 1;
          await updateDoc(doc(db, 'reminders', reminderId), {
            currentStock: newStock
          });
          
          // Check for low stock alert
          if (newStock <= (reminder.lowStockThreshold || 7) && newStock > 0) {
            ToastService.warning(`⚠️ Low Stock Alert: Only ${newStock} doses of ${medicineName} remaining!`, { duration: 6000 });
          } else if (newStock === 0) {
            ToastService.error(`🔴 Out of Stock: ${medicineName} is out of stock! Please refill.`, { duration: 8000 });
          }
          
          // Reload reminders to update stock display
          loadReminders(user.uid);
        }
      }
      
      // Show success message
      const status = taken ? 'taken' : 'missed';
      if (taken) {
        ToastService.success(`✅ Medicine ${status} logged for ${medicineName}!`);
      } else {
        ToastService.warning(`⚠️ Medicine ${status} logged for ${medicineName}!`);
      }
      
      // Reload logs if showing
      if (showLogs) {
        loadMedicineLogs(user.uid);
      }
    } catch (error) {
      console.error('Error logging medicine:', error);
      ToastService.error('Error logging medicine. Please try again.');
    }
  };

  // Load medicine logs
  const loadMedicineLogs = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'medicineLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const loadedLogs: MedicineLog[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedLogs.push({
          id: doc.id,
          reminderId: data.reminderId,
          userId: data.userId,
          date: data.date.toDate(),
          time: data.time,
          taken: data.taken
        });
      });
      
      setMedicineLogs(loadedLogs);
    } catch (error) {
      console.error('Error loading medicine logs:', error);
    }
  };

  // Load mood history for health trends
  const loadMoodHistory = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'moodLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const loadedMoods: MoodEntry[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedMoods.push({
          id: doc.id,
          mood: data.mood,
          notes: data.notes || '',
          trigger: data.trigger,
          date: data.date.toDate(),
          userId: data.userId
        });
      });
      
      setMoodHistory(loadedMoods);
    } catch (error) {
      console.error('Error loading mood history:', error);
    }
  };

  // Snooze reminder function
  const handleSnoozeReminder = (reminderId: string, medicineName: string, minutes: number) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      ToastService.warning('Please enable notifications to use snooze feature');
      return;
    }

    const snoozeTime = Date.now() + (minutes * 60 * 1000);
    setSnoozedReminders(prev => ({ ...prev, [reminderId]: snoozeTime }));

    // Set snooze notification
    setTimeout(() => {
      if (userNotificationsEnabled) {
        new Notification(`⏰ Snooze Reminder: ${medicineName}`, {
          body: `Time to take your ${medicineName} (snoozed for ${minutes} minutes)`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `snooze-${reminderId}`,
          requireInteraction: true
        });
      } else {
        console.log(`⏰ Snooze reminder scheduled but notifications disabled by user: ${medicineName}`);
      }

      // Remove from snoozed list
      setSnoozedReminders(prev => {
        const newState = { ...prev };
        delete newState[reminderId];
        return newState;
      });
    }, minutes * 60 * 1000);

    ToastService.info(`⏰ Reminder snoozed for ${minutes} minutes!`);
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
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Medicine Reminders</h1>
            <div className="flex justify-center mb-4">
              <span className="text-6xl">🔒</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Account Required</h2>
            <p className="text-gray-600 mb-6">
              Medicine reminders require an account to securely manage your personal medication schedule.
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-500 to-blue-600 rounded-full mb-6 shadow-lg animate-pulse">
            <span className="text-3xl">💊</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Medicine Reminders
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Stay on top of your medication schedule with smart notifications and health tracking
          </p>
        </div>

        {/* Notification Status & Controls */}
        <div className="mb-8 bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full"></div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Browser Notifications</h3>
                <p className="text-gray-600 mt-1">
                  {notificationPermission === 'granted' ? '✅ Enabled and working' : 
                   notificationPermission === 'denied' ? '❌ Blocked by browser' : '⚠️ Click to enable'}
                </p>
                {notificationPermission === 'granted' && reminders.length > 0 && (
                  <p className="text-sm text-green-600 mt-2 font-medium">
                    🔔 {reminders.reduce((total, r) => total + r.times.length, 0)} automatic reminders scheduled
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {!userNotificationsEnabled && (
                <div className="bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 px-4 py-2 rounded-xl text-sm font-medium border border-orange-300">
                  ⚠️ Disabled in Settings
                </div>
              )}
              {notificationPermission !== 'granted' && userNotificationsEnabled && (
                <button
                  onClick={requestNotificationPermission}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Enable Notifications
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Add Reminder Button */}
        <div className="mb-8 text-center">
          <button
            onClick={() => {
              if (showAddForm) {
                resetForm();
              } else {
                resetForm();
                setShowAddForm(true);
              }
            }}
            className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-2xl hover:from-green-700 hover:to-blue-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300/30"
          >
            {showAddForm ? (
              <span className="flex items-center space-x-2">
                <span>✕</span>
                <span>Cancel</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>➕</span>
                <span>Add New Reminder</span>
              </span>
            )}
          </button>
        </div>

        {/* Add/Edit Reminder Form */}
        {(showAddForm || showEditForm) && (
          <div ref={formRef} className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 mb-8 transition-all duration-300 hover:shadow-3xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full mb-4 shadow-lg">
                <span className="text-2xl">{editingReminder ? '✏️' : '💊'}</span>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {editingReminder ? 'Edit Medicine Reminder' : 'Add Medicine Reminder'}
              </h2>
              <p className="text-gray-600">
                {editingReminder ? 'Update your medication details' : 'Configure your new medication schedule'}
              </p>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Medicine Name */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Medicine Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  placeholder="e.g., Aspirin, Vitamin D"
                  className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 text-lg"
                />
              </div>

              {/* Dosage */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Dosage <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g., 100mg, 1 tablet"
                  className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 text-lg"
                />
              </div>
            </div>

            {/* Frequency */}
            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-800 mb-3">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'twice' | 'three-times' | 'custom')}
                className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 text-lg appearance-none cursor-pointer"
              >
                <option value="daily">Once daily (8:00 AM)</option>
                <option value="twice">Twice daily (8:00 AM, 8:00 PM)</option>
                <option value="three-times">Three times daily (8:00 AM, 2:00 PM, 8:00 PM)</option>
                <option value="custom">Custom times</option>
              </select>
            </div>

          {/* Custom Times */}
          {frequency === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Times
              </label>
              {customTimes.map((time, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      const newTimes = [...customTimes];
                      newTimes[index] = e.target.value;
                      setCustomTimes(newTimes);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {customTimes.length > 1 && (
                    <button
                      onClick={() => {
                        const newTimes = customTimes.filter((_, i) => i !== index);
                        setCustomTimes(newTimes);
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCustomTimes([...customTimes, '08:00'])}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Another Time
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Take with food, Before bedtime"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Day Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days to Take Medicine
            </label>
            <div className="space-y-2">
              <div>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="daySelection"
                    checked={selectedDays.includes('all')}
                    onChange={() => setSelectedDays(['all'])}
                    className="mr-2"
                  />
                  <span className="text-sm">Every day</span>
                </label>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="daySelection"
                    checked={!selectedDays.includes('all')}
                    onChange={() => setSelectedDays(['monday'])}
                    className="mr-2"
                  />
                  <span className="text-sm">Specific days</span>
                </label>
              </div>
              {!selectedDays.includes('all') && (
                <div className="ml-6 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <label key={day} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDays.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDays([...selectedDays.filter(d => d !== 'all'), day]);
                          } else {
                            setSelectedDays(selectedDays.filter(d => d !== day));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{day.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stock Management */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medicine Stock (Optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Current Stock</label>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={currentStock || ''}
                  onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Number of pills/doses you have</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Low Stock Alert</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={lowStockThreshold || ''}
                  onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 7)}
                  placeholder="7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this</p>
              </div>
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={resetForm}
              className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={editingReminder ? handleUpdateReminder : handleAddReminder}
              disabled={isLoading || !medicineName.trim() || !dosage.trim()}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {isLoading ? 'Saving...' : (editingReminder ? '✏️ Update Reminder' : '💾 Save Reminder')}
            </button>
          </div>
        </div>
      )}

        {/* Reminders List */}
        <div>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
              Active Reminders
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Manage your medication schedule and track your health progress
            </p>
          </div>
          
          {reminders.length === 0 ? (
            <div className="text-center py-16 bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full mb-6">
                <span className="text-4xl">💊</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">No reminders yet</h3>
              <p className="text-gray-600 text-lg mb-6">Add your first medicine reminder to get started!</p>
              <div className="inline-flex items-center text-blue-600 font-medium">
                <span className="mr-2">👆</span>
                <span>Click "Add New Reminder" above</span>
              </div>
            </div>
          ) : (
            <div ref={cardsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="reminder-card bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl hover:scale-105">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-xl">💊</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{reminder.medicineName}</h3>
                        <p className="text-gray-600 font-medium">{reminder.dosage}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditReminder(reminder)}
                        className="w-10 h-10 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-md"
                        title="Edit reminder"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteReminder(reminder.id)}
                        className="w-10 h-10 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-md"
                        title="Delete reminder"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                
                  <div className="space-y-3 mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-4 border border-blue-100">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">⏰ Times:</span>
                          <div className="text-gray-800 font-semibold">{reminder.times.join(', ')}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">📅 Frequency:</span>
                          <div className="text-gray-800 font-semibold">{reminder.frequency.replace('-', ' ')}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">🗓️ Days:</span>
                          <div className="text-gray-800 font-semibold">
                            {reminder.days?.includes('all') 
                              ? 'Every day' 
                              : reminder.days?.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'Every day'
                            }
                          </div>
                        </div>
                        {reminder.currentStock !== undefined && reminder.currentStock >= 0 && (
                          <div>
                            <span className="text-gray-600 font-medium">📦 Stock:</span>
                            <div className={`font-semibold ${
                              reminder.currentStock === 0 
                                ? 'text-red-600' 
                                : reminder.currentStock <= (reminder.lowStockThreshold || 7)
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}>
                              {reminder.currentStock === 0 ? '🔴 Out of stock' : `${reminder.currentStock} doses`}
                              {reminder.currentStock > 0 && reminder.currentStock <= (reminder.lowStockThreshold || 7) && ' ⚠️'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                
                  {reminder.notes && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100 mb-6">
                      <div className="flex items-start space-x-3">
                        <span className="text-lg">💡</span>
                        <p className="text-gray-700 font-medium italic">{reminder.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Medicine Log Buttons */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Medicine Actions</h4>
                    
                    {/* Main Action Buttons */}
                    <div className="flex space-x-4 mb-4">
                      <button
                        onClick={() => handleLogMedicine(reminder.id, reminder.medicineName, true)}
                        className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-2xl text-sm font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300/30"
                      >
                        <span className="flex items-center justify-center space-x-2">
                          <span>✅</span>
                          <span>Took it</span>
                        </span>
                      </button>
                      <button
                        onClick={() => handleLogMedicine(reminder.id, reminder.medicineName, false)}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-3 rounded-2xl text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orange-300/30"
                      >
                        <span className="flex items-center justify-center space-x-2">
                          <span>⚠️</span>
                          <span>Missed it</span>
                        </span>
                      </button>
                    </div>

                  {/* Snooze Buttons */}
                  {notificationPermission === 'granted' && (
                    <div className="space-y-2">
                      {/* Quick Snooze Buttons */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSnoozeReminder(reminder.id, reminder.medicineName, 15)}
                          disabled={Boolean(snoozedReminders[reminder.id] && snoozedReminders[reminder.id] > Date.now())}
                          className="flex-1 bg-blue-50 text-blue-700 px-2 py-1.5 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⏰ 15min
                        </button>
                        <button
                          onClick={() => handleSnoozeReminder(reminder.id, reminder.medicineName, 30)}
                          disabled={Boolean(snoozedReminders[reminder.id] && snoozedReminders[reminder.id] > Date.now())}
                          className="flex-1 bg-blue-50 text-blue-700 px-2 py-1.5 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⏰ 30min
                        </button>
                      </div>
                      
                      {/* Custom Snooze */}
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="240"
                          placeholder="Custom"
                          value={customSnoozeMinutes[reminder.id] || ''}
                          onChange={(e) => setCustomSnoozeMinutes(prev => ({
                            ...prev,
                            [reminder.id]: parseInt(e.target.value) || 0
                          }))}
                          disabled={Boolean(snoozedReminders[reminder.id] && snoozedReminders[reminder.id] > Date.now())}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={() => {
                            const minutes = customSnoozeMinutes[reminder.id];
                            if (minutes && minutes > 0 && minutes <= 240) {
                              handleSnoozeReminder(reminder.id, reminder.medicineName, minutes);
                              setCustomSnoozeMinutes(prev => ({ ...prev, [reminder.id]: 0 }));
                            } else {
                              ToastService.warning('Please enter a valid time between 1-240 minutes');
                            }
                          }}
                          disabled={Boolean(
                            !customSnoozeMinutes[reminder.id] || 
                            customSnoozeMinutes[reminder.id] <= 0 || 
                            customSnoozeMinutes[reminder.id] > 240 ||
                            (snoozedReminders[reminder.id] && snoozedReminders[reminder.id] > Date.now())
                          )}
                          className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-md text-xs font-medium hover:bg-purple-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Set
                        </button>
                      </div>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Snooze for 1-240 minutes
                      </p>
                    </div>
                  )}

                  {/* Snooze Status */}
                  {snoozedReminders[reminder.id] && snoozedReminders[reminder.id] > Date.now() && (
                    <div className="mt-2 bg-blue-50 rounded-md p-2">
                      <p className="text-xs text-blue-700 text-center">
                        ⏰ Snoozed until {new Date(snoozedReminders[reminder.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Started: {reminder.startDate.toLocaleDateString()}
                  </p>
                  {notificationPermission === 'granted' && (
                    <p className="text-xs text-green-600 mt-1">
                      🔔 Next notifications: {reminder.times.map(time => {
                        const [hours, minutes] = time.split(':').map(Number);
                        const scheduledTime = new Date();
                        scheduledTime.setHours(hours, minutes, 0, 0);
                        if (scheduledTime <= new Date()) {
                          scheduledTime.setDate(scheduledTime.getDate() + 1);
                        }
                        return scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      }).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

              {/* Compliance Dashboard */}
        {medicineLogs.length > 0 && (
          <div className="mt-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
                📊 Compliance Dashboard
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Track your medication adherence and health progress with detailed insights
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* This Week Compliance */}
              <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {medicineLogs.length > 0 ? Math.round((medicineLogs.filter(log => {
                    const logDate = new Date(log.date);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return logDate >= weekAgo && log.taken;
                  }).length / Math.max(medicineLogs.filter(log => {
                    const logDate = new Date(log.date);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return logDate >= weekAgo;
                                     }).length, 1)) * 100) : 0}%
                    </div>
                    <div className="text-sm text-gray-600 font-medium">This Week</div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Compliance Rate</h3>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${medicineLogs.length > 0 ? Math.round((medicineLogs.filter(log => {
                          const logDate = new Date(log.date);
                          const weekAgo = new Date();
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          return logDate >= weekAgo && log.taken;
                        }).length / Math.max(medicineLogs.filter(log => {
                          const logDate = new Date(log.date);
                          const weekAgo = new Date();
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          return logDate >= weekAgo;
                        }).length, 1)) * 100) : 0}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">Weekly progress tracking</p>
                </div>
              </div>

                        {/* Current Streak */}
              <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🔥</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  {(() => {
                    // Calculate current streak - consecutive days with all medicines taken
                    let streak = 0;
                    const today = new Date();
                    
                    for (let i = 0; i < 30; i++) { // Check last 30 days
                      const checkDate = new Date(today);
                      checkDate.setDate(today.getDate() - i);
                      
                      const dayLogs = medicineLogs.filter(log => {
                        const logDate = new Date(log.date);
                        return logDate.toDateString() === checkDate.toDateString();
                      });
                      
                      if (dayLogs.length > 0 && dayLogs.every(log => log.taken)) {
                        streak++;
                      } else {
                        break;
                      }
                    }
                    
                                          return streak;
                    })()}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">Current Streak</div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Consecutive Days</h3>
                  <div className="flex items-center justify-center space-x-2">
                    {Array.from({ length: Math.min(7, (() => {
                      let streak = 0;
                      const today = new Date();
                      for (let i = 0; i < 30; i++) {
                        const checkDate = new Date(today);
                        checkDate.setDate(today.getDate() - i);
                        const dayLogs = medicineLogs.filter(log => {
                          const logDate = new Date(log.date);
                          return logDate.toDateString() === checkDate.toDateString();
                        });
                        if (dayLogs.length > 0 && dayLogs.every(log => log.taken)) {
                          streak++;
                        } else {
                          break;
                        }
                      }
                      return streak;
                    })()) }, (_, i) => (
                      <div key={i} className="w-3 h-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-full"></div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Keep the momentum going!</p>
                </div>
              </div>

                        {/* Total Stats */}
              <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">💊</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      {medicineLogs.filter(log => log.taken).length}
                      <span className="text-lg text-gray-600">/{medicineLogs.length}</span>
                    </div>
                    <div className="text-sm text-gray-600 font-medium">Total Logged</div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Medicine Entries</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                      <div className="text-lg font-bold text-green-600">{medicineLogs.filter(log => log.taken).length}</div>
                      <div className="text-xs text-green-700">Taken</div>
                    </div>
                    <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-3 border border-red-200">
                      <div className="text-lg font-bold text-red-600">{medicineLogs.filter(log => !log.taken).length}</div>
                      <div className="text-xs text-red-700">Missed</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Track your progress</p>
                </div>
              </div>
        </div>
        </div>
      )}

              {/* Health Trends Integration */}
        {medicineLogs.length > 0 && moodHistory.length > 0 && (
          <div className="mt-12">
            <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-xl">🔗</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Health Trends
                    </h2>
                    <p className="text-gray-600">Discover connections between mood and medication</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHealthTrends(!showHealthTrends)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-300/30"
                >
                  {showHealthTrends ? (
                    <span className="flex items-center space-x-2">
                      <span>👁️</span>
                      <span>Hide Trends</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-2">
                      <span>📈</span>
                      <span>View Health Trends</span>
                    </span>
                  )}
                </button>
              </div>

                        {showHealthTrends && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl border border-indigo-200 p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-indigo-900 mb-2">Mood & Medicine Connection</h3>
                    <p className="text-indigo-700">Analyze correlations between your medication adherence and emotional wellness</p>
                  </div>
               
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(() => {
                      // Calculate insights
                      const last7Days = new Date();
                      last7Days.setDate(last7Days.getDate() - 7);
                      const last30Days = new Date();
                      last30Days.setDate(last30Days.getDate() - 30);
                      
                      // Recent mood entries
                      const recentMoods = moodHistory.filter(mood => mood.date >= last7Days);
                      const avgRecentMood = recentMoods.length > 0 
                        ? (recentMoods.reduce((sum, m) => sum + m.mood, 0) / recentMoods.length).toFixed(1)
                        : 0;
                      
                      // All mood entries for trend calculation
                      const allMoods = moodHistory.filter(mood => mood.date >= last30Days);
                      const moodTrend = allMoods.length >= 2 ? (() => {
                        const recent = allMoods.slice(0, Math.floor(allMoods.length / 2));
                        const older = allMoods.slice(Math.floor(allMoods.length / 2));
                        const recentAvg = recent.reduce((sum, m) => sum + m.mood, 0) / recent.length;
                        const olderAvg = older.reduce((sum, m) => sum + m.mood, 0) / older.length;
                        return recentAvg - olderAvg;
                      })() : 0;
                      
                      // Recent medicine compliance
                      const recentMedicineLogs = medicineLogs.filter(log => log.date >= last7Days);
                      const recentCompliance = recentMedicineLogs.length > 0
                        ? Math.round((recentMedicineLogs.filter(log => log.taken).length / recentMedicineLogs.length) * 100)
                        : 0;
                      
                      // Medicine compliance trend
                      const allMedicineLogs = medicineLogs.filter(log => log.date >= last30Days);
                      const complianceTrend = allMedicineLogs.length >= 4 ? (() => {
                        const recent = allMedicineLogs.slice(0, Math.floor(allMedicineLogs.length / 2));
                        const older = allMedicineLogs.slice(Math.floor(allMedicineLogs.length / 2));
                        const recentRate = recent.filter(log => log.taken).length / recent.length;
                        const olderRate = older.filter(log => log.taken).length / older.length;
                        return (recentRate - olderRate) * 100;
                      })() : 0;
                      
                      // Data collection days
                      const daysWithBothData = (() => {
                        let count = 0;
                        for (let i = 0; i < 30; i++) {
                          const checkDate = new Date();
                          checkDate.setDate(checkDate.getDate() - i);
                          const dateStr = checkDate.toDateString();
                          
                          const hasMood = moodHistory.some(mood => mood.date.toDateString() === dateStr);
                          const hasMedicine = medicineLogs.some(log => log.date.toDateString() === dateStr);
                          
                          if (hasMood && hasMedicine) count++;
                        }
                        return count;
                      })();
                  
                      return (
                        <>
                          {/* Average Mood (Last 7 Days) */}
                          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-indigo-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <div className="flex items-center justify-between mb-4">
                              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-xl">😊</span>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                  {avgRecentMood}/10
                                </div>
                                {moodTrend !== 0 && (
                                  <div className={`text-sm font-medium flex items-center ${moodTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    <span className="mr-1">{moodTrend > 0 ? '↗️' : '↘️'}</span>
                                    {Math.abs(moodTrend).toFixed(1)} trend
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-center">
                              <h4 className="text-lg font-bold text-indigo-900 mb-2">Avg Mood (7 days)</h4>
                              <div className="w-full bg-indigo-100 rounded-full h-2 mb-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${(parseFloat(avgRecentMood.toString()) / 10) * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-sm text-indigo-700 font-medium">{recentMoods.length} entries this week</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {parseFloat(avgRecentMood.toString()) >= 7 ? '🌟 Great mood!' : 
                                 parseFloat(avgRecentMood.toString()) >= 5 ? '😊 Stable mood' : '💙 Take care of yourself'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Medicine Compliance (Last 7 Days) */}
                          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <div className="flex items-center justify-between mb-4">
                              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-xl">💊</span>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                  {recentCompliance}%
                                </div>
                                {complianceTrend !== 0 && (
                                  <div className={`text-sm font-medium flex items-center ${complianceTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    <span className="mr-1">{complianceTrend > 0 ? '↗️' : '↘️'}</span>
                                    {Math.abs(complianceTrend).toFixed(1)}% trend
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-center">
                              <h4 className="text-lg font-bold text-green-900 mb-2">Medicine (7 days)</h4>
                              <div className="w-full bg-green-100 rounded-full h-2 mb-2">
                                <div 
                                  className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${recentCompliance}%` }}
                                ></div>
                              </div>
                              <p className="text-sm text-green-700 font-medium">compliance rate</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {recentCompliance >= 90 ? '🌟 Excellent adherence!' : 
                                 recentCompliance >= 70 ? '👍 Good compliance' : '⚠️ Room for improvement'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Data Collection */}
                          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <div className="flex items-center justify-between mb-4">
                              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-xl">📊</span>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                  {daysWithBothData}
                                </div>
                                <div className="text-sm text-purple-700 font-medium">
                                  {Math.round((daysWithBothData / 30) * 100)}% coverage
                                </div>
                              </div>
                            </div>
                            <div className="text-center">
                              <h4 className="text-lg font-bold text-purple-900 mb-2">Data Collection</h4>
                              <div className="w-full bg-purple-100 rounded-full h-2 mb-2">
                                <div 
                                  className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${(daysWithBothData / 30) * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-sm text-purple-700 font-medium">days with both records</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {daysWithBothData >= 21 ? '🎯 Excellent tracking!' : 
                                 daysWithBothData >= 14 ? '📈 Good progress' : '📝 Keep logging daily'}
                              </p>
                            </div>
                          </div>
                        </>
                    );
                  })()}
                </div>
              
                {/* Correlation Analysis / Progress */}
                <div className="mt-8 bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-indigo-200 shadow-lg">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
                      <span className="text-xl">💡</span>
                    </div>
                    <div className="flex-1">
                    {(() => {
                      // Calculate correlation data
                      const correlationData = [];
                      
                      for (let i = 0; i < 30; i++) {
                        const checkDate = new Date();
                        checkDate.setDate(checkDate.getDate() - i);
                        const dateStr = checkDate.toDateString();
                        
                        // Get mood for this day (average if multiple entries)
                        const dayMoods = moodHistory.filter(mood => 
                          mood.date.toDateString() === dateStr
                        );
                        
                        // Get medicine logs for this day
                        const dayLogs = medicineLogs.filter(log => 
                          log.date.toDateString() === dateStr
                        );
                        
                        if (dayMoods.length > 0 && dayLogs.length > 0) {
                          const avgMood = dayMoods.reduce((sum, m) => sum + m.mood, 0) / dayMoods.length;
                          const compliance = dayLogs.filter(log => log.taken).length / dayLogs.length;
                          
                          correlationData.push({
                            date: checkDate,
                            mood: avgMood,
                            compliance: compliance
                          });
                        }
                      }
                      
                      const daysWithBoth = correlationData.length;
                      
                      // Show progress if not enough data
                      if (daysWithBoth < 7) {
                        return (
                          <>
                            <h4 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                              <span className="mr-2">🌱</span>
                              Building Your Health Profile
                            </h4>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4">
                              <p className="text-gray-700 font-medium mb-2">
                                Keep logging both mood and medicine data daily to unlock powerful insights!
                              </p>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-600">Progress to meaningful patterns</span>
                                <span className="text-sm font-bold text-indigo-600">{daysWithBoth}/7 days</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${(daysWithBoth / 7) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                <div className="flex items-center mb-2">
                                  <span className="text-green-600 mr-2">✅</span>
                                  <span className="font-semibold text-green-800">Log your mood daily</span>
                                </div>
                                <p className="text-xs text-green-700">Use the Mood page to track how you feel</p>
                              </div>
                              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                <div className="flex items-center mb-2">
                                  <span className="text-purple-600 mr-2">💊</span>
                                  <span className="font-semibold text-purple-800">Track medicine intake</span>
                                </div>
                                <p className="text-xs text-purple-700">Use "Took it" or "Missed it" buttons above</p>
                              </div>
                            </div>
                          </>
                        );
                      }
                      
                      // Show correlation analysis if enough data
                      const perfectComplianceDays = correlationData.filter(d => d.compliance === 1);
                      const poorComplianceDays = correlationData.filter(d => d.compliance < 0.7);
                      
                      const avgMoodPerfectCompliance = perfectComplianceDays.length > 0 
                        ? perfectComplianceDays.reduce((sum, d) => sum + d.mood, 0) / perfectComplianceDays.length 
                        : 0;
                        
                      const avgMoodPoorCompliance = poorComplianceDays.length > 0
                        ? poorComplianceDays.reduce((sum, d) => sum + d.mood, 0) / poorComplianceDays.length
                        : 0;
                        
                      const moodDifference = avgMoodPerfectCompliance - avgMoodPoorCompliance;
                      
                      return (
                        <>
                          <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                            <span className="mr-2">🔍</span>
                            Health Insights & Correlations
                          </h4>
                          
                          {perfectComplianceDays.length > 0 && poorComplianceDays.length > 0 && moodDifference > 0.5 ? (
                            <>
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 mb-4 border border-green-200 shadow-sm">
                                <div className="flex items-start space-x-3">
                                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-lg">🎯</span>
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-bold text-green-800 mb-2">
                                      🌟 Key Discovery: Your mood improves {((moodDifference / avgMoodPoorCompliance) * 100).toFixed(0)}% with perfect medicine adherence!
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                      <div className="bg-white/70 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium text-green-700">Perfect Days</span>
                                          <span className="text-xl font-bold text-green-600">{avgMoodPerfectCompliance.toFixed(1)}/10</span>
                                        </div>
                                        <p className="text-xs text-green-600 mt-1">{perfectComplianceDays.length} days analyzed</p>
                                        <div className="w-full bg-green-100 rounded-full h-1 mt-2">
                                          <div 
                                            className="bg-green-500 h-1 rounded-full"
                                            style={{ width: `${(avgMoodPerfectCompliance / 10) * 100}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                      <div className="bg-white/70 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium text-orange-700">Poor Days</span>
                                          <span className="text-xl font-bold text-orange-600">{avgMoodPoorCompliance.toFixed(1)}/10</span>
                                        </div>
                                        <p className="text-xs text-orange-600 mt-1">{poorComplianceDays.length} days analyzed</p>
                                        <div className="w-full bg-orange-100 rounded-full h-1 mt-2">
                                          <div 
                                            className="bg-orange-500 h-1 rounded-full"
                                            style={{ width: `${(avgMoodPoorCompliance / 10) * 100}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                                <h6 className="font-bold text-blue-800 mb-2 flex items-center">
                                  <span className="mr-2">💡</span>
                                  Personalized Recommendations
                                </h6>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                    <span className="text-blue-700">Consistent medicine intake significantly improves your emotional wellbeing</span>
                                  </div>
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                                    <span className="text-purple-700">Set daily reminders to maintain your {avgMoodPerfectCompliance.toFixed(1)}/10 mood level</span>
                                  </div>
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                    <span className="text-green-700">Keep tracking - you're building valuable health insights!</span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : perfectComplianceDays.length > 0 ? (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mb-4 border border-blue-200">
                              <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-lg">📊</span>
                                </div>
                                <div>
                                  <h5 className="font-bold text-blue-800 mb-2">Current Pattern Analysis</h5>
                                  <p className="text-blue-700 mb-3">
                                    On days with perfect medicine compliance, your average mood is <span className="font-bold text-2xl text-blue-600">{avgMoodPerfectCompliance.toFixed(1)}/10</span>
                                  </p>
                                  <p className="text-sm text-blue-600">Based on {perfectComplianceDays.length} days of perfect adherence</p>
                                  <div className="w-full bg-blue-100 rounded-full h-2 mt-3">
                                    <div 
                                      className="bg-blue-500 h-2 rounded-full"
                                      style={{ width: `${(avgMoodPerfectCompliance / 10) * 100}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-5 mb-4 border border-yellow-200">
                              <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                  <span className="text-lg">📈</span>
                                </div>
                                <div>
                                  <h5 className="font-bold text-yellow-800 mb-2">Keep Building Your Health Story</h5>
                                  <p className="text-yellow-700 mb-3">
                                    You have {daysWithBoth} days of combined data. Patterns become clearer with consistent daily logging.
                                  </p>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-yellow-600">Progress to insights</span>
                                    <span className="text-sm font-bold text-yellow-600">{daysWithBoth}/14 days</span>
                                  </div>
                                  <div className="w-full bg-yellow-100 rounded-full h-2">
                                    <div 
                                      className="bg-yellow-500 h-2 rounded-full"
                                      style={{ width: `${(daysWithBoth / 14) * 100}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4">
                            <p className="text-xs text-gray-600 text-center">
                              📊 Analysis based on <span className="font-semibold">{daysWithBoth} days</span> of combined mood and medicine data from the last 30 days.
                              <br />
                              <span className="text-xs text-gray-500 mt-1 block">This correlation analysis helps you understand the connection between medication adherence and emotional wellness.</span>
                            </p>
                          </div>
                        </>
                      );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Medicine Log Section */}
        <div className="mt-12">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">📋</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Medicine Log
                  </h2>
                  <p className="text-gray-600">Track your medication intake history and patterns</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLogs(!showLogs);
                  if (!showLogs && user) {
                    loadMedicineLogs(user.uid);
                  }
                }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-2xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-300/30"
              >
                {showLogs ? (
                  <span className="flex items-center space-x-2">
                    <span>👁️</span>
                    <span>Hide Log</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <span>📊</span>
                    <span>View Medicine Log</span>
                  </span>
                )}
              </button>
            </div>

            {showLogs && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl border border-purple-200 p-6">
                {medicineLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-6">
                      <span className="text-4xl">📋</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">No logs yet</h3>
                    <p className="text-gray-600 text-lg mb-6">Start logging your medicine intake using the buttons above!</p>
                    <div className="inline-flex items-center text-purple-600 font-medium">
                      <span className="mr-2">👆</span>
                      <span>Use "Took it" or "Missed it" buttons on your reminders</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-purple-900 mb-2">Recent Medicine Logs</h3>
                      <p className="text-purple-700">Your medication intake history and compliance tracking</p>
                    </div>
                    {medicineLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg p-4 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                              log.taken 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                                : 'bg-gradient-to-r from-orange-500 to-red-600'
                            }`}>
                              <span className="text-xl text-white">
                                {log.taken ? '✅' : '⚠️'}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-lg">
                                {log.taken ? 'Took' : 'Missed'}: {reminders.find(r => r.id === log.reminderId)?.medicineName || 'Medicine'}
                              </p>
                              <p className="text-gray-600 font-medium">
                                📅 {log.date.toLocaleDateString()} • ⏰ {log.time}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-4 py-2 text-sm font-bold rounded-xl shadow-md ${
                              log.taken 
                                ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200' 
                                : 'bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 border border-orange-200'
                            }`}>
                              {log.taken ? '✅ Taken' : '⚠️ Missed'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {medicineLogs.length > 10 && (
                      <div className="text-center mt-6 pt-4 border-t border-purple-200">
                        <div className="bg-white/50 backdrop-blur-sm rounded-xl px-4 py-3 inline-block">
                          <p className="text-purple-700 font-medium">
                            📊 Showing latest 10 entries out of <span className="font-bold">{medicineLogs.length}</span> total logs
                          </p>
                          <p className="text-xs text-purple-600 mt-1">
                            Complete medication history helps track your health patterns
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
