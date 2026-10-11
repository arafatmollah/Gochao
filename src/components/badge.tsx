import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface BadgeProps {
  label: string;
  color: string;
  backgroundColor: string;
  testID?: string;
}

export function Badge({ label, color, backgroundColor, testID }: BadgeProps) {
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor }]}>
      <AppText variant="caption" style={[styles.text, { color }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
