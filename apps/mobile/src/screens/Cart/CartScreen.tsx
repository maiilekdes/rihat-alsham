import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { firebaseUser, profile } = useAuth();

  // The cart survives sign-in (it lives in CartContext), so sending someone to
  // sign in here costs them nothing — they come back to the same order.
  function goToCheckout() {
    if (!firebaseUser) return navigation.navigate('Login', { reason: 'checkout' });
    if (profile && !profile.phoneVerified) return navigation.navigate('AddPhone');
    navigation.navigate('Checkout');
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>{t('cart')} is empty</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{isAr ? item.nameAr : item.nameEn}</Text>
              {item.extras.length > 0 && (
                <Text style={styles.extras}>{item.extras.map((e) => (isAr ? e.nameAr : e.nameEn)).join(', ')}</Text>
              )}
              <Text style={styles.price}>{item.unitPrice.toFixed(2)} SAR</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(index, item.quantity - 1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(index, item.quantity + 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => removeItem(index)}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('subtotal')}</Text>
            <Text style={styles.totalValue}>{subtotal.toFixed(2)} SAR</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={goToCheckout}>
            <Text style={styles.checkoutBtnText}>{t('checkout')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { textAlign: 'center', color: colors.inkSoft, marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  name: { fontWeight: '700', fontSize: 15, color: colors.ink },
  extras: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '600', color: colors.orange, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontWeight: '700', color: colors.red },
  qtyValue: { fontWeight: '700' },
  remove: { color: colors.inkSoft, fontSize: 16 },
  footer: { padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 15, color: colors.inkSoft },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  checkoutBtn: { backgroundColor: colors.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  checkoutBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
