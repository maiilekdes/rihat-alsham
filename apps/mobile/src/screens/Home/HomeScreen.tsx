import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuItem } from '@rihasham/shared';
import { api } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

interface CategoryWithItems {
  id: string;
  nameAr: string;
  nameEn: string;
  items: MenuItem[];
}

const MENU_CACHE_KEY = 'rihasham:menu-cache';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items } = useCart();
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get<CategoryWithItems[]>('/api/menu');
      setCategories(data);
      setActiveCategory(data[0]?.id ?? null);
      await AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
      setOffline(false);
    } catch {
      // Offline-friendly fallback: show the last successfully fetched menu.
      const cached = await AsyncStorage.getItem(MENU_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setCategories(data);
        setActiveCategory(data[0]?.id ?? null);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const activeItems = categories.find((c) => c.id === activeCategory)?.items ?? [];
  const isAr = i18n.language === 'ar';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitleAr}>ريحة الشام</Text>
          <Text style={styles.headerTitleEn}>RIHAT ALSHAM</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('OrderHistory')}>
            <Text style={styles.headerLink}>{t('orders')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerLink}>{t('profile')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {offline && <Text style={styles.offlineBanner}>Offline — showing last-loaded menu</Text>}

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.tab} onPress={() => setActiveCategory(item.id)}>
            <Text style={[styles.tabText, activeCategory === item.id && styles.tabTextActive]}>
              {isAr ? item.nameAr : item.nameEn}
            </Text>
            {activeCategory === item.id && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={activeItems}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}
        renderItem={({ item, index }) => {
          const hasVariants = item.variants.length > 0;
          const displayPrice = hasVariants
            ? Math.min(...item.variants.map((v) => v.price))
            : item.basePrice;
          return (
            <TouchableOpacity
              style={[styles.row, index === activeItems.length - 1 && styles.rowLast]}
              disabled={!item.isAvailable}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder} />
              )}
              <View style={{ flex: 1, marginStart: 13 }}>
                <View style={styles.rowHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNameAr}>{item.nameAr}</Text>
                    <Text style={styles.itemNameEn}>{item.nameEn}</Text>
                  </View>
                  {!!item.calories && (
                    <View style={styles.cal}>
                      <Text style={styles.calFlame}>◆</Text>
                      <Text style={styles.calNum}>{item.calories}</Text>
                      <Text style={styles.calUnit}>cal</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemPrice}>
                  {hasVariants ? (isAr ? 'يبدأ من ' : 'from ') : ''}
                  {displayPrice.toFixed(displayPrice % 1 === 0 ? 0 : 2)}
                  <Text style={styles.itemPriceUnit}> SAR</Text>
                </Text>
                {!item.isAvailable && <Text style={styles.outOfStock}>{t('outOfStock')}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {items.length > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.cartBarText}>
            {t('cart')} ({items.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingTop: 56, backgroundColor: colors.bg },
  headerTitleAr: { fontSize: 22, fontWeight: '700', color: colors.red },
  headerTitleEn: { fontSize: 10.5, fontWeight: '600', letterSpacing: 1.5, color: colors.orange, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 18 },
  headerLink: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  offlineBanner: { backgroundColor: '#fff2cc', color: '#8a6d00', textAlign: 'center', padding: 6, fontSize: 12 },
  tabRow: { paddingHorizontal: 18, gap: 22, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 0 },
  tab: { alignItems: 'center', paddingBottom: 12 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  tabTextActive: { color: colors.red },
  tabUnderline: { height: 2, backgroundColor: colors.red, width: '100%', marginTop: 8, borderRadius: 1 },
  row: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dotted' },
  rowLast: { borderBottomWidth: 0 },
  thumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.border },
  thumbPlaceholder: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.border, opacity: 0.5 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemNameAr: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  itemNameEn: { fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
  cal: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 },
  calFlame: { fontSize: 8, color: colors.ember ?? colors.orange },
  calNum: { fontSize: 13, fontWeight: '600', color: colors.ember ?? colors.orange },
  calUnit: { fontSize: 10, color: colors.inkSoft, marginStart: 1 },
  itemPrice: { fontSize: 15.5, fontWeight: '700', color: colors.red, marginTop: 7 },
  itemPriceUnit: { fontSize: 11, fontWeight: '600', color: colors.inkSoft },
  outOfStock: { fontSize: 12, color: colors.danger, marginTop: 4, fontWeight: '600' },
  cartBar: { position: 'absolute', bottom: 20, start: 16, end: 16, backgroundColor: colors.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cartBarText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
