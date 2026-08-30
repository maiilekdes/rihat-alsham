import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

export default function OrderHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addItem, clear } = useCart();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/orders/mine').then(({ data }) => setOrders(data));
  }, []);

  function reorder(order: any) {
    clear();
    for (const it of order.items) {
      addItem({
        itemId: it.id,
        nameAr: it.nameAr,
        nameEn: it.nameEn,
        unitPrice: Number(it.unitPrice),
        quantity: it.quantity,
        extras: [],
      });
    }
    navigation.navigate('Cart');
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={orders}
      keyExtractor={(o) => o.id}
      ListEmptyComponent={<Text style={styles.empty}>No past orders yet</Text>}
      renderItem={({ item: order }) => (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.orderNumber}>#{order.order_number}</Text>
            <Text style={styles.status}>{t(order.status as any)}</Text>
          </View>
          <Text style={styles.total}>{Number(order.total).toFixed(2)} SAR</Text>
          <TouchableOpacity style={styles.reorderBtn} onPress={() => reorder(order)}>
            <Text style={styles.reorderText}>{t('reorder')}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { textAlign: 'center', color: colors.inkSoft, marginTop: 40 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  orderNumber: { fontWeight: '800', fontSize: 16 },
  status: { color: colors.orange, fontWeight: '600' },
  total: { color: colors.inkSoft, marginTop: 6 },
  reorderBtn: { marginTop: 12, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  reorderText: { fontWeight: '700', color: colors.red },
});
