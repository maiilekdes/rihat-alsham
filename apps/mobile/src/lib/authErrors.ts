// Keep actionable errors visible without displaying tokens or provider responses.
export function authErrorMessage(error: unknown, arabic = false): string {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, [string, string]> = {
    'auth/invalid-phone-number': ['Enter a valid Saudi mobile number, such as 05XXXXXXXX.', 'أدخل رقم جوال سعودي صحيح مثل 05XXXXXXXX.'],
    'auth/operation-not-allowed': ['This sign-in method is unavailable. Please contact the restaurant.', 'طريقة تسجيل الدخول غير متاحة. يرجى التواصل مع المطعم.'],
    'auth/too-many-requests': ['Too many attempts. Please wait before trying again.', 'محاولات كثيرة. يرجى الانتظار قبل المحاولة مجدداً.'],
    'auth/quota-exceeded': ['SMS delivery is temporarily unavailable. Please try again later.', 'إرسال الرسائل غير متاح مؤقتاً. حاول لاحقاً.'],
    'auth/network-request-failed': ['Check your internet connection and try again.', 'تحقق من اتصال الإنترنت وحاول مجدداً.'],
    'auth/invalid-verification-code': ['The verification code is incorrect. Try again.', 'رمز التحقق غير صحيح. حاول مجدداً.'],
    'auth/code-expired': ['The code has expired. Request a new code.', 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.'],
    'auth/credential-already-in-use': ['This phone belongs to another account. Sign in using that phone.', 'الرقم مرتبط بحساب آخر. سجل الدخول باستخدام هذا الرقم.'],
    'auth/account-exists-with-different-credential': ['Use the sign-in method you previously used for this account.', 'استخدم طريقة تسجيل الدخول السابقة لهذا الحساب.'],
    'ERR_FIREBASE_RECAPTCHA_ERROR': ['Could not load phone verification. Check your connection and retry.', 'تعذر تحميل التحقق من الهاتف. تحقق من اتصالك وحاول مجدداً.'],
    'ERR_FIREBASE_RECAPTCHA_TIMEOUT': ['Phone verification timed out. Please try again.', 'انتهت مهلة التحقق من الهاتف. حاول مجدداً.'],
    'auth/profile-unavailable': ['You are signed in, but your account could not be loaded. Please retry.', 'تم تسجيل الدخول لكن تعذر تحميل حسابك. حاول مجدداً.'],
    'auth/native-build-required': ['Google sign-in requires the installed Rihasham app.', 'تسجيل الدخول عبر Google يتطلب تطبيق ريحة الشام المثبت.'],
    'auth/apple-unavailable': ['Apple sign-in is unavailable on this device.', 'تسجيل الدخول عبر Apple غير متاح على هذا الجهاز.'],
  };
  const message = messages[code]?.[arabic ? 1 : 0] ?? (arabic ? 'تعذر تسجيل الدخول. حاول مجدداً.' : 'Sign-in failed. Please try again.');
  return code ? `${message}\n(${code})` : message;
}

export function isAuthCancellation(error: unknown) {
  return ['ERR_REQUEST_CANCELED', 'ERR_FIREBASE_RECAPTCHA_CANCEL', 'SIGN_IN_CANCELLED', '12501'].includes((error as { code?: string })?.code ?? '');
}
