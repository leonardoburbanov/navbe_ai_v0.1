import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import type { FlowMetadata } from '@/src/api/types';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

/** Read-only flow list with Run. */
export default function FlowsScreen() {
  const { connected } = useConnection();
  const c = useThemeColors();
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
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.textMuted }}>Connect first (Connect tab).</Text>
      </View>
    );
  }

  if (flows.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.tint} />
      </View>
    );
  }

  if (flows.isError) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.danger, textAlign: 'center' }}>{String(flows.error)}</Text>
      </View>
    );
  }

  const data = flows.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.flow_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ color: c.textMuted }}>No flows on this engine.</Text>
        }
        renderItem={({ item }: { item: FlowMetadata }) => (
          <View
            style={[
              styles.card,
              { borderColor: c.border, backgroundColor: c.card },
            ]}>
            <View style={styles.cardBody}>
              <Text style={[styles.title, { color: c.text }]}>
                {item.name || item.flow_id}
              </Text>
              <Text style={[styles.sub, { color: c.textMuted }]}>{item.flow_id}</Text>
            </View>
            <Pressable
              style={[
                styles.btn,
                { backgroundColor: c.primary },
                run.isPending && styles.disabled,
              ]}
              disabled={run.isPending}
              onPress={() => run.mutate(item.flow_id)}>
              <Text style={[styles.btnText, { color: c.primaryText }]}>Run</Text>
            </Pressable>
          </View>
        )}
      />
      {run.isError ? (
        <Text style={[styles.errorBanner, { backgroundColor: c.errorBanner, color: '#fff' }]}>
          {String(run.error)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardBody: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
  errorBanner: {
    padding: 10,
    textAlign: 'center',
  },
});
