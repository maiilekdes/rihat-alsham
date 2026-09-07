import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSaudiPhone, normalizeDigits } from '../src/lib/phone';
import { authErrorMessage, isAuthCancellation } from '../src/lib/authErrors';

test('Saudi numbers accept local, international, pasted and Arabic digits', () => {
  for (const number of ['512345678', '0512345678', '+966512345678', '966512345678', '00966512345678', ' 051 234 5678 ', '٠٥١٢٣٤٥٦٧٨', '۰۵۱۲۳۴۵۶۷۸']) {
    assert.equal(normalizeSaudiPhone(number), '+966512345678');
  }
  assert.equal(normalizeDigits('١٢٣٤٥٦'), '123456');
});

test('invalid numbers fail before requesting an SMS', () => {
  for (const number of ['', '123456789', '+15551234567', '051234567', '05123456789', '5abcdefgh']) {
    assert.throws(() => normalizeSaudiPhone(number), { code: 'auth/invalid-phone-number' });
  }
});

test('errors distinguish throttling, invalid codes and cancellation without leaking responses', () => {
  assert.match(authErrorMessage({ code: 'auth/too-many-requests' }), /wait/);
  assert.match(authErrorMessage({ code: 'auth/invalid-verification-code' }, true), /غير صحيح/);
  assert.equal(isAuthCancellation({ code: 'ERR_REQUEST_CANCELED' }), true);
  assert.equal(isAuthCancellation({ code: 'auth/network-request-failed' }), false);
  assert.doesNotMatch(authErrorMessage({ message: 'secret token' }), /secret/);
});
