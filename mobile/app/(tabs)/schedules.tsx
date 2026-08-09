import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '@/src/api/client';
import type { ScheduleMeta, ScheduleSpec } from '@/src/api/types';
import { Btn, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

/** Schedules with branded cards + bottom sheet editor. */
export default function SchedulesScreen() {
  const { connected } = useConnection();
  const c = useThemeColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<ScheduleSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flows = useQuery({
    queryKey: ['flows'],
    queryFn: () => api.listFlows(),
    enabled: connected,
  });
  const schedules = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.listSchedules(),
    enabled: connected,
    refetchInterval: 5000,
  });

  const save = useMutation({
    mutationFn: async (spec: ScheduleSpec) => {
      const existing = (schedules.data?.schedules ?? []).some(
        (s) => s.schedule_id === spec.schedule_id,
      );
      return existing
        ? api.updateSchedule(spec.schedule_id, spec)
        : api.createSchedule(spec);
    },
    onSuccess: () => {
      setEditor(null);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? api.disableSchedule(id) : api.enableSchedule(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
    onError: (err: Error) => setError(err.message),
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState
          title="Connect first"
          body="Pair with desktop to manage schedules from your phone."
          action={<Btn label="Go to Home" variant="signal" onPress={() => router.push('/')} />}
        />
      </Screen>
    );
  }

  if (schedules.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={c.signal} />
      </Screen>
    );
  }

  const list = schedules.data?.schedules ?? [];
  const flowIds = (flows.data ?? []).map((f) => f.flow_id);

  return (
    <Screen>
      <FlatList
        data={list}
        keyExtractor={(item) => item.schedule_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.h1, { color: c.text }]}>Schedules</Text>
              <Text style={[styles.sub, { color: c.textMuted }]}>
                Timers fire while the desktop engine is online
              </Text>
            </View>
            <Btn
              label="New"
              variant="signal"
              onPress={() =>
                setEditor({
                  schedule_id: `sched-${Date.now().toString(36)}`,
                  flow_id: flowIds[0] ?? '',
                  when: '+1h',
                  enabled: true,
                  name: '',
                })
              }
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No schedules yet"
            body="Create one here or from Desktop."
            action={
              <Btn
                label="Create schedule"
                variant="signal"
                onPress={() =>
                  setEditor({
                    schedule_id: `sched-${Date.now().toString(36)}`,
                    flow_id: flowIds[0] ?? '',
                    when: '+1h',
                    enabled: true,
                    name: '',
                  })
                }
              />
            }
          />
        }
        renderItem={({ item }: { item: ScheduleMeta }) => (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardTop}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                {item.name || item.schedule_id}
              </Text>
              <StatusPill label={item.enabled ? 'on' : 'off'} tone={item.enabled ? 'ok' : 'neutral'} />
            </View>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {item.flow_id} · {item.when}
            </Text>
            {item.next_run_at ? (
              <Text style={[styles.meta, { color: c.textMuted }]}>
                Next {new Date(item.next_run_at).toLocaleString()}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Btn
                label={item.enabled ? 'Pause' : 'Enable'}
                variant="ghost"
                onPress={() =>
                  toggle.mutate({ id: item.schedule_id, enabled: item.enabled })
                }
              />
              <Btn
                label="Edit"
                variant="ghost"
                onPress={() =>
                  setEditor({
                    schedule_id: item.schedule_id,
                    flow_id: item.flow_id,
                    when: item.when,
                    enabled: item.enabled,
                    name: item.name ?? '',
                  })
                }
              />
            </View>
          </View>
        )}
      />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <Modal visible={editor != null} animationType="slide" transparent>
        <View style={[styles.backdrop, { backgroundColor: c.modalBackdrop }]}>
          <View style={[styles.sheet, { backgroundColor: c.modal }]}>
            <View style={[styles.sheetHandle, { backgroundColor: c.borderStrong }]} />
            <Text style={[styles.h2, { color: c.text }]}>Schedule</Text>
            {editor && (
              <>
                <Field
                  label="ID"
                  value={editor.schedule_id}
                  onChange={(schedule_id) => setEditor({ ...editor, schedule_id })}
                />
                <Field
                  label="Flow ID"
                  value={editor.flow_id}
                  onChange={(flow_id) => setEditor({ ...editor, flow_id })}
                  placeholder={flowIds.join(', ') || 'flow_id'}
                />
                <Field
                  label="When"
                  value={editor.when}
                  onChange={(when) => setEditor({ ...editor, when })}
                  placeholder="+30s / +1h / cron"
                />
                <Field
                  label="Name"
                  value={editor.name ?? ''}
                  onChange={(name) => setEditor({ ...editor, name })}
                />
                <View style={styles.actions}>
                  <Btn
                    label={save.isPending ? 'Saving…' : 'Save'}
                    variant="signal"
                    loading={save.isPending}
                    onPress={() => save.mutate(editor)}
                    style={{ flex: 1 }}
                  />
                  <Btn label="Cancel" variant="ghost" onPress={() => setEditor(null)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const c = useThemeColors();
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { borderColor: c.borderStrong, backgroundColor: c.inputBg, color: c.text },
        ]}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
});
