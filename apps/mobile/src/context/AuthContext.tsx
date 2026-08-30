import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithCredential, linkWithCredential, PhoneAuthProvider, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth, firebaseApp } from '../lib/firebase';
import { api } from '../lib/api';

interface Profile {
  id: string;
  phone: string;
  phoneVerified: boolean;
  fullName?: string;
  role: 'customer' | 'staff' | 'owner';
  preferredLang: 'ar' | 'en';
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: Profile | null;
  loading: boolean;
  recaptchaRef: React.RefObject<FirebaseRecaptchaVerifierModal>;
  sendOtp: (e164Phone: string) => Promise<string>; // returns verificationId
  confirmOtp: (verificationId: string, code: string) => Promise<void>;
  linkPhone: (verificationId: string, code: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signInWithFacebookAccessToken: (accessToken: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);

  async function refreshProfile() {
    try {
      const { data } = await api.get('/api/users/me');
      setProfile({
        id: data.id,
        phone: data.phone,
        phoneVerified: data.phone_verified,
        fullName: data.full_name,
        role: data.role,
        preferredLang: data.preferred_lang,
      });
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) await refreshProfile();
      else setProfile(null);
      setLoading(false);
    });
  }, []);

  // Phone OTP is the primary sign-in path. The reCAPTCHA modal (mounted once
  // near the app root) is required by Firebase to prevent SMS abuse on web-based
  // phone auth — it appears briefly and invisibly in most cases.
  async function sendOtp(e164Phone: string) {
    const provider = new PhoneAuthProvider(auth);
    return provider.verifyPhoneNumber(e164Phone, recaptchaRef.current!);
  }

  async function confirmOtp(verificationId: string, code: string) {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    await signInWithCredential(auth, credential);
    await refreshProfile();
  }

  // Links a phone number (via OTP) onto an already-signed-in Google/Facebook
  // account — required before that user's first order, per business rule
  // that every account must carry a verified phone regardless of sign-up method.
  async function linkPhone(verificationId: string, code: string) {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    await linkWithCredential(auth.currentUser!, credential);
    await api.post('/api/users/me/confirm-phone');
    await refreshProfile();
  }

  // Google/Facebook sign-in: the credential is obtained on the native side via
  // expo-auth-session (see screens/Auth/SocialButtons.tsx) and exchanged here.
  // Neither path grants a verified phone — the app must prompt for one before checkout.
  async function signInWithGoogleIdToken(idToken: string) {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    await refreshProfile();
  }

  async function signInWithFacebookAccessToken(accessToken: string) {
    const credential = FacebookAuthProvider.credential(accessToken);
    await signInWithCredential(auth, credential);
    await refreshProfile();
  }

  // Sign in with Apple — required by App Store review guideline 4.8 since we
  // offer other third-party logins (Google/Facebook); iOS-only, Apple doesn't
  // provide this on Android. Apple requires a nonce round-trip: we hash a
  // random value, send the hash to Apple, then pass the original (raw) value
  // to Firebase so it can verify Apple's response matches our request.
  async function signInWithApple() {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: appleCredential.identityToken!, rawNonce });
    await signInWithCredential(auth, credential);
    await refreshProfile();
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        recaptchaRef,
        sendOtp,
        confirmOtp,
        linkPhone,
        signInWithGoogleIdToken,
        signInWithFacebookAccessToken,
        signInWithApple,
        refreshProfile,
      }}
    >
      <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={(firebaseApp.options as any)} />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
