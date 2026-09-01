import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/** Without this, any render error in production is a silent white screen —
 *  no message on the device and nothing in any log we can reach. */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>حدث خطأ</Text>
        <Text style={styles.subtitle}>Something went wrong starting the app.</Text>
        <ScrollView style={styles.box} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.detail} selectable>
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </Text>
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>إعادة المحاولة · Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 90 },
  title: { fontSize: 24, fontWeight: '700', color: colors.red, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 6 },
  box: { flex: 1, marginTop: 20, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  detail: { fontSize: 11.5, color: colors.ink, fontFamily: 'Courier' },
  button: { backgroundColor: colors.red, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
