import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { probeConnection } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

interface PairPayload {
  baseUrl?: string;
  token?: string;
}

/** Scan desktop LAN pairing QR (`{"baseUrl","token"}`). */
export default function ScanScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { connect } = useConnection();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);

  async function handleData(data: string) {
    if (busy || scanned) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(data) as PairPayload;
      if (!parsed.baseUrl || !parsed.token) {
        throw new Error('QR missing baseUrl or token');
      }
      await probeConnection({ baseUrl: parsed.baseUrl, token: parsed.token });
      await connect({ baseUrl: parsed.baseUrl, token: parsed.token });
      setScanned(true);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: c.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Camera access is needed to scan the desktop QR.
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: c.primary }]}
          onPress={() => void requestPermission()}>
          <Text style={[styles.btnText, { color: c.primaryText }]}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          scanned || busy
            ? undefined
            : ({ data }) => {
                void handleData(data);
              }
        }
      />
      {error ? (
        <Text style={[styles.error, { backgroundColor: c.danger }]}>{error}</Text>
      ) : null}
      {busy ? <Text style={styles.hint}>Connecting…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  lead: { textAlign: 'center' },
  btn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  btnText: { fontWeight: '600' },
  error: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: 8,
    borderRadius: 8,
  },
});
