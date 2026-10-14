import { Colors } from '@/theme/tokens';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_IDS,
  THEME_STATUS_BAR,
  isThemeId,
} from '@/theme/themes';

describe('theme palettes', () => {
  it('defines every advertised theme id', () => {
    expect(THEME_IDS).toEqual([
      'default',
      'dark',
      'light',
      'anime',
      'loki',
      'ironman',
      'strange',
      'onepiece',
    ]);
    expect(DEFAULT_THEME).toBe('default');
    for (const id of THEME_IDS) {
      expect(THEMES[id]).toBeDefined();
    }
  });

  it('gives every palette exactly the default color keys', () => {
    const keys = Object.keys(Colors).sort();
    for (const id of THEME_IDS) {
      expect(Object.keys(THEMES[id]).sort()).toEqual(keys);
    }
  });

  it('uses valid hex or rgba color strings everywhere', () => {
    const pattern = /^(#[0-9a-fA-F]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/;
    for (const id of THEME_IDS) {
      for (const value of Object.values(THEMES[id])) {
        expect(value).toMatch(pattern);
      }
    }
  });

  it('validates stored theme ids', () => {
    expect(isThemeId('dark')).toBe(true);
    expect(isThemeId('loki')).toBe(true);
    expect(isThemeId('neon')).toBe(false);
    expect(isThemeId('')).toBe(false);
  });

  it('maps every theme to a status bar style', () => {
    for (const id of THEME_IDS) {
      expect(['dark', 'light']).toContain(THEME_STATUS_BAR[id]);
    }
  });
});
