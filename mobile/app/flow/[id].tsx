import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FlowGraph from '@/src/components/FlowGraph';
import { api } from '@/src/api/client';
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
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.textMuted }}>Connect first.</Text>
      </View>
    );
  }

  if (flow.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.tint} />
      </View>
    );
  }

  if (flow.isError || !flow.data) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.danger }}>{String(flow.error ?? 'Missing flow')}</Text>
      </View>
    );
  }

  const spec = flow.data;
  const nodeCount = spec.nodes?.length ?? 0;
  const edgeCount = spec.edges?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]}>
            {spec.name || spec.flow_id}
          </Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {nodeCount} steps · {edgeCount} edges · entry `{spec.entry_node}`
          </Text>
        </View>
        <Pressable
          style={[
            styles.btn,
            { backgroundColor: c.primary },
            run.isPending && styles.disabled,
          ]}
          disabled={run.isPending}
          onPress={() => run.mutate()}>
          <Text style={[styles.btnText, { color: c.primaryText }]}>
            {run.isPending ? 'Starting…' : 'Run'}
          </Text>
        </Pressable>
      </View>
      {run.isError ? (
        <Text style={[styles.error, { color: c.danger }]}>{String(run.error)}</Text>
      ) : null}
      <FlowGraph spec={spec} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 12 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  btnText: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { paddingHorizontal: 16, paddingTop: 8 },
});
