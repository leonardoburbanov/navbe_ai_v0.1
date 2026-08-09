import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MonoText } from '@/components/StyledText';
import BrandMark from '@/src/components/BrandMark';
import { Btn, Card, Screen } from '@/src/components/ui';
import { probeConnection } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

/** Pair with the desktop daemon — clean brand-first home. */
export default function ConnectScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { ready, connected, settings, connect, disconnect } = useConnection();
  const [baseUrl, setBaseUrl] = useState('http://192.168.1.');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready || hydrated) return;
    if (settings) {
      setBaseUrl(settings.baseUrl);
      setToken(settings.token);
    }
    setHydrated(true);
  }, [ready, settings, hydrated]);

  async function onConnect() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const version = await probeConnection({ baseUrl, token });
      await connect({ baseUrl, token });
      setOkMsg(`Connected · Navbe ${version.version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await disconnect();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <Screen style={styles.center}>
        <BrandMark size="lg" />
        <ActivityIndicator color={c.signal} style={{ marginTop: 20 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <BrandMark size="lg" showWordmark />
            <Text style={[styles.lead, { color: c.textMuted }]}>
              Run and monitor local workflows over the same Wi‑Fi as Desktop.
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: connected ? c.success : c.textMuted },
                ]}
              />
              <Text style={[styles.statusText, { color: c.textMuted }]}>
                {connected ? 'Paired with desktop' : 'Not paired'}
              </Text>
            </View>
          </View>

          <Card>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {connected ? 'Connection' : 'Pair with desktop'}
            </Text>
            <Text style={[styles.sectionBody, { color: c.textMuted }]}>
              On Desktop: Allow mobile → paste URL & token, or Scan QR.
            </Text>

            {connected && settings ? (
              <View style={[styles.engineRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <Text style={[styles.engineLabel, { color: c.textMuted }]}>Engine</Text>
                <MonoText style={[styles.mono, { color: c.signal }]} numberOfLines={1}>
                  {settings.baseUrl}
                </MonoText>
              </View>
            ) : null}

            <Text style={[styles.label, { color: c.textMuted }]}>Base URL</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: c.border,
                  backgroundColor: c.inputBg,
                  color: c.text,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.10:8000"
              placeholderTextColor={c.textMuted}
              value={baseUrl}
              onChangeText={setBaseUrl}
            />

            <Text style={[styles.label, { color: c.textMuted }]}>Pairing token</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: c.border,
                  backgroundColor: c.inputBg,
                  color: c.text,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Token from desktop"
              placeholderTextColor={c.textMuted}
              value={token}
              onChangeText={setToken}
              secureTextEntry={token.length > 8}
            />

            {error ? <Text style={[styles.msg, { color: c.danger }]}>{error}</Text> : null}
            {okMsg ? <Text style={[styles.msg, { color: c.success }]}>{okMsg}</Text> : null}

            <View style={styles.row}>
              <Btn
                label={connected ? 'Reconnect' : 'Connect'}
                variant="signal"
                loading={busy}
                disabled={!baseUrl.trim() || !token.trim()}
                onPress={() => void onConnect()}
                style={styles.half}
              />
              <Btn
                label="Scan QR"
                variant="ghost"
                onPress={() => router.push('/scan')}
                style={styles.half}
              />
            </View>
          </Card>

          {connected ? (
            <View style={styles.footerActions}>
              <Btn
                label="Open flows"
                variant="primary"
                onPress={() => router.push('/flows')}
                style={{ flex: 1 }}
              />
              <Btn
                label="Disconnect"
                variant="ghost"
                loading={busy}
                onPress={() => void onDisconnect()}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 20 },
  hero: { gap: 10 },
  lead: { fontSize: 15, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionBody: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 12 },
  engineRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 2,
  },
  engineLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  half: { flex: 1 },
  footerActions: { flexDirection: 'row', gap: 10 },
  msg: { marginTop: 10, fontSize: 13 },
  mono: { fontSize: 12 },
});
