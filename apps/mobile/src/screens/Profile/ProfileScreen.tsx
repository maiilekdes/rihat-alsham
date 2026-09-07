import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity , Alert, Linking, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { applyRtl } from '../../lib/i18n';
import { api } from '../../lib/api';
import { colors } from '../../theme';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  function switchLanguage(lang: 'ar' | 'en') {
    i18n.changeLanguage(lang);
    applyRtl(lang);
    // A native reload (expo-updates' Updates.reloadAsync()) is required for
    // the RTL layout direction to fully apply — wire that in when this
    // screen ships in a real build.
  }

  const apiUrl = Constants.expoConfig?.extra?.apiUrl as string;
  const openLegal = (slug: string) =>
    Linking.openURL(`${apiUrl}/legal/${slug}?lang=${i18n.language === 'ar' ? 'ar' : 'en'}`);

  // App Store Guideline 5.1.1(v) requires deletion to be reachable from inside
  // the app, and the confirmation must say plainly what survives: invoices are
  // retained for tax law, stripped of anything identifying.
  function confirmDelete() {
    Alert.alert(t('deleteAccount'), t('deleteAccountWarn'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteAccountConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/api/users/me');
            await signOut(auth);
          } catch {
            Alert.alert(t('deleteAccount'), t('genericError'));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{profile?.fullName ?? 'Guest'}</Text>
      <Text style={styles.phone}>{profile?.phone}</Text>

      <View style={styles.langRow}>
        <TouchableOpacity style={[styles.langBtn, i18n.language === 'ar' && styles.langBtnActive]} onPress={() => switchLanguage('ar')}>
          <Text style={[styles.langText, i18n.language === 'ar' && styles.langTextActive]}>العربية</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.langBtn, i18n.language === 'en' && styles.langBtnActive]} onPress={() => switchLanguage('en')}>
          <Text style={[styles.langText, i18n.language === 'en' && styles.langTextActive]}>English</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() => signOut(auth)}
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeading}>{t('legalSection')}</Text>
      {([
        ['privacy', 'privacyPolicy'],
        ['terms', 'termsConditions'],
        ['refund', 'refundPolicy'],
        ['cookies', 'cookiePolicy'],
      ] as const).map(([slug, key]) => (
        <TouchableOpacity
          key={slug}
          style={styles.legalRow}
          onPress={() => openLegal(slug)}
          accessibilityRole="link"
          accessibilityLabel={t(key)}
        >
          <Text style={styles.legalText}>{t(key)}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={t('a11yDeleteAccount')}
      >
        <Text style={styles.deleteText}>{t('deleteAccount')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  phone: { color: colors.inkSoft, marginTop: 4, marginBottom: 30 },
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  langBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  langText: { fontWeight: '600', color: colors.ink },
  langTextActive: { color: 'white' },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signOutText: { fontWeight: '600', color: colors.danger },
  sectionHeading: { marginTop: 34, marginBottom: 10, fontWeight: '700', color: colors.ink, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  legalRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  legalText: { color: colors.ink, fontWeight: '500' },
  deleteBtn: { marginTop: 30, paddingVertical: 14, alignItems: 'center' },
  // Deliberately not a filled red button: destructive actions should be
  // reachable and clearly labelled, not the most eye-catching thing on screen.
  deleteText: { color: colors.danger, fontWeight: '600', textDecorationLine: 'underline' },
});
