import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

interface Props {
  amountHalalas: number;
  onToken: (token: string, brand: string) => void;
  onError: (message: string) => void;
}

/**
 * Renders Moyasar's hosted card fields inside a WebView. Card number/CVV are
 * typed directly into Moyasar's own JS and tokenized on Moyasar's servers —
 * the token (not the PAN) is the only thing that ever reaches this app or our
 * backend, which is what keeps us out of PCI DSS scope for card data.
 */
export default function MoyasarCardForm({ amountHalalas, onToken, onError }: Props) {
  const publishableKey = Constants.expoConfig?.extra?.moyasarPublishableKey as string;

  const html = `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://cdn.moyasar.com/mpf/1.13.0/moyasar.css" />
      <script src="https://cdn.moyasar.com/mpf/1.13.0/moyasar.js"></script>
      <style>body{font-family:-apple-system,sans-serif;margin:0;padding:12px;}</style>
    </head><body>
      <div class="mysr-form"></div>
      <script>
        Moyasar.init({
          element: '.mysr-form',
          amount: ${amountHalalas},
          currency: 'SAR',
          description: 'Rihat Alsham order',
          publishable_api_key: '${publishableKey}',
          methods: ['creditcard'],
          supported_networks: ['mada', 'visa', 'mastercard'],
          on_completed: function (payment) {
            // We only need the token; the actual charge is created server-side
            // in POST /api/payments/charge so it can be tied to a validated order.
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'token', token: payment.source.token, brand: payment.source.company
            }));
            return false; // prevent Moyasar.js from charging directly
          },
          on_failure: function (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: error.message }));
          }
        });
      </script>
    </body></html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'token') onToken(data.token, data.brand);
          else onError(data.message ?? 'Payment failed');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 340, borderRadius: 12, overflow: 'hidden' },
});
