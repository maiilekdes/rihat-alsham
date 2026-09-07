import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { authErrorMessage, isAuthCancellation } from '../../lib/authErrors';
import { normalizeSaudiPhone } from '../../lib/phone';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { firebaseUser, profile, refreshProfile, sendOtp, signInWithGoogleIdToken, signInWithFacebookAccessToken, signInWithApple } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const reason = route.params?.reason;

  const prompt =
    reason === 'orders'
      ? { title: t('saveOrdersTitle'), body: t('saveOrdersBody') }
      : reason === 'profile'
        ? { title: t('saveProfileTitle'), body: t('saveProfileBody') }
        : reason === 'checkout'
          ? { title: t('saveOrderTitle'), body: t('saveOrderBody') }
          : null;

  // Come back to whatever the person was doing, rather than dropping them on
  // the menu having forgotten their order.
  React.useEffect(() => {
    if (!firebaseUser || !profile || !navigation.isFocused()) return;
    if (profile && !profile.phoneVerified) return navigation.replace('AddPhone', { reason });
    if (reason === 'checkout') return navigation.replace('Checkout');
    if (reason === 'orders') return navigation.replace('OrderHistory');
    if (reason === 'profile') return navigation.replace('Profile');
    navigation.goBack();
  }, [firebaseUser, profile, navigation, reason]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Client IDs come from app.json (extra.auth) so they can be filled in without
  // touching this file. Until they are real, the provider buttons must say so:
  // sending the user to Google's raw "Error 401: invalid_client" page instead
  // makes a missing configuration look like a broken app.
  const authConfig = (Constants.expoConfig?.extra?.auth ?? {}) as {
    googleWebClientId?: string;
    googleIosClientId?: string;
    facebookAppId?: string;
  };
  const isPlaceholder = (v?: string) => !v || v.startsWith('REPLACE_WITH');
  const googleReady = !isPlaceholder(authConfig.googleWebClientId) && (Platform.OS !== 'ios' || !isPlaceholder(authConfig.googleIosClientId));
  const facebookReady = !isPlaceholder(authConfig.facebookAppId);
  const [, fbResponse, promptFacebook] = Facebook.useAuthRequest({
    clientId: authConfig.facebookAppId ?? '',
  });

  const [appleAvailable, setAppleAvailable] = useState(false);
  React.useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  function showAuthError(error: unknown) {
    if (!isAuthCancellation(error)) Alert.alert(t('login'), authErrorMessage(error, i18n.language === 'ar'));
  }

  async function handleGoogleSignIn() {
    if (loading) return;
    if (!googleReady) return Alert.alert(t('signInUnavailableTitle'), t('signInUnavailableBody'));
    setLoading(true);
    try {
      // Lazy import keeps Expo Go able to open the rest of the app.
      if (Constants.appOwnership === 'expo') throw { code: 'auth/native-build-required' };
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId: authConfig.googleWebClientId, iosClientId: authConfig.googleIosClientId });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      if (!response.data.idToken) throw { code: 'auth/missing-id-token' };
      await signInWithGoogleIdToken(response.data.idToken);
    } catch (error) {
      showAuthError(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (fbResponse?.type === 'success' && fbResponse.authentication?.accessToken) {
      signInWithFacebookAccessToken(fbResponse.authentication.accessToken).catch(showAuthError);
    }
  }, [fbResponse]);

  async function handleAppleSignIn() {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithApple();
    } catch (error) {
      showAuthError(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (loading) return;
    setLoading(true);
    try {
      const e164 = normalizeSaudiPhone(phone);
      const verificationId = await sendOtp(e164);
      navigation.navigate('Otp', { verificationId, e164Phone: e164, reason });
    } catch (error) {
      showAuthError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{prompt ? prompt.title : t('appName')}</Text>
      <Text style={styles.subtitle}>{prompt ? prompt.body : t('login')}</Text>

      {!!prompt && (
        <TouchableOpacity style={styles.browseLink} onPress={() => navigation.goBack()}>
          <Text style={styles.browseLinkText}>{t('browseFirst')}</Text>
        </TouchableOpacity>
      )}

      {firebaseUser && !profile && (
        <TouchableOpacity onPress={() => refreshProfile().catch(showAuthError)}>
          <Text style={styles.browseLinkText}>{i18n.language === 'ar' ? 'إعادة تحميل الحساب' : 'Retry loading account'}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.label}>{t('phoneNumber')}</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.countryCode}>+966</Text>
        <TextInput
          style={styles.phoneInput}
          keyboardType="phone-pad"
          placeholder="5XXXXXXXX"
          value={phone}
          onChangeText={setPhone}
          maxLength={20}
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
      {appleAvailable && (
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
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        <Text style={styles.googleBtnText}>{t('continueWithGoogle')}</Text>
      </TouchableOpacity>

      {/* Facebook's guidelines call for their brand blue (#1877F2) fill with white text. */}
      <TouchableOpacity
        style={styles.facebookBtn}
        onPress={() =>
          facebookReady
            ? promptFacebook().catch(showAuthError)
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
  browseLink: { alignSelf: 'center', paddingVertical: 10, marginBottom: 4 },
  browseLinkText: { fontSize: 13.5, fontWeight: '600', color: colors.orange },
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
