import { Colors, type ThemeColors } from './tokens';

/**
 * Gochao theme palettes. Every theme supplies the full `ThemeColors` shape
 * so components read `colors.<name>` without caring which theme is active.
 *
 * - `default`: the original warm off-white + forest-teal design.
 * - `light`: a brighter, cleaner take on the default.
 * - `dark`: true dark mode for night use.
 * - `anime`: sakura-pink pop theme.
 * - `loki`: Asgard gold on deep mischief-green.
 * - `ironman`: hot-rod red and gold on dark armor.
 * - `strange`: mystic orange on sanctum purple.
 */

export const THEME_IDS = [
  'default',
  'dark',
  'light',
  'anime',
  'loki',
  'ironman',
  'strange',
  'onepiece',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'default';

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

/** Status bar content style per theme (matches the theme background). */
export const THEME_STATUS_BAR: Record<ThemeId, 'dark' | 'light'> = {
  default: 'dark',
  dark: 'light',
  light: 'dark',
  anime: 'dark',
  loki: 'light',
  ironman: 'light',
  strange: 'light',
  onepiece: 'dark',
};

const dark: ThemeColors = {
  background: '#101418',
  surface: '#1A2027',
  surfaceMuted: '#232B33',
  border: '#2A333C',
  borderStrong: '#3A4550',

  text: '#ECEFF1',
  textSecondary: '#A7B3BD',
  textMuted: '#6E7B87',

  primary: '#2BB673',
  primaryPressed: '#1E9E63',
  primarySoft: '#17352C',
  onPrimary: '#FFFFFF',

  hero: '#16233B',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroTrack: 'rgba(255, 255, 255, 0.18)',
  heroPositive: '#8FE3B9',
  heroNegative: '#FF9E8E',

  danger: '#E57373',
  dangerSoft: '#402722',
  warning: '#D9A441',
  warningSoft: '#3A2F1B',

  success: '#4CAF7D',
  successSoft: '#1D3329',

  accentGold: '#D9A441',
  accentGoldSoft: '#3A2F1B',
  accentPurple: '#B388EB',
  accentPurpleSoft: '#2C2340',

  accentCoral: '#F0655A',

  overlay: 'rgba(0, 0, 0, 0.6)',
};

const light: ThemeColors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F0EB',
  border: '#E7E4DA',
  borderStrong: '#D5D0C0',

  text: '#16202A',
  textSecondary: '#54616C',
  textMuted: '#8B95A0',

  primary: '#0B6E5D',
  primaryPressed: '#095A4C',
  primarySoft: '#DDF0E9',
  onPrimary: '#FFFFFF',

  hero: '#1E2A44',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroTrack: 'rgba(255, 255, 255, 0.18)',
  heroPositive: '#8FE3B9',
  heroNegative: '#FF9E8E',

  danger: '#BC3B26',
  dangerSoft: '#F8E7E1',
  warning: '#A86A15',
  warningSoft: '#F6EDD8',

  success: '#1C7A52',
  successSoft: '#DFF1E7',

  accentGold: '#96660F',
  accentGoldSoft: '#F8EFD4',
  accentPurple: '#6E44B5',
  accentPurpleSoft: '#EEE6F9',

  accentCoral: '#D63A40',

  overlay: 'rgba(22, 32, 42, 0.45)',
};

const anime: ThemeColors = {
  background: '#FFF5F7',
  surface: '#FFFFFF',
  surfaceMuted: '#FBE9F0',
  border: '#F5D9E2',
  borderStrong: '#EAC3D2',

  text: '#3A2430',
  textSecondary: '#8A5A6B',
  textMuted: '#B794A2',

  primary: '#EC4899',
  primaryPressed: '#DB2777',
  primarySoft: '#FCE7F1',
  onPrimary: '#FFFFFF',

  hero: '#3B1F4E',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroTrack: 'rgba(255, 255, 255, 0.18)',
  heroPositive: '#9BF0C3',
  heroNegative: '#FFB3C1',

  danger: '#E11D48',
  dangerSoft: '#FBE4EA',
  warning: '#D97706',
  warningSoft: '#FCF0DA',

  success: '#059669',
  successSoft: '#DDF3E9',

  accentGold: '#B45309',
  accentGoldSoft: '#FEF3C7',
  accentPurple: '#8B5CF6',
  accentPurpleSoft: '#EDE9FE',

  accentCoral: '#FB4D6D',

  overlay: 'rgba(58, 36, 48, 0.45)',
};

const loki: ThemeColors = {
  background: '#0C1510',
  surface: '#14201A',
  surfaceMuted: '#1C2B22',
  border: '#24352B',
  borderStrong: '#33463A',

  text: '#EDE8D5',
  textSecondary: '#A8B09A',
  textMuted: '#6F7A6B',

  primary: '#C9A227',
  primaryPressed: '#A8861D',
  primarySoft: '#2A2413',
  onPrimary: '#1A1405',

  hero: '#0F2E1F',
  heroText: '#F4EDD8',
  heroMuted: 'rgba(244, 237, 216, 0.72)',
  heroTrack: 'rgba(244, 237, 216, 0.18)',
  heroPositive: '#9BE3A8',
  heroNegative: '#FFA48E',

  danger: '#E0604F',
  dangerSoft: '#3A211C',
  warning: '#D9A441',
  warningSoft: '#33270F',

  success: '#5DBB63',
  successSoft: '#1B2E20',

  accentGold: '#E3B93B',
  accentGoldSoft: '#33270F',
  accentPurple: '#9D7BEA',
  accentPurpleSoft: '#251D3D',

  accentCoral: '#E5484D',

  overlay: 'rgba(0, 0, 0, 0.6)',
};

const ironman: ThemeColors = {
  background: '#141114',
  surface: '#211B1C',
  surfaceMuted: '#2B2324',
  border: '#332527',
  borderStrong: '#4A3638',

  text: '#F5EDE8',
  textSecondary: '#C4AFA6',
  textMuted: '#8A7570',

  primary: '#D42B2B',
  primaryPressed: '#A81F1F',
  primarySoft: '#3D1D1D',
  onPrimary: '#FFFFFF',

  hero: '#1F2A44',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroTrack: 'rgba(255, 255, 255, 0.18)',
  heroPositive: '#8FE3B9',
  heroNegative: '#FFB08E',

  danger: '#FF5040',
  dangerSoft: '#3D1F1B',
  warning: '#F0A92E',
  warningSoft: '#3A2C14',

  success: '#4CAF7D',
  successSoft: '#1B2E23',

  accentGold: '#F0A92E',
  accentGoldSoft: '#3A2C14',
  accentPurple: '#B388EB',
  accentPurpleSoft: '#2B2138',

  accentCoral: '#FF6B5E',

  overlay: 'rgba(0, 0, 0, 0.6)',
};

const strange: ThemeColors = {  background: '#120E1C',
  surface: '#1D162E',
  surfaceMuted: '#261D3A',
  border: '#2C2344',
  borderStrong: '#3E2F5E',

  text: '#F0E9F5',
  textSecondary: '#B9A8CC',
  textMuted: '#7E6E94',

  primary: '#E8722A',
  primaryPressed: '#C85A17',
  primarySoft: '#3A2415',
  onPrimary: '#FFF7ED',

  hero: '#2A1B4E',
  heroText: '#F5EDDC',
  heroMuted: 'rgba(245, 237, 220, 0.72)',
  heroTrack: 'rgba(245, 237, 220, 0.18)',
  heroPositive: '#9BF0C3',
  heroNegative: '#FFB08E',

  danger: '#F87171',
  dangerSoft: '#3A1F24',
  warning: '#FBBF24',
  warningSoft: '#38300F',

  success: '#34D399',
  successSoft: '#173128',

  accentGold: '#EAB308',
  accentGoldSoft: '#38300F',
  accentPurple: '#A78BFA',
  accentPurpleSoft: '#2B2145',

  accentCoral: '#FB7185',

  overlay: 'rgba(0, 0, 0, 0.6)',
};

const onepiece: ThemeColors = {
  background: '#F4EFE3',
  surface: '#FFFFFF',
  surfaceMuted: '#ECE4D0',
  border: '#E4DCCB',
  borderStrong: '#D5C9AC',

  text: '#23272E',
  textSecondary: '#5E6B76',
  textMuted: '#939AA2',

  primary: '#D62828',
  primaryPressed: '#A81F1F',
  primarySoft: '#F9E2E2',
  onPrimary: '#FFFFFF',

  hero: '#1D3557',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroTrack: 'rgba(255, 255, 255, 0.18)',
  heroPositive: '#8FE3B9',
  heroNegative: '#FFB08E',

  danger: '#BC3B26',
  dangerSoft: '#F8E7E1',
  warning: '#A86A15',
  warningSoft: '#F6EDD8',

  success: '#1C7A52',
  successSoft: '#DFF1E7',

  accentGold: '#B8860B',
  accentGoldSoft: '#F7ECD0',
  accentPurple: '#6E44B5',
  accentPurpleSoft: '#EEE6F9',

  accentCoral: '#E5484D',

  overlay: 'rgba(35, 39, 46, 0.45)',
};

export const THEMES: Record<ThemeId, ThemeColors> = {
  default: Colors,
  dark,
  light,
  anime,
  loki,
  ironman,
  strange,
  onepiece,
};
