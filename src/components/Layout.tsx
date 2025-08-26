import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface LayoutProps {
  children: React.ReactNode;
}

interface FeatureFlags {
  FF_TIPS: boolean;
  FF_SCANNER: boolean;
  FF_VOICE: boolean;
  FF_MAP: boolean;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    FF_TIPS: false,       // Default to disabled until loaded from Firebase
    FF_SCANNER: false,
    FF_VOICE: true,       // Enable voice chat by default
    FF_MAP: true
  });

  // Load user feature flags
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🔧 Layout: Auth state changed, user:', currentUser?.email || 'none');
      
      if (currentUser) {
        try {
          console.log('🔍 Layout: Loading feature flags for user:', currentUser.uid);
          const q = query(collection(db, 'userSettings'), where('userId', '==', currentUser.uid));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            console.log('📦 Layout: Loaded user data:', userData);
            
            if (userData.featureFlags) {
              console.log('🚩 Layout: Found feature flags:', userData.featureFlags);
              setFeatureFlags(prev => {
                const newFlags = {
                  ...prev,
                  ...userData.featureFlags
                };
                console.log('🔄 Layout: Setting feature flags:', newFlags);
                return newFlags;
              });
            } else {
              console.log('⚠️ Layout: No feature flags found in user data');
            }
          } else {
            console.log('📭 Layout: No user settings document found, using defaults');
          }
        } catch (error) {
          console.error('❌ Layout: Error loading feature flags:', error);
        }
      } else {
        console.log('🔒 Layout: No user, using default feature flags');
        // Reset to defaults when no user (Tips disabled by default)
        setFeatureFlags({
          FF_TIPS: false,
          FF_SCANNER: false,
          FF_VOICE: true,       // Enable voice chat even for non-authenticated users
          FF_MAP: true
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const baseNavLinks = [
    { path: '/dashboard', label: 'Dashboard', requiresAuth: true },
    { path: '/chat', label: 'Chat', requiresAuth: false },
    { path: '/mood', label: 'Mood', requiresAuth: true },
    { path: '/reminders', label: 'Reminders', requiresAuth: true },
    { path: '/emergency', label: 'Emergency', requiresAuth: false },
    { path: '/settings', label: 'Settings', requiresAuth: true },
  ];

  // Conditionally add Tips based on feature flag
  const navLinks = featureFlags.FF_TIPS 
    ? [...baseNavLinks, { path: '/tips', label: 'Tips', requiresAuth: false }]
    : baseNavLinks;

  // Debug: Log navigation state
  console.log('🔗 Layout: FF_TIPS =', featureFlags.FF_TIPS, '| Expected count =', featureFlags.FF_TIPS ? 7 : 6, '| Actual count =', navLinks.length);
  console.log('📝 Layout: navLinks =', navLinks.map(link => link.label).join(', '));
  console.log('🎯 Layout: Tips should be', featureFlags.FF_TIPS ? 'VISIBLE' : 'HIDDEN');

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-950 font-['Manrope',_sans-serif] transition-colors">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-teal-200/20 dark:bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-100/10 dark:bg-emerald-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Header - Enhanced Professional */}
      <nav className="relative z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-emerald-200/50 dark:border-gray-700/50 shadow-lg shadow-emerald-500/10 transition-colors">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-20">
            {/* Logo Section - Enhanced */}
            <div className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="group flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-2xl p-2 transition-all duration-200"
                aria-label="HealthAssist Home"
              >
                {/* PNG Logo */}
                <img 
                  src="/Mylogo.png" 
                  alt="HealthAssist Logo" 
                  className="w-12 h-12 object-contain group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
                {/* Fallback Logo */}
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-200 hidden">
                  H
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                    HealthAssist
                  </h1>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    AI Health Companion
                  </p>
                </div>
              </Link>
            </div>
            
            {/* Navigation Links - Enhanced */}
            <div className="flex items-center space-x-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`group relative px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex items-center space-x-2 ${
                    isActive(link.path)
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shadow-lg shadow-emerald-500/20 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/50'
                      : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/80 dark:hover:bg-gray-700/50 hover:shadow-lg hover:shadow-gray-500/10 hover:backdrop-blur-sm hover:border hover:border-gray-200/50 dark:hover:border-gray-600/50'
                  }`}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                >
                  <span>{link.label}</span>
                  {link.requiresAuth && (
                    <div className="w-4 h-4 bg-emerald-500/20 dark:bg-emerald-400/20 rounded-full flex items-center justify-center" title="Requires account">
                      <span className="text-xs">🔒</span>
                    </div>
                  )}
                  {/* Active indicator */}
                  {isActive(link.path) && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full"></div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
}
