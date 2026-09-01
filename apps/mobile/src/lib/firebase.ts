import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const firebaseConfig = Constants.expoConfig?.extra?.firebase ?? {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Persist the Firebase session across app restarts via AsyncStorage —
// otherwise every cold start would force the user through OTP again.
// initializeAuth runs at import time, so a failure here prevents the whole
// bundle from evaluating — no React, no error screen, just a blank app. Fall
// back to an auth instance without persistence rather than taking that risk;
// the user re-authenticates on cold start, which beats an app that cannot open.
let authInstance: ReturnType<typeof initializeAuth>;
try {
  authInstance = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  console.warn('Firebase auth persistence unavailable, continuing without it:', e);
  authInstance = getAuth(firebaseApp);
}

export const auth = authInstance;
