import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '@/src/api/client';
import type { ScheduleMeta, ScheduleSpec } from '@/src/api/types';
import { useConnection } from '@/src/ConnectionContext';

/** List / create / edit / enable / disable schedules. */
export default function SchedulesScreen() {
  const { connected } = useConnection();
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
      <View style={styles.center}>
        <Text style={styles.muted}>Connect first (Connect tab).</Text>
      </View>
    );
  }

  if (schedules.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const list = schedules.data?.schedules ?? [];
  const flowIds = (flows.data ?? []).map((f) => f.flow_id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Schedules</Text>
        <Pressable
          style={styles.btn}
          onPress={() =>
            setEditor({
              schedule_id: `sched-${Date.now().toString(36)}`,
              flow_id: flowIds[0] ?? '',
              when: '+1h',
              enabled: true,
              name: '',
            })
          }>
          <Text style={styles.btnText}>New</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={list}
        keyExtractor={(item) => item.schedule_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>No schedules yet.</Text>}
        renderItem={({ item }: { item: ScheduleMeta }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name || item.schedule_id}</Text>
            <Text style={styles.sub}>
              {item.flow_id} · {item.when} · {item.enabled ? 'on' : 'off'}
            </Text>
            {item.next_run_at ? (
              <Text style={styles.sub}>Next: {new Date(item.next_run_at).toLocaleString()}</Text>
            ) : null}
            <View style={styles.row}>
              <Pressable
                style={styles.ghost}
                onPress={() =>
                  toggle.mutate({ id: item.schedule_id, enabled: item.enabled })
                }>
                <Text style={styles.ghostText}>{item.enabled ? 'Pause' : 'Enable'}</Text>
              </Pressable>
              <Pressable
                style={styles.ghost}
                onPress={() =>
                  setEditor({
                    schedule_id: item.schedule_id,
                    flow_id: item.flow_id,
                    when: item.when,
                    enabled: item.enabled,
                    name: item.name ?? '',
                  })
                }>
                <Text style={styles.ghostText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal visible={editor != null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.heading}>{editor ? 'Schedule' : ''}</Text>
            {editor && (
              <>
                <Text style={styles.label}>ID</Text>
                <TextInput
                  style={styles.input}
                  value={editor.schedule_id}
                  onChangeText={(schedule_id) => setEditor({ ...editor, schedule_id })}
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Flow ID</Text>
                <TextInput
                  style={styles.input}
                  value={editor.flow_id}
                  onChangeText={(flow_id) => setEditor({ ...editor, flow_id })}
                  autoCapitalize="none"
                  placeholder={flowIds.join(', ') || 'flow_id'}
                />
                <Text style={styles.label}>When (+30s / +1h / cron)</Text>
                <TextInput
                  style={styles.input}
                  value={editor.when}
                  onChangeText={(when) => setEditor({ ...editor, when })}
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={editor.name ?? ''}
                  onChangeText={(name) => setEditor({ ...editor, name })}
                />
                <View style={styles.row}>
                  <Pressable
                    style={styles.btn}
                    disabled={save.isPending}
                    onPress={() => save.mutate(editor)}>
                    <Text style={styles.btnText}>{save.isPending ? 'Saving…' : 'Save'}</Text>
                  </Pressable>
                  <Pressable style={styles.ghost} onPress={() => setEditor(null)}>
                    <Text style={styles.ghostText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: { fontSize: 20, fontWeight: '700' },
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { opacity: 0.6 },
  error: { color: '#b00020', paddingHorizontal: 16 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, opacity: 0.65 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  btn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  ghost: { borderWidth: 1, borderColor: '#ccc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  ghostText: { fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 6,
  },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
