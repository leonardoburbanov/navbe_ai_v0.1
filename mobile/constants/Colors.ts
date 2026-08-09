const tintLight = '#2f95dc';
const tintDark = '#5eb3f0';

/** Semantic palette for light / dark UI. */
const Colors = {
  light: {
    text: '#111111',
    textMuted: '#666666',
    background: '#ffffff',
    card: '#f7f7f7',
    border: '#d0d0d0',
    tint: tintLight,
    tabIconDefault: '#999999',
    tabIconSelected: tintLight,
    primary: '#1a1a1a',
    primaryText: '#ffffff',
    danger: '#b00020',
    dangerBg: '#f8d7da',
    success: '#0a7a32',
    successBg: '#d4edda',
    warning: '#856404',
    warningBg: '#fff3cd',
    inputBg: '#ffffff',
    modalBackdrop: 'rgba(0,0,0,0.45)',
    modal: '#ffffff',
    errorBanner: '#b00020',
  },
  dark: {
    text: '#f2f2f2',
    textMuted: '#a0a0a0',
    background: '#0d0d0d',
    card: '#1a1a1a',
    border: '#333333',
    tint: tintDark,
    tabIconDefault: '#777777',
    tabIconSelected: tintDark,
    primary: '#f2f2f2',
    primaryText: '#111111',
    danger: '#ff6b7a',
    dangerBg: '#3a1518',
    success: '#5ddea0',
    successBg: '#143526',
    warning: '#f0d070',
    warningBg: '#3a3210',
    inputBg: '#1a1a1a',
    modalBackdrop: 'rgba(0,0,0,0.65)',
    modal: '#1c1c1c',
    errorBanner: '#ff6b7a',
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ThemeName];

export default Colors;
