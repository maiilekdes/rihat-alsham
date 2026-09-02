import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { sendOtp, signInWithGoogleIdToken, signInWithFacebookAccessToken, signInWithApple } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Client IDs come from app.json (extra.auth) so they can be filled in without
  // touching this file. Until they are real, the provider buttons must say so:
  // sending the user to Google's raw "Error 401: invalid_client" page instead
  // makes a missing configuration look like a broken app.
  const authConfig = (Constants.expoConfig?.extra?.auth ?? {}) as {
    googleWebClientId?: string;
    googleIosClientId?: string;
    googleAndroidClientId?: string;
    facebookAppId?: string;
  };
  const isPlaceholder = (v?: string) => !v || v.startsWith('REPLACE_WITH');
  const googleReady = !isPlaceholder(authConfig.googleIosClientId) || !isPlaceholder(authConfig.googleWebClientId);
  const facebookReady = !isPlaceholder(authConfig.facebookAppId);

  const [, googleResponse, promptGoogle] = Google.useAuthRequest({
    webClientId: authConfig.googleWebClientId,
    iosClientId: authConfig.googleIosClientId,
    androidClientId: authConfig.googleAndroidClientId,
  });
  const [, fbResponse, promptFacebook] = Facebook.useAuthRequest({
    clientId: authConfig.facebookAppId ?? '',
  });

  React.useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.authentication?.idToken) {
      signInWithGoogleIdToken(googleResponse.authentication.idToken).catch(() =>
        Alert.alert('Error', 'Google sign-in failed')
      );
    }
  }, [googleResponse]);

  React.useEffect(() => {
    if (fbResponse?.type === 'success' && fbResponse.authentication?.accessToken) {
      signInWithFacebookAccessToken(fbResponse.authentication.accessToken).catch(() =>
        Alert.alert('Error', 'Facebook sign-in failed')
      );
    }
  }, [fbResponse]);

  async function handleAppleSignIn() {
    try {
      await signInWithApple();
    } catch (err: any) {
      // User cancelling the Apple sheet throws ERR_REQUEST_CANCELED — not a real error.
      if (err?.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Error', 'Apple sign-in failed');
    }
  }

  async function handleSendOtp() {
    const e164 = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`;
    setLoading(true);
    try {
      const verificationId = await sendOtp(e164);
      navigation.navigate('Otp', { verificationId, e164Phone: e164 });
    } catch (err) {
      Alert.alert('Error', 'Could not send verification code. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('appName')}</Text>
      <Text style={styles.subtitle}>{t('login')}</Text>

      <Text style={styles.label}>{t('phoneNumber')}</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.countryCode}>+966</Text>
        <TextInput
          style={styles.phoneInput}
          keyboardType="phone-pad"
          placeholder="5XXXXXXXX"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={loading || phone.length < 9}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('sendCode')}</Text>}
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      {/* Apple requires their own button component (not a custom-styled one)
          per their Human Interface Guidelines, and only ever shows on iOS.
          It goes first among the social options when present, per Apple's
          own placement guidance for apps that offer it. */}
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleBtn}
          onPress={handleAppleSignIn}
        />
      )}

      {/* Google's brand guidelines call for a white button with the
          multicolor "G" mark — never a solid brand-color fill. */}
      <TouchableOpacity
        style={styles.googleBtn}
        onPress={() =>
          googleReady
            ? promptGoogle()
            : Alert.alert(t('signInUnavailableTitle'), t('signInUnavailableBody'))
        }
      >
        <Text style={styles.googleBtnText}>{t('continueWithGoogle')}</Text>
      </TouchableOpacity>

      {/* Facebook's guidelines call for their brand blue (#1877F2) fill with white text. */}
      <TouchableOpacity
        style={styles.facebookBtn}
        onPress={() =>
          facebookReady
            ? promptFacebook()
            : Alert.alert(t('signInUnavailableTitle'), t('signInUnavailableBody'))
        }
      >
        <Text style={styles.facebookBtnText}>{t('continueWithFacebook')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: colors.red, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.inkSoft, textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  countryCode: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: colors.bg, fontWeight: '600' },
  phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 16, textAlign: 'left' },
  primaryBtn: { backgroundColor: colors.red, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 10, color: colors.inkSoft, fontSize: 12 },
  appleBtn: { height: 48, marginBottom: 12 },
  googleBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12, backgroundColor: colors.white },
  googleBtnText: { fontWeight: '600', fontSize: 15, color: colors.ink },
  facebookBtn: { backgroundColor: '#1877F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  facebookBtnText: { fontWeight: '600', fontSize: 15, color: 'white' },
});
