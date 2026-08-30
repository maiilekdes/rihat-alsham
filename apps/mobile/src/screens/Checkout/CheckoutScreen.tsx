import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Address, Branch } from '@rihasham/shared';
import { api } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import MoyasarCardForm from '../../components/MoyasarCardForm';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

type Fulfillment = 'delivery' | 'pickup';
type Step = 'details' | 'payment' | 'processing';

const DELIVERY_FEE = 8;

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, subtotal, clear } = useCart();

  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [addressId, setAddressId] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();
  const [step, setStep] = useState<Step>('details');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/addresses').then(({ data }) => {
      setAddresses(data);
      setAddressId(data.find((a: Address) => a.isDefault)?.id ?? data[0]?.id);
    });
    api.get('/api/branches').then(({ data }) => {
      setBranches(data);
      setBranchId(data[0]?.id);
    });
  }, []);

  const total = subtotal + (fulfillment === 'delivery' ? DELIVERY_FEE : 0);

  async function handleContinueToPayment() {
    setError(null);
    try {
      const { data } = await api.post('/api/orders', {
        fulfillmentType: fulfillment,
        addressId: fulfillment === 'delivery' ? addressId : undefined,
        branchId: fulfillment === 'pickup' ? branchId : undefined,
        items: items.map((it) => ({
          itemId: it.itemId,
          variantId: it.variantId,
          quantity: it.quantity,
          spiceLevel: it.spiceLevel,
          notes: it.notes,
          extraIds: it.extras.map((e) => e.extraId),
        })),
      });
      setOrderId(data.orderId);
      setStep('payment');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not create order. Please try again.');
    }
  }

  async function handleCardToken(token: string) {
    if (!orderId) return;
    setStep('processing');
    try {
      const { data } = await api.post('/api/payments/charge', { orderId, token });
      if (data.status === 'paid') {
        clear();
        navigation.reset({ index: 0, routes: [{ name: 'OrderTracking', params: { orderId } }] });
      } else if (data.status === 'requires_action') {
        // 3D Secure step-up would open data.transactionUrl in an in-app browser here.
        Alert.alert('Additional verification required', 'Please complete the bank verification step.');
        setStep('payment');
      }
    } catch (err: any) {
      // Payment failed / declined: order stays in pending_payment and never
      // reaches the kitchen. Let the customer retry or pick a different card.
      setError(err?.response?.data?.reason ?? t('paymentFailed'));
      setStep('payment');
    }
  }

  if (step === 'processing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.red} />
        <Text style={{ marginTop: 12, color: colors.inkSoft }}>Confirming payment…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {step === 'details' && (
        <>
          <Text style={styles.sectionTitle}>{t('delivery')} / {t('pickup')}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, fulfillment === 'delivery' && styles.toggleBtnActive]} onPress={() => setFulfillment('delivery')}>
              <Text style={[styles.toggleText, fulfillment === 'delivery' && styles.toggleTextActive]}>{t('delivery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, fulfillment === 'pickup' && styles.toggleBtnActive]} onPress={() => setFulfillment('pickup')}>
              <Text style={[styles.toggleText, fulfillment === 'pickup' && styles.toggleTextActive]}>{t('pickup')}</Text>
            </TouchableOpacity>
          </View>

          {fulfillment === 'delivery'
            ? addresses.map((a) => (
                <TouchableOpacity key={a.id} style={[styles.optionCard, addressId === a.id && styles.optionCardActive]} onPress={() => setAddressId(a.id)}>
                  <Text style={styles.optionTitle}>{a.label ?? a.line1}</Text>
                  <Text style={styles.optionSubtitle}>{a.line1}, {a.city}</Text>
                </TouchableOpacity>
              ))
            : branches.map((b) => (
                <TouchableOpacity key={b.id} style={[styles.optionCard, branchId === b.id && styles.optionCardActive]} onPress={() => setBranchId(b.id)}>
                  <Text style={styles.optionTitle}>{b.nameEn}</Text>
                  <Text style={styles.optionSubtitle}>{b.addressEn}</Text>
                </TouchableOpacity>
              ))}

          <View style={styles.summary}>
            <SummaryRow label={t('subtotal')} value={subtotal} />
            {fulfillment === 'delivery' && <SummaryRow label={t('deliveryFee')} value={DELIVERY_FEE} />}
            <SummaryRow label={t('total')} value={total} bold />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleContinueToPayment}
            disabled={fulfillment === 'delivery' ? !addressId : !branchId}
          >
            <Text style={styles.primaryBtnText}>Continue to Payment</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'payment' && (
        <>
          <Text style={styles.sectionTitle}>{t('total')}: {total.toFixed(2)} SAR</Text>
          <Text style={styles.paymentHint}>{t('payWithMada')} · {t('payWithCard')}</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <MoyasarCardForm
            amountHalalas={Math.round(total * 100)}
            onToken={handleCardToken}
            onError={(msg) => setError(msg)}
          />
        </>
      )}
    </ScrollView>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold]}>{value.toFixed(2)} SAR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: colors.ink },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  toggleText: { fontWeight: '600', color: colors.ink },
  toggleTextActive: { color: 'white' },
  optionCard: { backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  optionCardActive: { borderColor: colors.orange, borderWidth: 2 },
  optionTitle: { fontWeight: '700', color: colors.ink },
  optionSubtitle: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  summary: { marginTop: 20, backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: colors.inkSoft },
  summaryValue: { color: colors.ink },
  summaryBold: { fontWeight: '800', fontSize: 16, color: colors.ink },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  paymentHint: { color: colors.inkSoft, marginBottom: 12 },
});
