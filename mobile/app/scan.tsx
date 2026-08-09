import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { probeConnection } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';

interface PairPayload {
  baseUrl?: string;
  token?: string;
}

/** Scan desktop LAN pairing QR (`{"baseUrl","token"}`). */
export default function ScanScreen() {
  const router = useRouter();
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
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.lead}>Camera access is needed to scan the desktop QR.</Text>
        <Pressable style={styles.btn} onPress={() => void requestPermission()}>
          <Text style={styles.btnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <Text style={styles.hint}>Connecting…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  lead: { textAlign: 'center', opacity: 0.8 },
  btn: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  error: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    color: '#fff',
    backgroundColor: '#b00020',
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
