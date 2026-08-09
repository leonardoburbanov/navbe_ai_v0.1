/**
 * Navbe mobile palette — mirrors desktop Signal Console tokens.
 * Dark is the product default; light is a cool counterpart (not cream/purple).
 */
const Colors = {
  light: {
    text: '#141416',
    textMuted: '#6b6b76',
    background: '#f4f4f6',
    card: '#ffffff',
    border: 'rgba(20, 20, 22, 0.10)',
    borderStrong: 'rgba(20, 20, 22, 0.16)',
    tint: '#3d5f99',
    tabIconDefault: '#9a9aa3',
    tabIconSelected: '#3d5f99',
    primary: '#141416',
    primaryText: '#f4f4f5',
    signal: '#3d5f99',
    signalSoft: 'rgba(61, 95, 153, 0.12)',
    danger: '#c43c3c',
    dangerBg: 'rgba(196, 60, 60, 0.12)',
    success: '#1f9a5c',
    successBg: 'rgba(31, 154, 92, 0.12)',
    warning: '#a67c00',
    warningBg: 'rgba(166, 124, 0, 0.12)',
    inputBg: '#ffffff',
    modalBackdrop: 'rgba(20, 20, 22, 0.45)',
    modal: '#ffffff',
    errorBanner: '#c43c3c',
    heroGlow: 'rgba(61, 95, 153, 0.08)',
  },
  dark: {
    text: '#ececef',
    textMuted: '#8e8e98',
    background: '#141416',
    card: '#1a1a1e',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',
    tint: '#8eb6ff',
    tabIconDefault: '#6e6e78',
    tabIconSelected: '#8eb6ff',
    primary: '#f4f4f5',
    primaryText: '#0d0d0d',
    signal: '#8eb6ff',
    signalSoft: 'rgba(142, 182, 255, 0.14)',
    danger: '#ff6b6b',
    dangerBg: 'rgba(255, 107, 107, 0.14)',
    success: '#3dd68c',
    successBg: 'rgba(61, 214, 140, 0.14)',
    warning: '#f5c542',
    warningBg: 'rgba(245, 197, 66, 0.14)',
    inputBg: '#121214',
    modalBackdrop: 'rgba(0, 0, 0, 0.65)',
    modal: '#1a1a1e',
    errorBanner: '#ff6b6b',
    heroGlow: 'rgba(142, 182, 255, 0.10)',
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ThemeName];

export default Colors;
