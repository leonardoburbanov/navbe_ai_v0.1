import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/src/api/client';
import { Btn, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

const ACTIVE = new Set(['running', 'pending', 'paused']);

function toneFor(status: string): 'ok' | 'live' | 'bad' | 'neutral' {
  if (status === 'completed') return 'ok';
  if (status === 'failed' || status === 'cancelled') return 'bad';
  if (ACTIVE.has(status)) return 'live';
  return 'neutral';
}

/** Live run detail. */
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
      <Screen>
        <EmptyState title="Connect first" body="Pair with desktop to open this run." />
      </Screen>
    );
  }

  if (run.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={c.signal} />
      </Screen>
    );
  }

  if (run.isError || !run.data) {
    return (
      <Screen>
        <EmptyState title="Missing run" body={String(run.error ?? 'Not found')} />
      </Screen>
    );
  }

  const state = run.data;
  const steps = state.steps ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: c.text }]}>{state.flow_id}</Text>
          <StatusPill label={state.status} tone={toneFor(state.status)} />
        </View>
        <Text style={[styles.meta, { color: c.textMuted }]}>{state.run_id}</Text>
        {state.current_node ? (
          <Text style={[styles.meta, { color: c.signal }]}>Node · {state.current_node}</Text>
        ) : null}
        {state.error ? <Text style={{ color: c.danger, marginTop: 8 }}>{state.error}</Text> : null}

        <View style={styles.actions}>
          {ACTIVE.has(state.status) && state.status !== 'paused' ? (
            <Btn
              label="Cancel"
              variant="danger"
              loading={cancel.isPending}
              onPress={() => cancel.mutate()}
            />
          ) : null}
          {state.status === 'paused' ? (
            <>
              <Btn
                label="Approve"
                variant="signal"
                loading={resume.isPending}
                onPress={() => resume.mutate(true)}
              />
              <Btn
                label="Reject"
                variant="danger"
                loading={resume.isPending}
                onPress={() => resume.mutate(false)}
              />
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
              <View style={styles.stepRow}>
                <Text style={[styles.stepTitle, { color: c.text }]}>
                  {step.node_id}
                </Text>
                <StatusPill label={step.status} tone={toneFor(step.status)} />
              </View>
              <Text style={[styles.meta, { color: c.textMuted }]}>
                {step.step_type}
                {step.latency_ms != null ? ` · ${step.latency_ms}ms` : ''}
              </Text>
              {step.error ? <Text style={{ color: c.danger }}>{step.error}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 6, paddingBottom: 40 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '700', flex: 1, letterSpacing: -0.3 },
  meta: { fontSize: 12 },
  section: { marginTop: 20, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  step: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepTitle: { fontWeight: '700', flex: 1 },
});
