export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)));
}

export function normalizeSaudiPhone(value: string): string {
  let digits = normalizeDigits(value).trim().replace(/[\s()\-]/g, '');
  if (digits.startsWith('00966')) digits = digits.slice(5);
  else if (digits.startsWith('+966')) digits = digits.slice(4);
  else if (digits.startsWith('966')) digits = digits.slice(3);
  digits = digits.replace(/^0/, '');
  if (!/^5\d{8}$/.test(digits)) {
    throw Object.assign(new Error('Invalid Saudi mobile number'), { code: 'auth/invalid-phone-number' });
  }
  return `+966${digits}`;
}
