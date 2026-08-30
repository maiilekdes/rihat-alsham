import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { applyRtl } from '../../lib/i18n';
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

  return (
    <View style={styles.container}>
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

      <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, paddingTop: 60 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  phone: { color: colors.inkSoft, marginTop: 4, marginBottom: 30 },
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  langBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  langText: { fontWeight: '600', color: colors.ink },
  langTextActive: { color: 'white' },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signOutText: { fontWeight: '600', color: colors.danger },
});
