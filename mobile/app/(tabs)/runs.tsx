import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '@/src/api/client';
import type { RunState } from '@/src/api/types';
import { Btn, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

function toneFor(status: string): 'ok' | 'live' | 'bad' | 'neutral' {
  if (status === 'completed') return 'ok';
  if (status === 'failed' || status === 'cancelled') return 'bad';
  if (status === 'running' || status === 'pending' || status === 'paused') return 'live';
  return 'neutral';
}

/** Runs history with live polling. */
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
      <Screen>
        <EmptyState
          title="Connect first"
          body="Pair with the desktop engine to watch runs from here."
          action={<Btn label="Go to Home" variant="signal" onPress={() => router.push('/')} />}
        />
      </Screen>
    );
  }

  if (runs.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={c.signal} />
      </Screen>
    );
  }

  if (runs.isError) {
    return (
      <Screen>
        <EmptyState title="Couldn’t load runs" body={String(runs.error)} />
      </Screen>
    );
  }

  const data = runs.data?.runs ?? [];

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.run_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.h1, { color: c.text }]}>Runs</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              Live updates while the engine is online
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No runs yet" body="Start one from the Flows tab." />
        }
        renderItem={({ item }: { item: RunState }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: c.card,
                borderColor: c.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() =>
              router.push({ pathname: '/run/[id]', params: { id: item.run_id } })
            }>
            <View style={styles.row}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                {item.flow_id}
              </Text>
              <StatusPill label={item.status} tone={toneFor(item.status)} />
            </View>
            <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
              {item.run_id}
            </Text>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {new Date(item.updated_at).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 14, gap: 4 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  sub: { fontSize: 14 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12 },
});
