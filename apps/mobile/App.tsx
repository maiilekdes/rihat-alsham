import './src/lib/i18n';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import { api } from './src/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function PushRegistration() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      // The backend sends via firebase-admin's Messaging API directly, so we
      // need the raw FCM/APNs device token here, not an Expo push token.
      const { data: pushToken } = await Notifications.getDevicePushTokenAsync();
      await api.patch('/api/users/me', { pushToken });
    })();
  }, [profile?.id]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <PushRegistration />
          <StatusBar style="dark" />
          <RootNavigator />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
