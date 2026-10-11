import type { TextStyle } from 'react-native';

/**
 * Jibon design tokens.
 *
 * Visual direction (master prompt §8 + the approved reference design):
 * warm off-white background, dark readable text, muted forest/teal-green
 * primary accent, rounded cards, subtle borders, minimal shadows, and a
 * deep-navy "hero" surface for summary cards.
 */

export const Colors = {
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EDE5',
  border: '#EAE5DA',
  borderStrong: '#D9D2C1',

  text: '#1F2A30',
  textSecondary: '#5C6B64',
  textMuted: '#8B948E',

  primary: '#0E7565',
  primaryPressed: '#0B5E51',
  primarySoft: '#E2F1EC',
  onPrimary: '#FFFFFF',

  /** Dark navy surface used by summary ("hero") cards. */
  hero: '#211D3E',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroTrack: 'rgba(255, 255, 255, 0.18)',
  /** Readable accent colors on the navy hero surface. */
  heroPositive: '#8FE3B9',
  heroNegative: '#FF9E8E',

  danger: '#C2452D',
  dangerSoft: '#F8E7E1',
  warning: '#B7791F',
  warningSoft: '#F6EDD8',

  success: '#1F8A5D',
  successSoft: '#DFF1E7',

  /** Soft tints for quick-action accents (grocery, rent, …). */
  accentGold: '#A87A1F',
  accentGoldSoft: '#F6EFD9',
  accentPurple: '#7A4EC0',
  accentPurpleSoft: '#EFE7F8',

  /** Badge dot and notification accents. */
  accentCoral: '#E5484D',

  overlay: 'rgba(31, 42, 48, 0.45)',
} as const;

export type ColorName = keyof typeof Colors;

export const PriorityColors = {
  high: { fg: Colors.danger, bg: Colors.dangerSoft },
  medium: { fg: Colors.warning, bg: Colors.warningSoft },
  low: { fg: Colors.textSecondary, bg: Colors.surfaceMuted },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const Typography = {
  title: { fontSize: 27, lineHeight: 34, fontWeight: '800' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  /** Large numerals on hero cards. */
  heroValue: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

export const IconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const ControlSize = {
  /** Minimum accessible touch target (Android guidelines: 48dp). */
  minTouchTarget: 48,
  buttonHeightSm: 40,
  buttonHeightMd: 48,
  inputHeight: 48,
} as const;

export const CardShadow = {
  shadowColor: '#1F2A30',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
