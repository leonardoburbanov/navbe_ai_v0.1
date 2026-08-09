import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import type { RunState } from '@/src/api/types';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';
import type { ThemeColors } from '@/constants/Colors';

/** List recent runs; tap for live detail. */
export default function RunsScreen() {
  const { connected } = useConnection();
  const c = useThemeColors();
  const router = useRouter();
  const runs = useQuery({
    queryKey: ['runs', 'all'],
    queryFn: () => api.listRuns(),
    enabled: connected,
    refetchInterval: 3000,
  });

  if (!connected) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.textMuted }}>Connect first (Connect tab).</Text>
      </View>
    );
  }

  if (runs.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.tint} />
      </View>
    );
  }

  if (runs.isError) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.danger, textAlign: 'center' }}>{String(runs.error)}</Text>
      </View>
    );
  }

  const data = runs.data?.runs ?? [];

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={data}
      keyExtractor={(item) => item.run_id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={{ color: c.textMuted }}>No runs yet.</Text>}
      renderItem={({ item }: { item: RunState }) => {
        const pill = statusColors(item.status, c);
        return (
          <Pressable
            style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
            onPress={() => router.push(`/run/${item.run_id}`)}>
            <View style={styles.row}>
              <Text style={[styles.title, { color: c.text }]}>{item.flow_id}</Text>
              <Text style={[styles.pill, { backgroundColor: pill.bg, color: pill.fg }]}>
                {item.status}
              </Text>
            </View>
            <Text style={[styles.sub, { color: c.textMuted }]}>{item.run_id}</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              {new Date(item.updated_at).toLocaleString()}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function statusColors(status: string, c: ThemeColors): { bg: string; fg: string } {
  if (status === 'completed') return { bg: c.successBg, fg: c.success };
  if (status === 'failed' || status === 'cancelled') return { bg: c.dangerBg, fg: c.danger };
  if (status === 'running' || status === 'pending' || status === 'paused') {
    return { bg: c.warningBg, fg: c.warning };
  }
  return { bg: c.card, fg: c.textMuted };
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  sub: { fontSize: 12 },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
