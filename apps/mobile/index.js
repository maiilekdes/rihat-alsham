import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

// Explicit entry point instead of expo/AppEntry.js: in this npm-workspaces
// monorepo `expo` is hoisted to the repo root, so AppEntry's relative
// `import App from '../../App'` resolves to the monorepo root, not to this app.
//
// App.tsx and its imports run module-level code (i18n/RTL setup, Firebase
// initialisation, the notification handler). If any of that throws, the bundle
// never evaluates, React never mounts, and neither the error boundary nor the
// loading screen can render — the app is simply a white screen with nothing
// reported anywhere. Loading it inside try/catch is the only layer that can
// still show what happened.
let App = null;
let startupError = null;

try {
  App = require('./App').default;
} catch (error) {
  startupError = error;
}

function StartupError({ error }) {
  const message = (error && (error.message || String(error))) || 'Unknown error';
  const stack = (error && error.stack) || '';
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: '#FBF1DE', padding: 22, paddingTop: 80 } },
    React.createElement(
      Text,
      { style: { fontSize: 21, fontWeight: '700', color: '#6E1B14' } },
      'Startup error'
    ),
    React.createElement(
      Text,
      { style: { fontSize: 12.5, color: '#8A7458', marginTop: 6 } },
      'The app failed to start. Details below.'
    ),
    React.createElement(
      ScrollView,
      {
        style: {
          flex: 1,
          marginTop: 16,
          backgroundColor: '#FFFDF8',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#DCC79A',
        },
        contentContainerStyle: { padding: 12 },
      },
      React.createElement(
        Text,
        { selectable: true, style: { fontSize: 11, color: '#2C1B10' } },
        message + (stack ? '\n\n' + stack : '')
      )
    )
  );
}

registerRootComponent(
  startupError ? () => React.createElement(StartupError, { error: startupError }) : App
);
