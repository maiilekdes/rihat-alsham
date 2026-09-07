import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuItem, CartExtra } from '@rihasham/shared';
import { api } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

export default function ItemDetailScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { params } = useRoute<RouteProp<RootStackParamList, 'ItemDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addItem } = useCart();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [spiceLevel, setSpiceLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    // The full menu is already cached from HomeScreen's fetch — in a larger
    // app this would be its own GET /api/menu/items/:id endpoint.
    api.get('/api/menu').then(({ data }) => {
      for (const cat of data) {
        const found = cat.items.find((i: MenuItem) => i.id === params.itemId);
        if (found) {
          setItem(found);
          setVariantId(found.variants.find((v: any) => v.isDefault)?.id ?? found.variants[0]?.id);
        }
      }
    });
  }, [params.itemId]);

  if (!item) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const variant = item.variants.find((v) => v.id === variantId);
  const unitPrice = variant ? variant.price : item.basePrice;
  const extrasList = item.extras.filter((e) => selectedExtras.has(e.id));
  const extrasTotal = extrasList.reduce((s, e) => s + e.price, 0);
  const total = (unitPrice + extrasTotal) * quantity;

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAddToCart() {
    const extras: CartExtra[] = extrasList.map((e) => ({ extraId: e.id, nameAr: e.nameAr, nameEn: e.nameEn, price: e.price }));
    addItem({
      itemId: item!.id,
      variantId,
      nameAr: variant ? `${item!.nameAr} - ${variant.nameAr}` : item!.nameAr,
      nameEn: variant ? `${item!.nameEn} - ${variant.nameEn}` : item!.nameEn,
      unitPrice,
      quantity,
      spiceLevel: item!.spiceLevelMax > 0 ? spiceLevel : undefined,
      notes: notes || undefined,
      extras,
    });
    navigation.navigate('Cart');
  }

  return (
    <ScrollView style={styles.container}>
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.image}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('a11yDishImage', { name: isAr ? item.nameAr : item.nameEn })}
      />
      <View style={{ padding: 16 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{isAr ? item.nameAr : item.nameEn}</Text>
          {(() => {
            const cal = variant?.calories ?? item.calories;
            return cal ? (
              <View style={styles.cal}>
                <Text style={styles.calFlame}>◆</Text>
                <Text style={styles.calNum}>{cal}</Text>
                <Text style={styles.calUnit}>cal</Text>
              </View>
            ) : null;
          })()}
        </View>
        <Text style={styles.desc}>{isAr ? item.descriptionAr : item.descriptionEn}</Text>

        {item.variants.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('size')}</Text>
            <View style={styles.tagRow}>
              {item.variants.map((v) => {
                const selected = variantId === v.id;
                return (
                  <TouchableOpacity key={v.id} style={styles.tag} onPress={() => setVariantId(v.id)}>
                    {selected && <View style={styles.tagDot} />}
                    <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
                      {isAr ? v.nameAr : v.nameEn}
                    </Text>
                    <Text style={[styles.tagPrice, selected && styles.tagTextSelected]}>{v.price.toFixed(0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {item.extras.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('extras')}</Text>
            <View style={styles.tagRow}>
              {item.extras.map((e) => {
                const selected = selectedExtras.has(e.id);
                return (
                  <TouchableOpacity key={e.id} style={styles.tag} onPress={() => toggleExtra(e.id)}>
                    {selected && <View style={styles.tagDot} />}
                    <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
                      {isAr ? e.nameAr : e.nameEn}
                    </Text>
                    <Text style={[styles.tagPrice, selected && styles.tagTextSelected]}>+{e.price.toFixed(0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {item.spiceLevelMax > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('spiceLevel')}</Text>
            <View style={styles.tagRow}>
              {Array.from({ length: item.spiceLevelMax + 1 }).map((_, level) => {
                const selected = spiceLevel === level;
                return (
                  <TouchableOpacity key={level} style={styles.tag} onPress={() => setSpiceLevel(level)}>
                    {selected && <View style={styles.tagDot} />}
                    <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{'🌶'.repeat(level) || '—'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>{t('notes')}</Text>
        <TextInput style={styles.notesInput} value={notes} onChangeText={setNotes} multiline placeholder="..." />

        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
        <Text style={styles.addBtnText}>{t('addToCart')} · {total.toFixed(2)} SAR</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: 240, backgroundColor: colors.border },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, flex: 1 },
  cal: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 6 },
  calFlame: { fontSize: 9, color: colors.ember },
  calNum: { fontSize: 15, fontWeight: '700', color: colors.ember },
  calUnit: { fontSize: 11, color: colors.inkSoft, marginStart: 1 },
  desc: { fontSize: 14, color: colors.inkSoft, marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8, color: colors.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tagDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.red },
  tagText: { fontSize: 14.5, fontWeight: '600', color: colors.inkSoft },
  tagTextSelected: { color: colors.red, fontWeight: '700' },
  tagPrice: { fontSize: 13, fontWeight: '700', color: colors.ink, marginStart: 2 },
  notesInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 60 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 16 },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 20, fontWeight: '700', color: colors.red },
  qtyValue: { fontSize: 18, fontWeight: '700' },
  addBtn: { backgroundColor: colors.red, margin: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  addBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
