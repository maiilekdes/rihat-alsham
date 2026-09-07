import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authErrorMessage } from '../../lib/authErrors';
import { normalizeDigits } from '../../lib/phone';
import { RootStackParamList } from '../../navigation/RootNavigator';

export default function OtpScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Otp'>>();
  const { confirmOtp, firebaseUser, refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setLoading(true);
    try {
      if (firebaseUser?.phoneNumber === params.e164Phone) await refreshProfile();
      else await confirmOtp(params.verificationId, code);
      navigation.reset({ index: 0, routes: [{ name: params.reason === 'checkout' ? 'Checkout' : params.reason === 'orders' ? 'OrderHistory' : params.reason === 'profile' ? 'Profile' : 'Home' }] });
    } catch (error) {
      Alert.alert(t('login'), authErrorMessage(error, i18n.language === 'ar'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Code sent to {params.e164Phone}</Text>
      <TextInput
        style={styles.codeInput}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(value) => setCode(normalizeDigits(value))}
        placeholder="••••••"
        textAlign="center"
      />
      <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading || code.length !== 6}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('verifyCode')}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, justifyContent: 'center' },
  subtitle: { fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginBottom: 24 },
  codeInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, fontSize: 28, letterSpacing: 10, paddingVertical: 16, marginBottom: 24 },
  primaryBtn: { backgroundColor: colors.red, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
