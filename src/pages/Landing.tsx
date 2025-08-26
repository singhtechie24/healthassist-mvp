import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import '../styles/animations.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Load Google Fonts - Adaline Style
const loadGoogleFonts = () => {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};

// Load fonts on component mount
if (typeof window !== 'undefined') {
  loadGoogleFonts();
}

export default function Landing() {
  // Refs for GSAP animations
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const valuePropRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const disclaimerRef = useRef<HTMLDivElement>(null);
  
  // Track if GSAP is working
  const [gsapFailed, setGsapFailed] = useState(false);
  
  // User authentication state
  const [user, setUser] = useState<User | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Helper functions for user display
  const getUserDisplayName = () => {
    if (!user) return 'User';
    return user.displayName || user.email?.split('@')[0] || 'User';
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.charAt(0).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      console.log('🎬 GSAP Animation Starting...');
      console.log('GSAP available:', !!gsap);
      console.log('ScrollTrigger available:', !!ScrollTrigger);
      
      try {
        // Professional, elegant hero animations
        const heroTl = gsap.timeline({ delay: 0.3 });
        
        heroTl
          .fromTo(".hero-title", {
            opacity: 0,
            y: 60,
            scale: 0.95
          }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.8,
            ease: "power3.out"
          })
          .fromTo(".hero-subtitle", {
            opacity: 0,
            y: 40
          }, {
            opacity: 1,
            y: 0,
            duration: 1.5,
            ease: "power3.out"
          }, "-=1.2")
          .fromTo(".hero-cta", {
            opacity: 0,
            y: 30
          }, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power3.out"
          }, "-=0.8")
          .fromTo(".hero-features", {
            opacity: 0,
            y: 20
          }, {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out"
          }, "-=0.6")
          .fromTo(".hero-mockup", {
            opacity: 0,
            x: 80,
            scale: 0.9
          }, {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 2,
            ease: "power3.out"
          }, "-=1.5");
        
        console.log('✅ Professional GSAP animations initialized');
      } catch (error) {
        console.error('❌ GSAP failed:', error);
        setGsapFailed(true);
        return;
      }
      
        // Professional scroll animations with smooth timing
        
        // Features section - subtle, elegant entrance
        gsap.fromTo(".feature-card", {
          y: 60,
          opacity: 0,
          scale: 0.95
        }, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1.5,
          ease: "power2.out",
          stagger: 0.2,
          scrollTrigger: {
            trigger: featuresRef.current,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
            markers: false
          }
        });

        // Value proposition - sophisticated fade-in
        gsap.fromTo(".value-prop-content", {
          y: 50,
          opacity: 0
        }, {
          y: 0,
          opacity: 1,
          duration: 1.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: valuePropRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse"
          }
        });

        // Stat cards - elegant sequential reveal
        gsap.fromTo(".stat-card", {
          y: 40,
          opacity: 0,
          scale: 0.9
        }, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1.4,
          ease: "power2.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: valuePropRef.current,
            start: "top 65%",
            toggleActions: "play none none reverse"
          }
        });

        // Testimonials - smooth, professional reveal
        gsap.fromTo(".testimonial-header", {
          y: 40,
          opacity: 0
        }, {
          y: 0,
          opacity: 1,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: testimonialsRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        });

        // Disclaimer - gentle, trustworthy entrance
        gsap.fromTo(".disclaimer-content", {
          y: 30,
          opacity: 0
        }, {
          y: 0,
          opacity: 1,
          duration: 1.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: disclaimerRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse"
          }
        });

        // Enhanced smooth scrolling and parallax effects
        
        // Subtle parallax for floating elements - super smooth
        gsap.to(".parallax-slow", {
          y: -30,
          ease: "none",
          scrollTrigger: {
            trigger: "body",
            start: "top bottom",
            end: "bottom top",
            scrub: 3 // Much slower, buttery smooth
          }
        });

        gsap.to(".parallax-fast", {
          y: -60,
          ease: "none",
          scrollTrigger: {
            trigger: "body",
            start: "top bottom", 
            end: "bottom top",
            scrub: 2 // Smoother scrub for professional feel
          }
        });

      }, 200); // Slightly longer delay for better initialization

    // Cleanup function
    return () => {
      clearTimeout(timer);
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 font-['Manrope',_sans-serif] scroll-smooth page-transition ${gsapFailed ? 'gsap-fallback' : ''}`}>
      {/* Navigation Header - Glassmorphism */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-white/30 shadow-lg shadow-emerald-500/5">
        <div className="w-full px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo - Fixed to Left */}
            <div className="flex items-center space-x-3">
              {/* PNG Logo */}
              <img 
                src="/Mylogo.png" 
                alt="HealthAssist Logo" 
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  // Fallback to CSS logo if PNG fails to load
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'block';
                  }
                }}
              />
              {/* Fallback CSS Logo (hidden by default) */}
              <div className="w-8 h-8 relative" style={{display: 'none'}}>
                <div className="w-8 h-8 bg-emerald-500 rounded-sm flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-emerald-500 rounded-sm"></div>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <div className="relative z-10 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              <h1 className="text-xl font-bold text-emerald-600 font-['Manrope',_sans-serif]">HealthAssist</h1>
            </div>
            
            {/* Navigation Actions - Fixed to Right */}
            <div className="flex items-center space-x-3">
              {user ? (
                // Logged in user - show profile circle and dashboard link
                <div className="flex items-center space-x-3">
                  <Link 
                    to="/dashboard"
                    className="text-gray-700 hover:text-emerald-600 font-medium transition-all duration-300 px-3 py-2 rounded-lg hover:bg-emerald-50/50"
                  >
                    Dashboard
                  </Link>
                  
                  {/* User Profile Circle with Dropdown */}
                  <div className="relative group">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-emerald-500/40 transform hover:scale-105">
                      {getUserInitials()}
                    </div>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl border border-emerald-100 rounded-2xl shadow-2xl shadow-emerald-500/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 z-50">
                      <div className="p-4 border-b border-emerald-100">
                        <div className="font-semibold text-gray-900">{getUserDisplayName()}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <div className="p-2">
                        <Link 
                          to="/dashboard"
                          className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors font-medium"
                        >
                          📊 Dashboard
                        </Link>
                        <Link 
                          to="/settings"
                          className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors font-medium"
                        >
                          ⚙️ Settings
                        </Link>
                        <button 
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                        >
                          🚪 Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Not logged in - show original sign in and get started buttons
                <>
                  <Link 
                    to="/login"
                    className="text-gray-700 hover:text-emerald-600 font-medium transition-all duration-300 px-3 py-2 rounded-lg hover:bg-emerald-50/50"
                  >
                    Sign In
                  </Link>
                  <Link 
                    to="/chat"
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div ref={heroRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight font-['Manrope',_sans-serif] tracking-tight">
              Your AI Health Companion
              <span className="text-emerald-600 block">That Actually Listens</span>
            </h1>
            
            <p className="hero-subtitle text-xl text-gray-600 mb-8 max-w-3xl lg:max-w-none leading-relaxed">
              Get personalized health guidance, track your wellness journey, and never miss important reminders - 
              all powered by intelligent AI that learns from you. <span className="font-medium text-emerald-700">Educational purposes only.</span>
            </p>

            <div className="hero-cta flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Link 
                to="/chat"
                className="group bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-2xl hover:from-emerald-600 hover:to-emerald-700 font-medium text-base shadow-md transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>🚀</span>
                  <span>Start Your Health Journey</span>
                  <span className="text-emerald-100">• 20 Free Chats</span>
                </span>
              </Link>
              
              <Link 
                to="/login"
                className="group bg-white/80 backdrop-blur-sm text-emerald-600 px-6 py-3 rounded-2xl hover:bg-white font-medium text-base border border-emerald-200 hover:border-emerald-300 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>📊</span>
                  <span>Get Full Access</span>
                </span>
              </Link>
            </div>

            {/* Moving Feature Showcase */}
            <div className="hero-features">
              <div className="overflow-hidden">
                <div className="flex animate-scroll-x space-x-8 text-sm font-medium text-gray-500">
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></span>
                    AI Health Conversations
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
                    Mood & Wellness Tracking
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-3 animate-pulse"></span>
                    Smart Medication Reminders
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></span>
                    Emergency Preparedness
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-amber-500 rounded-full mr-3 animate-pulse"></span>
                    Personalized Health Tips
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mr-3 animate-pulse"></span>
                    Privacy & Security First
                  </div>
                  {/* Duplicate for seamless loop */}
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></span>
                    AI Health Conversations
                  </div>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
                    Mood & Wellness Tracking
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Visual Element */}
          <div className="hero-mockup flex justify-center lg:justify-end">
            <div className="relative">
              {/* Floating Chat Interface Mockup */}
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 max-w-md w-full border border-white/30 glass-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">AI</span>
                    </div>
                    <span className="font-semibold text-gray-800">HealthAssist</span>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-lg p-3 text-sm">
                    👋 Hi! I'm your AI health companion. How can I help you today?
                  </div>
                  <div className="bg-emerald-500 text-white rounded-lg p-3 text-sm ml-8">
                    I want to start tracking my mood
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3 text-sm">
                    <div className="animate-typing">
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1"></span>
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1" style={{animationDelay: '0.1s'}}></span>
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements with Parallax */}
              <div className="absolute -top-4 -right-4 bg-blue-500 text-white rounded-full p-3 shadow-lg animate-float parallax-slow">
                📊
              </div>
              <div className="absolute -bottom-4 -left-4 bg-purple-500 text-white rounded-full p-3 shadow-lg animate-float parallax-fast" style={{animationDelay: '1s'}}>
                🔔
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div ref={featuresRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need for Better Health
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Smart tools that work together to help you stay informed, organized, and in control of your wellness journey
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* AI Chat Feature */}
          <div className="feature-card group bg-gradient-to-br from-white to-emerald-50/30 p-6 rounded-3xl border border-emerald-100/50 hover:border-emerald-200 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 transform hover:-translate-y-2">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-white text-xl">🤖</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Smart AI Conversations</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Get instant answers to health questions with AI that remembers your history and learns your preferences.
            </p>
            <Link 
              to="/chat"
              className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors group-hover:translate-x-1 duration-300"
            >
              Try Now <span className="ml-1">→</span>
            </Link>
          </div>

          {/* Mood Tracking */}
          <div className="feature-card group bg-gradient-to-br from-white to-blue-50/30 p-6 rounded-3xl border border-blue-100/50 hover:border-blue-200 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 transform hover:-translate-y-2">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-white text-xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Mood & Wellness Tracking</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Understand patterns in your mental and physical health over time with beautiful charts and personalized insights.
            </p>
            <span className="inline-flex items-center text-blue-600 font-medium text-sm">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              With account
            </span>
          </div>

          {/* Reminders */}
          <div className="feature-card group bg-gradient-to-br from-white to-purple-50/30 p-6 rounded-3xl border border-purple-100/50 hover:border-purple-200 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-2">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-white text-xl">🔔</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Never Miss a Dose</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Smart reminders that adapt to your schedule and preferences. Never miss medications or appointments again.
            </p>
            <span className="inline-flex items-center text-purple-600 font-medium text-sm">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              With account
            </span>
          </div>

          {/* Emergency Sim */}
          <div className="feature-card group bg-gradient-to-br from-white to-red-50/30 p-6 rounded-3xl border border-red-100/50 hover:border-red-200 transition-all duration-500 hover:shadow-2xl hover:shadow-red-500/10 transform hover:-translate-y-2">
            <div className="bg-gradient-to-br from-red-500 to-red-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-white text-xl">🆘</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Emergency Preparedness</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Practice life-saving emergency scenarios. Build confidence in critical situations while waiting for professional help.
            </p>
            <Link 
              to="/emergency"
              className="inline-flex items-center text-red-600 hover:text-red-700 font-medium text-sm transition-colors group-hover:translate-x-1 duration-300"
            >
              Try Simulation <span className="ml-1">→</span>
            </Link>
          </div>

          {/* Health Tips */}
          <div className="feature-card group bg-gradient-to-br from-white to-amber-50/30 p-6 rounded-3xl border border-amber-100/50 hover:border-amber-200 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 transform hover:-translate-y-2">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-white text-xl">💡</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Personalized Health Tips</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Discover evidence-based wellness advice, healthy habits, and preventive care tips tailored to your needs.
            </p>
            <Link 
              to="/tips"
              className="inline-flex items-center text-amber-600 hover:text-amber-700 font-medium text-sm transition-colors group-hover:translate-x-1 duration-300"
            >
              View Tips <span className="ml-1">→</span>
            </Link>
          </div>

          {/* Privacy & Security */}
          <div className="feature-card group bg-gradient-to-br from-white to-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50 hover:border-indigo-200 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 transform hover:-translate-y-2">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-white text-xl">🛡️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Privacy & Security First</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Your health data stays completely private. Use anonymously or with an account - you control your information.
            </p>
            <span className="inline-flex items-center text-indigo-600 font-medium text-sm">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              Secure by design
            </span>
          </div>
        </div>
      </div>

      {/* Value Proposition Section - Enhanced */}
      <div ref={valuePropRef} className="relative bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 py-24 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-20 h-20 bg-emerald-300 rounded-full blur-xl animate-float"></div>
          <div className="absolute top-40 right-20 w-16 h-16 bg-blue-300 rounded-full blur-xl animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-20 left-1/3 w-24 h-24 bg-purple-300 rounded-full blur-xl animate-float" style={{animationDelay: '4s'}}></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="value-prop-content text-center mb-16">
            <div className="inline-flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-emerald-200 mb-6">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
              <span className="text-sm font-medium text-emerald-700 uppercase tracking-wide">Our Solution</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
              We combine intelligent AI conversation{' '}
              <span className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl mx-2">
                <span className="text-white text-xl">🤖</span>
              </span>{' '}
              with personal health tracking{' '}
              <span className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-2">
                <span className="text-white text-xl">📊</span>
              </span>{' '}
              and smart reminders{' '}
              <span className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl mx-2">
                <span className="text-white text-xl">🔔</span>
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              ensuring you stay healthy and informed exactly when you need support most
            </p>
          </div>
          
          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card group text-center">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/20 transform hover:-translate-y-2">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-2xl font-bold">24/7</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Health Guidance</h3>
                <p className="text-gray-600 text-sm">Always available when you need answers</p>
              </div>
            </div>
            <div className="stat-card group text-center">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 transform hover:-translate-y-2">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-3xl font-bold">∞</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Personal Insights</h3>
                <p className="text-gray-600 text-sm">Track patterns and improve over time</p>
              </div>
            </div>
            <div className="stat-card group text-center">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/20 transform hover:-translate-y-2">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-3xl font-bold">0</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Missed Medications</h3>
                <p className="text-gray-600 text-sm">Smart reminders that adapt to you</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Section - Inspired by Wellness Health */}
      <div ref={testimonialsRef} className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="testimonial-header text-center mb-16">
            <h2 className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-3">Testimonials</h2>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Health-Conscious People Everywhere
            </h3>
            <div className="flex justify-center items-center space-x-2 mb-6">
              <div className="flex text-yellow-400">
                {"★".repeat(5)}
              </div>
              <span className="text-lg font-semibold text-gray-700">4.8-star rating</span>
              <span className="text-gray-500">from 500+ users</span>
            </div>
          </div>

          {/* Dynamic Moving Testimonials */}
          <div className="relative overflow-hidden">
            <div className="flex animate-testimonial-scroll space-x-6">
              {/* Testimonial 1 */}
              <div className="group flex-shrink-0 w-80 bg-gradient-to-br from-white to-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 hover:border-emerald-200 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 transform hover:-translate-y-2">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                    S
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Sarah Chen</div>
                    <div className="text-sm text-emerald-600 font-medium">92% improvement</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-4xl text-emerald-200 font-serif">"</div>
                  <p className="text-gray-700 leading-relaxed text-sm pl-6">
                    HealthAssist helped me understand my mood patterns better. The AI remembers my preferences and gives relevant advice.
                  </p>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="group flex-shrink-0 w-80 bg-gradient-to-br from-white to-blue-50/50 p-6 rounded-3xl border border-blue-100/50 hover:border-blue-200 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 transform hover:-translate-y-2">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                    M
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Mike Rodriguez</div>
                    <div className="text-sm text-blue-600 font-medium">88% improvement</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-4xl text-blue-200 font-serif">"</div>
                  <p className="text-gray-700 leading-relaxed text-sm pl-6">
                    The medication reminders are a game-changer. I haven't missed a dose in 3 months. Emergency practice gave me confidence.
                  </p>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="group flex-shrink-0 w-80 bg-gradient-to-br from-white to-purple-50/50 p-6 rounded-3xl border border-purple-100/50 hover:border-purple-200 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-2">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                    L
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Lisa Thompson</div>
                    <div className="text-sm text-purple-600 font-medium">95% improvement</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-4xl text-purple-200 font-serif">"</div>
                  <p className="text-gray-700 leading-relaxed text-sm pl-6">
                    The mood tracking feature has been incredibly insightful. The AI provides personalized coping strategies that actually work.
                  </p>
                </div>
              </div>

              {/* Testimonial 4 */}
              <div className="group flex-shrink-0 w-80 bg-gradient-to-br from-white to-orange-50/50 p-6 rounded-3xl border border-orange-100/50 hover:border-orange-200 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10 transform hover:-translate-y-2">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                    J
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">John Davis</div>
                    <div className="text-sm text-orange-600 font-medium">91% improvement</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-4xl text-orange-200 font-serif">"</div>
                  <p className="text-gray-700 leading-relaxed text-sm pl-6">
                    The emergency simulations prepared me for real situations. When my neighbor had a heart attack, I knew exactly what to do.
                  </p>
                </div>
              </div>

              {/* Duplicate for seamless loop */}
              <div className="group flex-shrink-0 w-80 bg-gradient-to-br from-white to-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 hover:border-emerald-200 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 transform hover:-translate-y-2">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                    S
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Sarah Chen</div>
                    <div className="text-sm text-emerald-600 font-medium">92% improvement</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-4xl text-emerald-200 font-serif">"</div>
                  <p className="text-gray-700 leading-relaxed text-sm pl-6">
                    HealthAssist helped me understand my mood patterns better. The AI remembers my preferences and gives relevant advice.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Take Control of Your Health?
            </h3>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Join thousands who've already started their wellness journey with HealthAssist
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link 
                to="/chat"
                className="group bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-2xl hover:from-emerald-600 hover:to-emerald-700 font-medium text-base shadow-md transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>🚀</span>
                  <span>Start Your Free Trial</span>
                  <span className="text-emerald-100">• 20 Chats</span>
                </span>
              </Link>
              <Link 
                to="/login"
                className="group bg-white/80 backdrop-blur-sm text-emerald-600 px-6 py-3 rounded-2xl hover:bg-white font-medium text-base border border-emerald-200 hover:border-emerald-300 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>📊</span>
                  <span>Create Full Account</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer - Enhanced Modern Design */}
      <div ref={disclaimerRef} className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 py-20 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 bg-amber-400 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-10 right-10 w-24 h-24 bg-orange-400 rounded-full blur-2xl animate-float" style={{animationDelay: '3s'}}></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="disclaimer-content bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-amber-200/50">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl mb-4">
                <span className="text-white text-2xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-amber-800 mb-2 font-['Manrope',_sans-serif]">Important: For Educational Purposes Only</h3>
            </div>
            
            <div className="prose prose-lg max-w-none text-center">
              <p className="text-amber-700 leading-relaxed text-lg font-medium mb-4">
                HealthAssist is not a substitute for professional medical advice, diagnosis, or treatment. Always consult 
                qualified healthcare providers for medical concerns.
              </p>
              <p className="text-amber-600 text-base">
                Our AI provides general wellness information and should not be used for emergency situations.
              </p>
            </div>
            
            {/* Professional Trust Indicators */}
            <div className="flex justify-center items-center space-x-8 mt-8 pt-6 border-t border-amber-200">
              <div className="text-center">
                <div className="text-sm font-medium text-amber-700">✓ Educational Content</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-amber-700">✓ Evidence-Based</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-amber-700">✓ Privacy Protected</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Inspired by Wellness Health */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                {/* Your Original Logo */}
                <img 
                  src="/Mylogo.png" 
                  alt="HealthAssist Logo" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    // Fallback to CSS logo if PNG fails to load
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) {
                      fallback.style.display = 'block';
                    }
                  }}
                />
                {/* Fallback CSS Logo */}
                <div className="w-8 h-8 relative" style={{display: 'none'}}>
                  <div className="w-8 h-8 bg-emerald-500 rounded-sm flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-emerald-500 rounded-sm"></div>
                    <div className="relative z-10 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white">HealthAssist</h3>
              </div>
              <p className="text-gray-300 mb-4 max-w-md">
                Your AI-powered health companion that provides personalized guidance, tracks your wellness journey, and keeps you on top of your health goals.
              </p>
              <p className="text-gray-400 text-sm">
                For educational purposes only. Not a substitute for professional medical advice.
              </p>
            </div>

            {/* Features Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Features</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><Link to="/chat" className="hover:text-emerald-400 transition-colors">AI Health Chat</Link></li>
                <li><Link to="/mood" className="hover:text-emerald-400 transition-colors">Mood Tracking</Link></li>
                <li><Link to="/reminders" className="hover:text-emerald-400 transition-colors">Smart Reminders</Link></li>
                <li><Link to="/emergency" className="hover:text-emerald-400 transition-colors">Emergency Practice</Link></li>
                <li><Link to="/tips" className="hover:text-emerald-400 transition-colors">Health Tips</Link></li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><Link to="/about" className="hover:text-emerald-400 transition-colors">About</Link></li>
                <li><Link to="/privacy" className="hover:text-emerald-400 transition-colors">Privacy</Link></li>
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors">Sign Up</Link></li>
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors">Login</Link></li>
                <li><span className="text-gray-400">Support</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-gray-700 pt-8 mt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © 2024 HealthAssist. All rights reserved. Educational purposes only.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <span className="text-gray-500 text-xs">Made with ❤️ for better health</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
