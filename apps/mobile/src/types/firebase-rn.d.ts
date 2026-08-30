// Metro resolves 'firebase/auth' to the React Native build (index.rn.js) via
// the package's "react-native" export condition at bundle time, which is
// where getReactNativePersistence actually lives. Plain `tsc` doesn't follow
// that condition and only sees the browser/Node typings, so we augment them
// here purely for type-checking — the runtime import is unaffected.
import { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
