import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import type { RunState } from '@/src/api/types';
import { useConnection } from '@/src/ConnectionContext';

/** List recent runs; tap for live detail. */
export default function RunsScreen() {
  const { connected } = useConnection();
  const router = useRouter();
  const runs = useQuery({
    queryKey: ['runs', 'all'],
    queryFn: () => api.listRuns(),
    enabled: connected,
    refetchInterval: 3000,
  });

  if (!connected) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Connect first (Connect tab).</Text>
      </View>
    );
  }

  if (runs.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (runs.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{String(runs.error)}</Text>
      </View>
    );
  }

  const data = runs.data?.runs ?? [];

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.run_id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.muted}>No runs yet.</Text>}
      renderItem={({ item }: { item: RunState }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/run/${item.run_id}`)}>
          <View style={styles.row}>
            <Text style={styles.title}>{item.flow_id}</Text>
            <Text style={[styles.pill, statusStyle(item.status)]}>{item.status}</Text>
          </View>
          <Text style={styles.sub}>{item.run_id}</Text>
          <Text style={styles.sub}>{new Date(item.updated_at).toLocaleString()}</Text>
        </Pressable>
      )}
    />
  );
}

function statusStyle(status: string) {
  if (status === 'completed') return styles.ok;
  if (status === 'failed' || status === 'cancelled') return styles.bad;
  if (status === 'running' || status === 'pending' || status === 'paused') return styles.live;
  return null;
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { opacity: 0.6 },
  error: { color: '#b00020', textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  sub: { fontSize: 12, opacity: 0.6 },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  ok: { backgroundColor: '#d4edda', color: '#0a7a32' },
  bad: { backgroundColor: '#f8d7da', color: '#b00020' },
  live: { backgroundColor: '#fff3cd', color: '#856404' },
});
