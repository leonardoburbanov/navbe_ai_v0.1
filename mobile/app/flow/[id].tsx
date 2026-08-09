import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import FlowGraph from '@/src/components/FlowGraph';
import { Btn, EmptyState, Screen } from '@/src/components/ui';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

/** Read-only flow graph + Run. */
export default function FlowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { connected } = useConnection();
  const c = useThemeColors();
  const router = useRouter();
  const qc = useQueryClient();

  const flow = useQuery({
    queryKey: ['flow', id],
    queryFn: () => api.getFlow(id!),
    enabled: connected && Boolean(id),
  });

  const run = useMutation({
    mutationFn: () => api.startRun(id!),
    onSuccess: (state) => {
      void qc.invalidateQueries({ queryKey: ['runs'] });
      router.push({ pathname: '/run/[id]', params: { id: state.run_id } });
    },
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState title="Connect first" body="Pair with desktop to open this flow." />
      </Screen>
    );
  }

  if (flow.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={c.signal} />
      </Screen>
    );
  }

  if (flow.isError || !flow.data) {
    return (
      <Screen>
        <EmptyState title="Missing flow" body={String(flow.error ?? 'Not found')} />
      </Screen>
    );
  }

  const spec = flow.data;
  const nodeCount = spec.nodes?.length ?? 0;
  const edgeCount = spec.edges?.length ?? 0;

  return (
    <Screen>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]}>{spec.name || spec.flow_id}</Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {nodeCount} steps · {edgeCount} edges · entry `{spec.entry_node}`
          </Text>
        </View>
        <Btn
          label={run.isPending ? 'Starting…' : 'Run'}
          variant="signal"
          loading={run.isPending}
          onPress={() => run.mutate()}
        />
      </View>
      {run.isError ? (
        <Text style={[styles.error, { color: c.danger }]}>{String(run.error)}</Text>
      ) : null}
      <FlowGraph spec={spec} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  meta: { fontSize: 12 },
  error: { paddingHorizontal: 16, paddingTop: 8 },
});
