/**
 * Vendored from expo-firebase-recaptcha, which Expo removed in SDK 48 and which
 * cannot be installed on SDK 54 (it pins react-native <1.0 and drags in the
 * abandoned expo-firebase-core native module, breaking `pod install`).
 *
 * Only the WebView-based reCAPTCHA verifier is kept — that part is pure JS and
 * still works, because it just hosts Google's own reCAPTCHA page. The upstream
 * dependency on expo-firebase-core was only ever used to supply a default
 * firebaseConfig, which we pass explicitly instead.
 */

/** Matches Firebase's ApplicationVerifier interface. */
export interface FirebaseAuthApplicationVerifier {
  readonly type: string;
  verify(): Promise<string>;
}

/** The subset of Firebase web options the reCAPTCHA page needs. */
export interface FirebaseOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  [key: string]: unknown;
}

/** Replaces expo-modules-core's CodedError so this folder has no native deps. */
export class CodedError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CodedError';
  }
}
