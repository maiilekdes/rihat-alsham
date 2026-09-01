import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme';

/** Shown while auth state resolves. Never render `null` here — a blank screen
 *  is indistinguishable from a crash, for users and for us. */
export default function AppLoading() {
  return (
    <View style={styles.container}>
      <Text style={styles.nameAr}>ريحة الشام</Text>
      <Text style={styles.nameEn}>RIHAT ALSHAM</Text>
      <ActivityIndicator color={colors.red} style={{ marginTop: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  nameAr: { fontSize: 30, fontWeight: '700', color: colors.red },
  nameEn: { fontSize: 11, fontWeight: '600', letterSpacing: 2.5, color: colors.orange, marginTop: 6 },
});
