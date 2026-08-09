import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BrandMark from '@/src/components/BrandMark';
import { Btn, Screen } from '@/src/components/ui';
import { probeConnection } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

interface PairPayload {
  baseUrl?: string;
  token?: string;
}

/** Scan desktop LAN pairing QR. */
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
    return <Screen />;
  }

  if (!permission.granted) {
    return (
      <Screen style={styles.center}>
        <BrandMark size="lg" />
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Allow camera access to scan the desktop pairing QR.
        </Text>
        <Btn label="Allow camera" variant="signal" onPress={() => void requestPermission()} />
      </Screen>
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
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.frame, { borderColor: c.signal }]} />
        <Text style={styles.hint}>Align desktop QR in the frame</Text>
      </View>
      {error ? (
        <Text style={[styles.error, { backgroundColor: c.danger }]}>{error}</Text>
      ) : null}
      {busy ? <Text style={styles.busy}>Connecting…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  lead: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: 16,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
  },
  busy: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '600',
  },
});
