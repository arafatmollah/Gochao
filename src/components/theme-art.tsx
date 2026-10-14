import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/theme-context';
import type { ThemeId } from '@/theme/themes';
import type { ThemeColors } from '@/theme/tokens';

/**
 * Subtle per-theme backdrop art: abstract geometric shapes (rings, petals,
 * diamonds, straw-hat bands) floating behind screen content at whisper
 * opacity. Pure Views — no assets, no animation — so it costs nothing and
 * respects reduced motion by construction. Rendered once per screen by the
 * shared `Screen` shell, never intercepting touches.
 */

interface Placed {
  color: keyof ThemeColors;
  opacity?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface RingShape extends Placed {
  kind: 'ring';
  size: number;
  width?: number;
}

interface DotShape extends Placed {
  kind: 'dot';
  size: number;
}

interface DiamondShape extends Placed {
  kind: 'diamond';
  size: number;
}

interface BarShape extends Placed {
  kind: 'bar';
  width: number;
  height: number;
  rotate?: number;
}

type ArtShape = RingShape | DotShape | DiamondShape | BarShape;

const ART: Record<ThemeId, ArtShape[]> = {
  default: [
    { kind: 'ring', size: 320, top: -110, right: -110, color: 'primary', width: 26, opacity: 0.07 },
    { kind: 'dot', size: 26, top: 168, right: 64, color: 'primary', opacity: 0.12 },
    { kind: 'ring', size: 180, bottom: 60, left: -70, color: 'primary', width: 18, opacity: 0.06 },
  ],
  dark: [
    { kind: 'ring', size: 320, top: -110, right: -110, color: 'primary', width: 26, opacity: 0.1 },
    { kind: 'dot', size: 26, top: 168, right: 64, color: 'accentGold', opacity: 0.16 },
    { kind: 'ring', size: 180, bottom: 60, left: -70, color: 'primary', width: 18, opacity: 0.08 },
  ],
  light: [
    { kind: 'ring', size: 320, top: -110, right: -110, color: 'primary', width: 26, opacity: 0.07 },
    { kind: 'dot', size: 26, top: 168, right: 64, color: 'accentGold', opacity: 0.14 },
    { kind: 'ring', size: 180, bottom: 60, left: -70, color: 'primary', width: 18, opacity: 0.06 },
  ],
  anime: [
    { kind: 'diamond', size: 120, top: -30, right: 30, color: 'primary', opacity: 0.1 },
    { kind: 'diamond', size: 64, top: 120, right: 120, color: 'accentGold', opacity: 0.14 },
    { kind: 'diamond', size: 40, top: 210, right: 40, color: 'primary', opacity: 0.12 },
    { kind: 'dot', size: 200, bottom: -60, left: -60, color: 'accentGoldSoft', opacity: 0.5 },
  ],
  loki: [
    { kind: 'diamond', size: 150, top: -40, right: 24, color: 'accentGold', opacity: 0.14 },
    { kind: 'diamond', size: 70, top: 140, right: 130, color: 'primary', opacity: 0.16 },
    { kind: 'bar', width: 220, height: 18, top: 250, right: -40, color: 'accentGold', opacity: 0.1, rotate: -24 },
  ],
  ironman: [
    { kind: 'ring', size: 220, top: -60, right: 20, color: 'danger', width: 20, opacity: 0.14 },
    { kind: 'ring', size: 120, top: -10, right: 70, color: 'danger', width: 12, opacity: 0.12 },
    { kind: 'dot', size: 30, top: 65, right: 145, color: 'accentGold', opacity: 0.2 },
    { kind: 'bar', width: 200, height: 16, bottom: 90, left: -50, color: 'danger', opacity: 0.08, rotate: 18 },
  ],
  strange: [
    { kind: 'ring', size: 260, top: -80, right: -40, color: 'accentPurple', width: 22, opacity: 0.16 },
    { kind: 'dot', size: 22, top: 40, right: 150, color: 'accentGold', opacity: 0.2 },
    { kind: 'dot', size: 14, top: 190, right: 60, color: 'primary', opacity: 0.2 },
    { kind: 'diamond', size: 56, bottom: 110, left: -18, color: 'accentPurple', opacity: 0.12 },
  ],
  onepiece: [
    { kind: 'ring', size: 300, top: -100, right: -90, color: 'accentGold', width: 26, opacity: 0.16 },
    { kind: 'bar', width: 250, height: 26, top: 60, right: -30, color: 'primary', opacity: 0.14, rotate: -14 },
    { kind: 'dot', size: 34, top: 210, right: 90, color: 'hero', opacity: 0.16 },
    { kind: 'dot', size: 130, bottom: -40, left: -40, color: 'accentGoldSoft', opacity: 0.55 },
  ],
};

function ShapeView({ shape, colors }: { shape: ArtShape; colors: ThemeColors }) {
  const { top, right, bottom, left, color, opacity = 0.08 } = shape;
  const position = { top, right, bottom, left };
  const paint = colors[color];
  if (shape.kind === 'ring') {
    return (
      <View
        style={[
          styles.base,
          position,
          {
            width: shape.size,
            height: shape.size,
            borderRadius: shape.size / 2,
            borderWidth: shape.width ?? 20,
            borderColor: paint,
            opacity,
          },
        ]}
      />
    );
  }
  if (shape.kind === 'dot') {
    return (
      <View
        style={[
          styles.base,
          position,
          {
            width: shape.size,
            height: shape.size,
            borderRadius: shape.size / 2,
            backgroundColor: paint,
            opacity,
          },
        ]}
      />
    );
  }
  if (shape.kind === 'diamond') {
    return (
      <View
        style={[
          styles.base,
          position,
          {
            width: shape.size,
            height: shape.size,
            borderRadius: shape.size * 0.22,
            backgroundColor: paint,
            opacity,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        styles.base,
        position,
        {
          width: shape.width,
          height: shape.height,
          borderRadius: shape.height / 2,
          backgroundColor: paint,
          opacity,
          transform: [{ rotate: `${shape.rotate ?? 0}deg` }],
        },
      ]}
    />
  );
}

export function ThemeArt() {
  const { theme, colors } = useAppTheme();
  return (
    <View style={styles.fill} pointerEvents="none">
      {ART[theme].map((shape, index) => (
        <ShapeView key={`${shape.kind}-${index}`} shape={shape} colors={colors} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  base: {
    position: 'absolute',
  },
});
