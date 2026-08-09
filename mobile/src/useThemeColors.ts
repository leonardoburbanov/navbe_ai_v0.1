import Colors, { type ThemeColors, type ThemeName } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

/** Resolved light/dark palette for the current system appearance. */
export function useThemeColors(): ThemeColors {
  const scheme = (useColorScheme() ?? 'light') as ThemeName;
  return Colors[scheme] ?? Colors.light;
}
