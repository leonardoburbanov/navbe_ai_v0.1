import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { FlowMetadata } from '@/src/api/types';
import { Btn, EmptyState, Screen } from '@/src/components/ui';
import { useConnection } from '@/src/ConnectionContext';
import { useThemeColors } from '@/src/useThemeColors';

/** Flow list — branded cards, tap to view graph. */
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
      router.push({ pathname: '/run/[id]', params: { id: state.run_id } });
    },
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState
          title="Connect first"
          body="Pair with Navbe Desktop on the Home tab to see your flows."
          action={<Btn label="Go to Home" variant="signal" onPress={() => router.push('/')} />}
        />
      </Screen>
    );
  }

  if (flows.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={c.signal} />
      </Screen>
    );
  }

  if (flows.isError) {
    return (
      <Screen>
        <EmptyState title="Couldn’t load flows" body={String(flows.error)} />
      </Screen>
    );
  }

  const data = flows.data ?? [];

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.flow_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.h1, { color: c.text }]}>Flows</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              {data.length} workflow{data.length === 1 ? '' : 's'} on this engine
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No flows yet" body="Create one in Navbe Desktop, then pull to refresh." />
        }
        renderItem={({ item }: { item: FlowMetadata }) => (
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
              router.push({ pathname: '/flow/[id]', params: { id: item.flow_id } })
            }>
            <View style={[styles.accent, { backgroundColor: c.signal }]} />
            <View style={styles.cardBody}>
              <Text style={[styles.title, { color: c.text }]}>
                {item.name || item.flow_id}
              </Text>
              <Text style={[styles.id, { color: c.textMuted }]}>{item.flow_id}</Text>
              <Text style={[styles.link, { color: c.signal }]}>View graph →</Text>
            </View>
            <Btn
              label="Run"
              variant="primary"
              loading={run.isPending}
              onPress={() => run.mutate(item.flow_id)}
              style={styles.runBtn}
            />
          </Pressable>
        )}
      />
      {run.isError ? (
        <Text style={[styles.errorBanner, { backgroundColor: c.danger, color: '#fff' }]}>
          {String(run.error)}
        </Text>
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingRight: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  accent: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginLeft: 0 },
  cardBody: { flex: 1, gap: 2, paddingLeft: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  id: { fontSize: 12 },
  link: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  runBtn: { minWidth: 72, paddingHorizontal: 12 },
  errorBanner: { padding: 10, textAlign: 'center' },
});
