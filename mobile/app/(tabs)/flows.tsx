import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import type { FlowMetadata } from '@/src/api/types';
import { useConnection } from '@/src/ConnectionContext';

/** Read-only flow list with Run. */
export default function FlowsScreen() {
  const { connected } = useConnection();
  const router = useRouter();
  const qc = useQueryClient();
  const flows = useQuery({
    queryKey: ['flows'],
    queryFn: () => api.listFlows(),
    enabled: connected,
  });
  const run = useMutation({
    mutationFn: (flowId: string) => api.startRun(flowId),
    onSuccess: (state) => {
      void qc.invalidateQueries({ queryKey: ['runs'] });
      router.push(`/run/${state.run_id}`);
    },
  });

  if (!connected) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Connect first (Connect tab).</Text>
      </View>
    );
  }

  if (flows.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (flows.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{String(flows.error)}</Text>
      </View>
    );
  }

  const data = flows.data ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.flow_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No flows on this engine.</Text>}
        renderItem={({ item }: { item: FlowMetadata }) => (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.name || item.flow_id}</Text>
              <Text style={styles.sub}>{item.flow_id}</Text>
            </View>
            <Pressable
              style={[styles.btn, run.isPending && styles.disabled]}
              disabled={run.isPending}
              onPress={() => run.mutate(item.flow_id)}>
              <Text style={styles.btnText}>Run</Text>
            </Pressable>
          </View>
        )}
      />
      {run.isError ? <Text style={styles.errorBanner}>{String(run.error)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { opacity: 0.6 },
  error: { color: '#b00020', textAlign: 'center' },
  errorBanner: {
    color: '#fff',
    backgroundColor: '#b00020',
    padding: 10,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardBody: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, opacity: 0.6 },
  btn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
