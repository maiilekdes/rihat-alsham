import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { OrderStatus } from '@rihasham/shared';
import { api } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';
import OrderChat from '../../components/OrderChat';

const STEPS: { key: OrderStatus; labelKey: string }[] = [
  { key: 'received', labelKey: 'orderReceived' },
  { key: 'preparing', labelKey: 'preparing' },
  { key: 'out_for_delivery', labelKey: 'outForDelivery' },
  { key: 'completed', labelKey: 'completed' },
];

export default function OrderTrackingScreen() {
  const { t } = useTranslation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'OrderTracking'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    let socket: Socket;
    load();

    (async () => {
      const token = await auth.currentUser?.getIdToken();
      socket = io(Constants.expoConfig?.extra?.apiUrl as string, { auth: { token, role: 'customer' } });
      socket.on('order:status', (update: any) => {
        if (update.id === params.orderId) setOrder((prev: any) => ({ ...prev, status: update.status }));
      });
    })();

    return () => {
      socket?.disconnect();
    };
  }, [params.orderId]);

  async function load() {
    const { data } = await api.get(`/api/orders/${params.orderId}`);
    setOrder(data);
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const isPickup = order.fulfillment_type === 'pickup';
  const steps = STEPS.map((s) => (s.key === 'out_for_delivery' && isPickup ? { key: 'ready_for_pickup' as OrderStatus, labelKey: 'readyForPickup' } : s));
  const activeIndex = steps.findIndex((s) => s.key === order.status);

  const chatOpen = order.status !== 'cancelled';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.orderNumber}>#{order.order_number}</Text>
      <Text style={styles.confirmed}>{t('orderConfirmed')}</Text>

      <View style={styles.timeline}>
        {steps.map((step, i) => (
          <View key={step.key} style={styles.timelineRow}>
            <View style={[styles.dot, i <= activeIndex && styles.dotActive]} />
            <Text style={[styles.timelineLabel, i <= activeIndex && styles.timelineLabelActive]}>{t(step.labelKey as any)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}>
        <Text style={styles.homeBtnText}>{t('home')}</Text>
      </TouchableOpacity>

      {chatOpen && (
        <View style={styles.chatWrap}>
          <Text style={styles.chatTitle}>{t('deliveryNotes')}</Text>
          <OrderChat orderId={order.id} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderNumber: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: colors.red },
  confirmed: { textAlign: 'center', color: colors.inkSoft, marginTop: 6, marginBottom: 40 },
  timeline: { gap: 20 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.orange },
  timelineLabel: { fontSize: 15, color: colors.inkSoft },
  timelineLabelActive: { color: colors.ink, fontWeight: '700' },
  homeBtn: { marginTop: 40, backgroundColor: colors.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  homeBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  chatWrap: { flex: 1, marginTop: 24, marginHorizontal: -24 },
  chatTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, paddingHorizontal: 24, marginBottom: 8 },
});
