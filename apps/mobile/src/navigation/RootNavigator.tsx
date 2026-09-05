import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AppLoading from '../components/AppLoading';

import LoginScreen from '../screens/Auth/LoginScreen';
import OtpScreen from '../screens/Auth/OtpScreen';
import AddPhoneScreen from '../screens/Auth/AddPhoneScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import ItemDetailScreen from '../screens/Home/ItemDetailScreen';
import CartScreen from '../screens/Cart/CartScreen';
import CheckoutScreen from '../screens/Checkout/CheckoutScreen';
import OrderTrackingScreen from '../screens/Orders/OrderTrackingScreen';
import OrderHistoryScreen from '../screens/Orders/OrderHistoryScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

export type RootStackParamList = {
  // `reason` lets the sign-in screen explain why it appeared — asking someone
  // to sign in is much easier to accept when it names what they get back.
  Login: { reason?: 'checkout' | 'orders' | 'profile' } | undefined;
  Otp: { verificationId: string; e164Phone: string };
  AddPhone: undefined;
  Home: undefined;
  ItemDetail: { itemId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderTracking: { orderId: string };
  OrderHistory: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { loading } = useAuth();

  if (loading) return <AppLoading />;

  // Everyone starts on the menu. Making people sign in before they can see the
  // food is the fastest way to lose them — nobody creates an account for a
  // restaurant they have not looked at yet. Sign-in is asked for at the point
  // it actually buys something: placing an order, or opening past orders.
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: true }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: '' }} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="Otp" component={OtpScreen} options={{ title: '' }} />
        <Stack.Screen name="AddPhone" component={AddPhoneScreen} options={{ title: '' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
