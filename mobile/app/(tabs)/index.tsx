import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MonoText } from '@/components/StyledText';
import { probeConnection } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';

/** Pair with the desktop daemon over the same Wi‑Fi. */
export default function ConnectScreen() {
  const router = useRouter();
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
      setOkMsg(`Connected to Navbe ${version.version}`);
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
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to desktop</Text>
      <Text style={styles.lead}>
        On the PC: Navbe Desktop → Allow mobile. Same Wi‑Fi. Paste URL + token, or scan the QR.
      </Text>

      <Text style={styles.label}>Base URL</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.1.10:8000"
        value={baseUrl}
        onChangeText={setBaseUrl}
      />

      <Text style={styles.label}>Pairing token</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Token from desktop"
        value={token}
        onChangeText={setToken}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {okMsg ? <Text style={styles.ok}>{okMsg}</Text> : null}

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
          disabled={busy || !baseUrl.trim() || !token.trim()}
          onPress={() => void onConnect()}>
          <Text style={styles.btnPrimaryText}>
            {busy ? 'Working…' : connected ? 'Reconnect' : 'Connect'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => router.push('/scan')}>
          <Text style={styles.btnGhostText}>Scan QR</Text>
        </Pressable>
      </View>

      {connected && settings ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Connected</Text>
          <MonoText style={styles.mono}>{settings.baseUrl}</MonoText>
          <Pressable
            style={[styles.btn, styles.btnGhost, styles.mt]}
            onPress={() => void onDisconnect()}>
            <Text style={styles.btnGhostText}>Disconnect</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Not connected — Flows / Runs / Schedules need a pair.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  lead: { fontSize: 14, opacity: 0.7, marginBottom: 12, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  btn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#1a1a1a' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnGhost: { borderWidth: 1, borderColor: '#ccc' },
  btnGhostText: { fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  error: { color: '#b00020', marginTop: 8 },
  ok: { color: '#0a7a32', marginTop: 8 },
  statusCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  statusTitle: { fontWeight: '700' },
  mono: { fontSize: 12 },
  mt: { marginTop: 8, alignSelf: 'flex-start' },
  hint: { marginTop: 16, opacity: 0.6, fontSize: 13 },
});
