import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';

const ACTIVE = new Set(['running', 'pending', 'paused']);

/** Live run detail with cancel / approve / reject. */
export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { connected } = useConnection();
  const qc = useQueryClient();

  const run = useQuery({
    queryKey: ['run', id],
    queryFn: () => api.getRun(id!),
    enabled: connected && Boolean(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && ACTIVE.has(status) ? 1500 : false;
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelRun(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['run', id] });
      void qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });

  const resume = useMutation({
    mutationFn: (approved: boolean) => api.resumeRun(id!, { approved }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['run', id] });
      void qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });

  if (!connected) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Connect first.</Text>
      </View>
    );
  }

  if (run.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (run.isError || !run.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{String(run.error ?? 'Missing run')}</Text>
      </View>
    );
  }

  const state = run.data;
  const steps = state.steps ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{state.flow_id}</Text>
      <Text style={styles.meta}>{state.run_id}</Text>
      <Text style={styles.status}>Status: {state.status}</Text>
      {state.current_node ? <Text style={styles.meta}>Node: {state.current_node}</Text> : null}
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      <View style={styles.actions}>
        {ACTIVE.has(state.status) && state.status !== 'paused' ? (
          <Pressable
            style={[styles.btn, styles.danger]}
            disabled={cancel.isPending}
            onPress={() => cancel.mutate()}>
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
        ) : null}
        {state.status === 'paused' ? (
          <>
            <Pressable
              style={styles.btn}
              disabled={resume.isPending}
              onPress={() => resume.mutate(true)}>
              <Text style={styles.btnText}>Approve</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.danger]}
              disabled={resume.isPending}
              onPress={() => resume.mutate(false)}>
              <Text style={styles.btnText}>Reject</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <Text style={styles.section}>Steps</Text>
      {steps.length === 0 ? (
        <Text style={styles.muted}>No step detail yet.</Text>
      ) : (
        steps.map((step) => (
          <View key={`${step.node_id}-${step.step_type}`} style={styles.step}>
            <Text style={styles.stepTitle}>
              {step.node_id} · {step.step_type}
            </Text>
            <Text style={styles.meta}>
              {step.status}
              {step.latency_ms != null ? ` · ${step.latency_ms}ms` : ''}
            </Text>
            {step.error ? <Text style={styles.error}>{step.error}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  status: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  meta: { fontSize: 12, opacity: 0.65 },
  muted: { opacity: 0.6 },
  error: { color: '#b00020' },
  section: { marginTop: 16, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  btn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  danger: { backgroundColor: '#b00020' },
  btnText: { color: '#fff', fontWeight: '600' },
  step: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  stepTitle: { fontWeight: '600' },
});
