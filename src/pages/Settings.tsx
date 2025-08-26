import { useState, useEffect, useCallback } from 'react';
import { auth, db, enableAnalytics, disableAnalytics } from '../lib/firebase';
import { useTheme } from '../hooks/useTheme';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import ToastService from '../services/toastService';

interface UserSettings {
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  dataSharing: boolean;
}

interface FeatureFlags {
  FF_TIPS: boolean;      // Health tips feature
  FF_SCANNER: boolean;   // Food scanner (barcode)
  FF_VOICE: boolean;     // Voice input for chat
  FF_MAP: boolean;       // Google Maps in emergency sim
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    theme: 'light',
    language: 'en',
    dataSharing: false
  });
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    FF_TIPS: true,        // Tips enabled by default
    FF_SCANNER: false,    // Scanner off by default (experimental)
    FF_VOICE: false,      // Voice off by default (experimental)
    FF_MAP: true          // Maps enabled if API key present
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  // Load user settings from Firebase (using EXACT same pattern as Mood/Reminders)
  const loadUserSettings = useCallback(async (userId: string) => {
    try {
      // Use same pattern as mood/reminders
      const q = query(collection(db, 'userSettings'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        setSettings(prev => ({
          ...prev,
          ...userData.settings
        }));
        setFeatureFlags(prev => ({
          ...prev,
          ...userData.featureFlags
        }));
        
        // Initialize analytics based on loaded setting
        if (userData.settings?.dataSharing) {
          enableAnalytics();
        } else {
          disableAnalytics();
        }
        
        // Initialize theme based on loaded setting
        if (userData.settings?.theme) {
          setTheme(userData.settings.theme);
        }
      } else {
        // No settings found, use defaults and disable analytics by default
        disableAnalytics();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // On error, disable analytics for safety
      disableAnalytics();
    }
  }, [setTheme]);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserSettings(currentUser.uid);
      } else {
        setUser(null);
        navigate('/');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [navigate, loadUserSettings]);

  // Save settings to Firebase (using EXACT same pattern as Mood/Reminders)
  const saveSettings = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      // Check if user already has settings document
      const q = query(collection(db, 'userSettings'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const settingsData = {
        userId: user.uid,
        settings,
        featureFlags,
        updatedAt: new Date()
      };
      
      if (!querySnapshot.empty) {
        // Update existing document (same as reminders)
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(existingDoc.ref, settingsData);
      } else {
        // Create new document (same as mood/reminders)
        await addDoc(collection(db, 'userSettings'), settingsData);
      }
      
      ToastService.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      ToastService.error('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export ALL user data from Firebase (real export)
  const exportUserData = async () => {
    if (!user) return;
    
    setIsExporting(true);
    try {
      const userData: Record<string, unknown> = {
        accountInfo: {
          userId: user.uid,
          email: user.email || 'Anonymous',
          createdAt: user.metadata.creationTime,
          exportedAt: new Date().toISOString()
        },
        settings,
        featureFlags
      };

      // Export ALL collections (complete list)
      const collections = [
        'moodLogs', 
        'reminders', 
        'userSettings', 
        'medicineLogs',
        'tipPreferences',    // User's tip preferences
        'articlePreferences', // User's article preferences  
        'userStreaks'        // User's reading streaks
      ];
      
      // Export main collections
      for (const collectionName of collections) {
        try {
          const q = query(collection(db, collectionName), where('userId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          userData[collectionName] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          const items = userData[collectionName] as unknown[];
          console.log(`✅ Exported ${items.length} items from ${collectionName}`);
        } catch (error) {
          console.warn(`⚠️ Failed to export ${collectionName}:`, error);
          userData[collectionName] = [];
        }
      }

      // Export subcollections under users/{userId}/
      const subcollections = ['conversations', 'memories', 'meta'];
      for (const subcollectionName of subcollections) {
        try {
          const subcollectionRef = collection(db, 'users', user.uid, subcollectionName);
          const querySnapshot = await getDocs(subcollectionRef);
          userData[`user_${subcollectionName}`] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          const items = userData[`user_${subcollectionName}`] as unknown[];
          console.log(`✅ Exported ${items.length} items from users/${user.uid}/${subcollectionName}`);
        } catch (error) {
          console.warn(`⚠️ Failed to export users/${user.uid}/${subcollectionName}:`, error);
          userData[`user_${subcollectionName}`] = [];
        }
      }

      // Create and download JSON file
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `healthassist-complete-data-${user.uid}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      ToastService.success('✅ Complete data exported successfully! Check your downloads folder.', { duration: 6000 });
    } catch (error) {
      console.error('Error exporting data:', error);
      ToastService.error('❌ Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Delete ALL user data from Firebase (REAL deletion)
  const deleteUserAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Delete ALL user data from ALL collections
      const collections = [
        'moodLogs', 
        'reminders', 
        'userSettings', 
        'medicineLogs',
        'tipPreferences',    // User's tip preferences
        'articlePreferences', // User's article preferences  
        'userStreaks'        // User's reading streaks
      ];
      let totalDeleted = 0;
      
      // 1. Delete from main collections
      for (const collectionName of collections) {
        try {
          // Get all documents for this user
          const q = query(collection(db, collectionName), where('userId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          
          // Delete all documents
          const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          
          console.log(`✅ Deleted ${querySnapshot.docs.length} items from ${collectionName}`);
          totalDeleted += querySnapshot.docs.length;
        } catch (error) {
          console.warn(`⚠️ Failed to delete ${collectionName}:`, error);
        }
      }

      // 2. Delete subcollections under users/{userId}/
      const subcollections = ['conversations', 'memories', 'meta'];
      for (const subcollectionName of subcollections) {
        try {
          const subcollectionRef = collection(db, 'users', user.uid, subcollectionName);
          const querySnapshot = await getDocs(subcollectionRef);
          
          // Delete all documents in subcollection
          const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          
          console.log(`✅ Deleted ${querySnapshot.docs.length} items from users/${user.uid}/${subcollectionName}`);
          totalDeleted += querySnapshot.docs.length;
        } catch (error) {
          console.warn(`⚠️ Failed to delete users/${user.uid}/${subcollectionName}:`, error);
        }
      }

      // 3. Delete the user document itself (this also removes all subcollections)
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await deleteDoc(userDocRef);
        console.log(`✅ Deleted user document: users/${user.uid}`);
        totalDeleted += 1;
      } catch (error) {
        console.warn(`⚠️ Failed to delete user document:`, error);
      }

      // Sign out and redirect
      await signOut(auth);
      ToastService.success(`✅ Account deleted successfully! Removed ${totalDeleted} items from all collections. All your data has been permanently deleted.`, { duration: 8000 });
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      ToastService.error('❌ Failed to delete account. Please try again or contact support.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-6 shadow-lg animate-pulse">
            <span className="text-3xl">⚙️</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Settings
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Manage your preferences, account settings, and customize your HealthAssist experience
          </p>
        </div>

        {/* User Info */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl p-8 mb-8 transition-all duration-300 hover:shadow-3xl">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-xl">👤</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl p-4 border border-green-200 dark:border-green-700">
              <label className="text-sm font-bold text-green-800 dark:text-green-300 block mb-2">User ID</label>
              <p className="text-sm text-green-700 dark:text-green-300 font-mono break-all">{user?.uid || 'Not logged in'}</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-700">
              <label className="text-sm font-bold text-blue-800 dark:text-blue-300 block mb-2">Email</label>
              <p className="text-sm text-blue-700 dark:text-blue-300">{user?.email || 'Anonymous user'}</p>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-4 border border-purple-200 dark:border-purple-700 md:col-span-2">
              <label className="text-sm font-bold text-purple-800 dark:text-purple-300 block mb-2">Account Created</label>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                {user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* User Preferences */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl p-8 mb-8 transition-all duration-300 hover:shadow-3xl">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-xl">🔔</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Preferences</h2>
          </div>
          <div className="space-y-8">
            {/* Notifications */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-lg">🔔</span>
                  </div>
                  <div>
                    <label className="text-lg font-bold text-green-800">Notifications</label>
                    <p className="text-sm text-green-700">Receive reminders and health alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${
                    settings.notifications ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      settings.notifications ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-lg">🎨</span>
                </div>
                <div>
                  <label className="text-lg font-bold text-blue-800 block">Theme</label>
                  <p className="text-sm text-blue-700">Choose your preferred color scheme</p>
                </div>
              </div>
              <select
                value={theme}
                onChange={(e) => {
                  const newTheme = e.target.value as 'light' | 'dark' | 'system';
                  setTheme(newTheme);
                  setSettings(prev => ({ ...prev, theme: newTheme }));
                }}
                className="block w-full px-4 py-3 border-2 border-blue-300 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-white text-gray-900 transition-all duration-300 font-medium"
              >
                <option value="light">🌞 Light</option>
                <option value="dark">🌙 Dark</option>
                <option value="system">🖥️ System</option>
              </select>
            </div>

            {/* Language */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-lg">🌍</span>
                </div>
                <div>
                  <label className="text-lg font-bold text-purple-800 block">Language</label>
                  <p className="text-sm text-purple-700">Select your preferred language</p>
                </div>
              </div>
              <select
                value={settings.language}
                onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                className="block w-full px-4 py-3 border-2 border-purple-300 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 bg-white text-gray-900 transition-all duration-300 font-medium"
              >
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Spanish</option>
                <option value="fr">🇫🇷 French</option>
                <option value="de">🇩🇪 German</option>
              </select>
            </div>

            {/* Data Sharing */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <label className="text-lg font-bold text-orange-800">Anonymous Data Sharing</label>
                    <p className="text-sm text-orange-700">Help improve HealthAssist with anonymized usage data</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newDataSharing = !settings.dataSharing;
                    setSettings(prev => ({ ...prev, dataSharing: newDataSharing }));
                    
                    // Control Firebase Analytics based on user preference
                    if (newDataSharing) {
                      enableAnalytics();
                    } else {
                      disableAnalytics();
                    }
                  }}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${
                    settings.dataSharing ? 'bg-gradient-to-r from-orange-500 to-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      settings.dataSharing ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
        </div>

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300/30 disabled:hover:scale-100"
              >
                {isSaving ? '💾 Saving...' : '💾 Save Preferences'}
              </button>
            </div>
          </div>
        </div>

        {/* Feature Flags */}
        <div className="bg-white/80 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl p-8 mb-8 transition-all duration-300 hover:shadow-3xl">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-xl">🚩</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Feature Flags</h2>
              <p className="text-gray-600">Toggle experimental and optional features. Changes take effect immediately.</p>
            </div>
          </div>
        
          <div className="space-y-6">
            {/* Health Tips */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-lg">💡</span>
                  </div>
                  <div>
                    <label className="text-lg font-bold text-green-800">Health Tips</label>
                    <p className="text-sm text-green-700">Daily health tips and educational content</p>
                  </div>
                </div>
                <button
                  onClick={() => setFeatureFlags(prev => ({ ...prev, FF_TIPS: !prev.FF_TIPS }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${
                    featureFlags.FF_TIPS ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      featureFlags.FF_TIPS ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Google Maps */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-lg">🗺️</span>
                  </div>
                  <div>
                    <label className="text-lg font-bold text-blue-800">Enhanced Emergency Maps</label>
                    <p className="text-sm text-blue-700">Google Maps integration in emergency simulator</p>
                    {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ API key required</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setFeatureFlags(prev => ({ ...prev, FF_MAP: !prev.FF_MAP }))}
                  disabled={!import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${
                    featureFlags.FF_MAP && import.meta.env.VITE_GOOGLE_MAPS_API_KEY 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600' 
                      : 'bg-gray-300'
                  } ${!import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      featureFlags.FF_MAP ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Food Scanner */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-lg">📱</span>
                  </div>
                  <div>
                    <label className="text-lg font-bold text-orange-800">Food Scanner</label>
                    <p className="text-sm text-orange-700">Barcode scanning for nutritional information</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">🧪 Experimental feature</p>
                  </div>
                </div>
                <button
                  onClick={() => setFeatureFlags(prev => ({ ...prev, FF_SCANNER: !prev.FF_SCANNER }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${
                    featureFlags.FF_SCANNER ? 'bg-gradient-to-r from-orange-500 to-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      featureFlags.FF_SCANNER ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Voice Input */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-lg">🎤</span>
                  </div>
                  <div>
                    <label className="text-lg font-bold text-purple-800">Voice Input</label>
                    <p className="text-sm text-purple-700">Speech-to-text in chat (Web Speech API)</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">🧪 Experimental feature</p>
                  </div>
                </div>
                <button
                  onClick={() => setFeatureFlags(prev => ({ ...prev, FF_VOICE: !prev.FF_VOICE }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 shadow-lg ${
                    featureFlags.FF_VOICE ? 'bg-gradient-to-r from-purple-500 to-pink-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      featureFlags.FF_VOICE ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
        </div>

          {/* Feature Flags Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-sm">ℹ️</span>
                </div>
                <h3 className="text-lg font-bold text-blue-900">About Feature Flags</h3>
              </div>
              <ul className="text-sm text-blue-800 space-y-3">
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Stable features</strong> are ready for daily use and thoroughly tested</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Experimental features</strong> (🧪) may have bugs or change behavior</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Changes are automatically saved with your other preferences</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Some features require API keys or specific browser support</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white/80 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-xl">🗑️</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Data Management</h2>
              <p className="text-gray-600">Export your data or permanently delete your account</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Export Data */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-lg">📦</span>
                </div>
                <h3 className="text-xl font-bold text-blue-900">Export Your Data</h3>
              </div>
              <p className="text-blue-800 mb-6">
                Download all your HealthAssist data including mood logs, reminders, chat sessions, and settings. 
                The data will be exported as a secure JSON file.
              </p>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-blue-300">
                <h4 className="text-lg font-bold text-blue-900 mb-3 flex items-center">
                  <span className="mr-2">📋</span>
                  What's included:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span className="text-sm text-blue-800">Account information and settings</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-blue-800">All mood logs and emotional data</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    <span className="text-sm text-blue-800">Medicine reminders and schedules</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span className="text-sm text-blue-800">Chat conversation metadata</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <span className="text-sm text-blue-800">Emergency simulation history</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                    <span className="text-sm text-blue-800">Feature preferences</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <button
                  onClick={exportUserData}
                  disabled={isExporting}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300/30 disabled:hover:scale-100"
                >
                  {isExporting ? '📦 Exporting...' : '📦 Export My Data'}
                </button>
              </div>
            </div>

            {/* Delete Account */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-200 shadow-lg">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-lg">🚨</span>
                </div>
                <h3 className="text-xl font-bold text-red-900">Delete Account</h3>
              </div>
              <p className="text-red-800 mb-6">
                Permanently delete your HealthAssist account and all associated data. 
                <strong>This action cannot be undone.</strong>
              </p>
            
              <div className="text-center">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-8 py-4 rounded-2xl font-semibold hover:from-red-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300/30"
                  >
                    🗑️ Delete My Account
                  </button>
                ) : (
                  <div className="bg-white/90 backdrop-blur-sm border border-red-300 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600">⚠️</span>
                      </div>
                      <h4 className="text-lg font-bold text-red-900">Confirm Account Deletion</h4>
                    </div>
                    <p className="text-red-800 mb-6">
                      Are you absolutely sure? This will permanently delete:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-sm text-red-700">Your account and all login information</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-sm text-red-700">All mood logs and mental health data</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-sm text-red-700">All medicine reminders and schedules</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-sm text-red-700">All chat conversations and AI interactions</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-sm text-red-700">All emergency simulation history</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-sm text-red-700">All settings and preferences</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={deleteUserAccount}
                        disabled={isDeleting}
                        className="bg-gradient-to-r from-red-700 to-red-800 text-white px-6 py-3 rounded-xl font-semibold hover:from-red-800 hover:to-red-900 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300/30 disabled:hover:scale-100"
                      >
                        {isDeleting ? '🗑️ Deleting...' : '🗑️ Yes, Delete Everything'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-gray-600 hover:to-gray-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300/30 disabled:hover:scale-100"
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>

            {/* Data Privacy Info */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-sm">🔒</span>
                </div>
                <h3 className="text-lg font-bold text-green-900">Your Privacy Matters</h3>
              </div>
              <ul className="text-sm text-green-800 space-y-3">
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>All data is stored securely and encrypted with industry-standard protocols</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Only you can access your personal health information</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Data export gives you complete control over your information</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Account deletion removes all traces from our systems permanently</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span>We never share your health data with third parties under any circumstances</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

