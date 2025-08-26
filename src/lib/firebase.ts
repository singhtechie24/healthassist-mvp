// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, setAnalyticsCollectionEnabled } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Note: Anonymous authentication removed - users can use 20 free chats without auth

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Enable offline persistence for better user experience
import { enableNetwork } from 'firebase/firestore';

// Enable network for Firestore
if (typeof window !== 'undefined') {
  enableNetwork(db).catch(console.error);
}

// Initialize Analytics (only in browser environment)
let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

// Analytics control functions
export const enableAnalytics = () => {
  if (analytics) {
    setAnalyticsCollectionEnabled(analytics, true);
    console.log('✅ Analytics enabled - data sharing ON');
  }
};

export const disableAnalytics = () => {
  if (analytics) {
    setAnalyticsCollectionEnabled(analytics, false);
    console.log('🔒 Analytics disabled - data sharing OFF');
  }
};

export default app;
