import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Anonymous login removed - use email/Google only

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-200/60 dark:border-gray-700 shadow-lg shadow-emerald-500/15 overflow-hidden">
            <img src="/Mylogo.png" alt="HealthAssist" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Welcome to HealthAssist</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Your AI-powered health companion</p>
        </div>

        <div className="bg-white/90 dark:bg-gray-800/80 backdrop-blur-xl border border-emerald-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg shadow-emerald-500/10 p-6">
          {/* 20 Free Chats CTA */}
          <div className="mb-5 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-sm text-center">
            💬 <strong>No Login Required - <br />20 Free Voice Chats per day</strong> <br />Sign in for Personal Features
          </div>

          {/* Google Sign-in */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
          >
            🌟 <span className="font-medium">Continue with Google</span>
          </button>

          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="px-3 text-xs uppercase tracking-wide text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Email/Password Form */}
          <form className="space-y-4" onSubmit={handleEmailLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>

            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-sm text-emerald-600 hover:text-emerald-500 mt-1"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don’t have an account? Sign up"}
            </button>
          </form>

          {/* Disclaimer */}
          <div className="mt-5 text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>⚠️ For educational purposes only</p>
            <p>Not a substitute for professional medical advice</p>
          </div>

          {/* Navigate without login */}
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-emerald-600 hover:text-emerald-500">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
