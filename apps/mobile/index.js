import { registerRootComponent } from 'expo';

import App from './App';

// Explicit entry point instead of expo/AppEntry.js. In this npm-workspaces
// monorepo `expo` is hoisted to the repo root, so AppEntry's relative
// `import App from '../../App'` resolves to the monorepo root rather than to
// this app — which is why native builds failed to find an entry module.
registerRootComponent(App);
