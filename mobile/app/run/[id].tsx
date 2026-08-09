import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

const ACTIVE = new Set(['running', 'pending', 'paused']);

/** Live run detail with cancel / approve / reject. */
export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { connected } = useConnection();
  const c = useThemeColors();
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
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.textMuted }}>Connect first.</Text>
      </View>
    );
  }

  if (run.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.tint} />
      </View>
    );
  }

  if (run.isError || !run.data) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.danger }}>{String(run.error ?? 'Missing run')}</Text>
      </View>
    );
  }

  const state = run.data;
  const steps = state.steps ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: c.text }]}>{state.flow_id}</Text>
      <Text style={[styles.meta, { color: c.textMuted }]}>{state.run_id}</Text>
      <Text style={[styles.status, { color: c.text }]}>Status: {state.status}</Text>
      {state.current_node ? (
        <Text style={[styles.meta, { color: c.textMuted }]}>Node: {state.current_node}</Text>
      ) : null}
      {state.error ? <Text style={{ color: c.danger }}>{state.error}</Text> : null}

      <View style={styles.actions}>
        {ACTIVE.has(state.status) && state.status !== 'paused' ? (
          <Pressable
            style={[styles.btn, { backgroundColor: c.danger }]}
            disabled={cancel.isPending}
            onPress={() => cancel.mutate()}>
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
        ) : null}
        {state.status === 'paused' ? (
          <>
            <Pressable
              style={[styles.btn, { backgroundColor: c.primary }]}
              disabled={resume.isPending}
              onPress={() => resume.mutate(true)}>
              <Text style={[styles.btnText, { color: c.primaryText }]}>Approve</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: c.danger }]}
              disabled={resume.isPending}
              onPress={() => resume.mutate(false)}>
              <Text style={styles.btnText}>Reject</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <Text style={[styles.section, { color: c.text }]}>Steps</Text>
      {steps.length === 0 ? (
        <Text style={{ color: c.textMuted }}>No step detail yet.</Text>
      ) : (
        steps.map((step) => (
          <View
            key={`${step.node_id}-${step.step_type}`}
            style={[styles.step, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={[styles.stepTitle, { color: c.text }]}>
              {step.node_id} · {step.step_type}
            </Text>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {step.status}
              {step.latency_ms != null ? ` · ${step.latency_ms}ms` : ''}
            </Text>
            {step.error ? <Text style={{ color: c.danger }}>{step.error}</Text> : null}
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
  meta: { fontSize: 12 },
  section: { marginTop: 16, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  step: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  stepTitle: { fontWeight: '600' },
});
