import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';

// Shown after a Google/Facebook sign-in when the account has no verified
// phone yet — blocks entry into the main app until this step completes,
// since delivery drivers and staff must be able to reach the customer directly.
export default function AddPhoneScreen() {
  const { t } = useTranslation();
  const { sendOtp, linkPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    const e164 = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`;
    setLoading(true);
    try {
      setVerificationId(await sendOtp(e164));
    } catch {
      Alert.alert('Error', 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      await linkPhone(verificationId!, code);
    } catch {
      Alert.alert('Error', 'Invalid code, or this number is already in use.');
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
            <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={10} />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={loading || phone.length < 9}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('sendCode')}</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput style={styles.codeInput} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} textAlign="center" />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading || code.length < 4}>
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
