import axios from 'axios';

const MOYASAR_API = 'https://api.moyasar.com/v1';

// Secret key never leaves the server; the mobile app only ever sees the
// *publishable* key (used client-side to tokenize card data via Moyasar's
// hosted fields SDK, so raw PAN/CVV never touch our backend).
const authHeader = () => ({
  auth: { username: process.env.MOYASAR_SECRET_KEY as string, password: '' },
});

export interface CreatePaymentParams {
  amountHalalas: number; // Moyasar amounts are in halalas (SAR * 100)
  currency: 'SAR';
  description: string;
  token: string; // token returned by Moyasar.js hosted fields on the client
  callbackUrl: string; // for 3D Secure redirect back into the app
  metadata: Record<string, string>;
}

export async function createMoyasarPayment(params: CreatePaymentParams) {
  const { data } = await axios.post(
    `${MOYASAR_API}/payments`,
    {
      amount: params.amountHalalas,
      currency: params.currency,
      description: params.description,
      callback_url: params.callbackUrl,
      source: { type: 'token', token: params.token },
      metadata: params.metadata,
    },
    authHeader()
  );
  return data as MoyasarPayment;
}

export async function fetchMoyasarPayment(paymentId: string) {
  const { data } = await axios.get(`${MOYASAR_API}/payments/${paymentId}`, authHeader());
  return data as MoyasarPayment;
}

export interface MoyasarPayment {
  id: string;
  status: 'initiated' | 'paid' | 'failed' | 'authorized' | 'captured' | 'refunded' | 'voided';
  amount: number;
  fee: number;
  currency: string;
  source: {
    type: string;
    company?: string; // 'mada' | 'visa' | 'mastercard'
    name?: string;
    number?: string; // masked, e.g. "XXXX-XXXX-XXXX-1234"
    message?: string; // decline reason, if failed
    transaction_url?: string; // 3D Secure redirect, if required
  };
  metadata: Record<string, string>;
}

/** Maps Moyasar's card `company` field to our own payment_method enum. */
export function mapCardBrandToMethod(company?: string): 'mada' | 'visa' | 'mastercard' {
  if (company === 'mada') return 'mada';
  if (company === 'mastercard') return 'mastercard';
  return 'visa';
}
