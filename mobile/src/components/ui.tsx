import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemeColors } from '@/src/useThemeColors';

type Variant = 'primary' | 'signal' | 'ghost' | 'danger';

interface BtnProps extends PressableProps {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Branded button. */
export function Btn({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...rest
}: BtnProps) {
  const c = useThemeColors();
  const isGhost = variant === 'ghost';
  const bg =
    variant === 'primary'
      ? c.primary
      : variant === 'signal'
        ? c.signal
        : variant === 'danger'
          ? c.danger
          : 'transparent';
  const fg =
    variant === 'primary'
      ? c.primaryText
      : variant === 'signal'
        ? c.primaryText
        : variant === 'danger'
          ? '#fff'
          : c.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: isGhost ? c.borderStrong : bg,
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
        },
        isGhost && styles.ghost,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

interface CardProps {
  children: ReactNode;
  featured?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Surface card. */
export function Card({ children, featured, style }: CardProps) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: featured ? c.signal : c.border,
        },
        featured && { backgroundColor: c.signalSoft },
        style,
      ]}>
      {children}
    </View>
  );
}

interface StatusPillProps {
  label: string;
  tone?: 'neutral' | 'ok' | 'live' | 'bad' | 'signal';
}

/** Compact status chip. */
export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const c = useThemeColors();
  const map = {
    neutral: { bg: c.border, fg: c.textMuted },
    ok: { bg: c.successBg, fg: c.success },
    live: { bg: c.warningBg, fg: c.warning },
    bad: { bg: c.dangerBg, fg: c.danger },
    signal: { bg: c.signalSoft, fg: c.signal },
  } as const;
  const t = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

interface EmptyProps {
  title: string;
  body?: string;
  action?: ReactNode;
}

/** Empty / connect-first placeholder. */
export function EmptyState({ title, body, action }: EmptyProps) {
  const c = useThemeColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: c.textMuted }]}>{body}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

interface ScreenProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Full-screen themed container. */
export function Screen({ children, style }: ScreenProps) {
  const c = useThemeColors();
  return (
    <View style={[styles.screen, { backgroundColor: c.background }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  ghost: { borderWidth: 1, backgroundColor: 'transparent' },
  label: { fontWeight: '600', fontSize: 15 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  emptyAction: { marginTop: 12 },
});
