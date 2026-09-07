import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { authErrorMessage, isAuthCancellation } from '../../lib/authErrors';
import { normalizeSaudiPhone, normalizeDigits } from '../../lib/phone';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';

// Shown after a Google/Facebook sign-in when the account has no verified
// phone yet — blocks entry into the main app until this step completes,
// since delivery drivers and staff must be able to reach the customer directly.
export default function AddPhoneScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AddPhone'>>();
  const { sendOtp, linkPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setLoading(true);
    try {
      setVerificationId(await sendOtp(normalizeSaudiPhone(phone)));
    } catch (error) {
      if (!isAuthCancellation(error)) Alert.alert(t('login'), authErrorMessage(error, i18n.language === 'ar'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      await linkPhone(verificationId!, code);
      navigation.reset({ index: 0, routes: [{ name: params?.reason === 'checkout' ? 'Checkout' : params?.reason === 'orders' ? 'OrderHistory' : params?.reason === 'profile' ? 'Profile' : 'Home' }] });
    } catch (error) {
      Alert.alert(t('login'), authErrorMessage(error, i18n.language === 'ar'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('addPhoneRequired')}</Text>

      {!verificationId ? (
        <>
          <View style={styles.phoneRow}>
            <Text style={styles.countryCode}>+966</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={20} />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={loading || phone.length < 9}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('sendCode')}</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput style={styles.codeInput} keyboardType="number-pad" maxLength={6} value={code} onChangeText={(value) => setCode(normalizeDigits(value))} textAlign="center" />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading || code.length !== 6}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('verifyCode')}</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 28, color: colors.ink },
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  countryCode: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: colors.bg, fontWeight: '600' },
  input: { flex: 1, paddingHorizontal: 14, fontSize: 16 },
  codeInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, fontSize: 28, letterSpacing: 10, paddingVertical: 16, marginBottom: 20 },
  primaryBtn: { backgroundColor: colors.red, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
