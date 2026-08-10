import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';

import { useThemeColors } from '@/src/useThemeColors';

type Size = 'sm' | 'md' | 'lg' | 'hero';

const SIZES: Record<Size, number> = {
  sm: 28,
  md: 40,
  lg: 56,
  hero: 88,
};

interface BrandMarkProps {
  size?: Size;
  showWordmark?: boolean;
  style?: StyleProp<ImageStyle>;
}

/** Navbe logo mark (+ optional wordmark). */
export default function BrandMark({
  size = 'md',
  showWordmark = false,
  style,
}: BrandMarkProps) {
  const c = useThemeColors();
  const dim = SIZES[size];

  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/images/navbe-logo.png')}
        style={[{ width: dim, height: dim, tintColor: c.text }, style]}
        resizeMode="contain"
        accessibilityLabel="Navbe"
      />
      {showWordmark ? (
        <Text style={[styles.wordmark, { color: c.text, fontSize: size === 'hero' ? 34 : 22 }]}>
          Navbe
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordmark: { fontWeight: '700', letterSpacing: -0.6 },
});
