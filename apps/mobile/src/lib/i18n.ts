import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import { strings } from '@rihasham/shared';

// Arabic is the default: only fall back to English if the device locale is
// explicitly a non-Arabic language. RTL must be applied at the native layout
// level (I18nManager), not just by picking Arabic strings — mirrored text
// alone leaves flex-row layouts, icons, and swipe gestures pointing the wrong way.
const deviceLang = Localization.getLocales()[0]?.languageCode;
const initialLang: 'ar' | 'en' = deviceLang === 'en' ? 'en' : 'ar';

export function applyRtl(lang: 'ar' | 'en') {
  const shouldBeRtl = lang === 'ar';
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.allowRTL(shouldBeRtl);
    I18nManager.forceRTL(shouldBeRtl);
    // A full reload is required for RTL layout direction to take effect —
    // call Updates.reloadAsync() (expo-updates) after switching language
    // in a settings screen; on first launch this runs before any render.
  }
}

applyRtl(initialLang);

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: strings.ar },
    en: { translation: strings.en },
  },
  lng: initialLang,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

export default i18n;
