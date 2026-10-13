import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { useAppTheme } from '@/theme/theme-context';
import { Radius, Spacing } from '@/theme/tokens';
import type { MonthNetItem } from '@/types/finance';

const BAR_AREA_HEIGHT = 72;

export interface SavingsChartProps {
  /** Oldest month first; already zero-filled by the caller. */
  series: MonthNetItem[];
  testID?: string;
}

/** Six-month net savings as simple column bars (up = saved, down = overspent). */
export function SavingsChart({ series, testID }: SavingsChartProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const maxAbsMinor = Math.max(1, ...series.map((item) => Math.abs(item.netMinor)));

  return (
    <View style={styles.chart} testID={testID}>
      {series.map((item) => {
        const monthIndex = Number(item.monthKey.slice(5, 7)) - 1;
        const positive = item.netMinor >= 0;
        const height = Math.round((Math.abs(item.netMinor) / maxAbsMinor) * BAR_AREA_HEIGHT);
        return (
          <View key={item.monthKey} style={styles.column}>
            <View style={styles.barArea}>
              <View
                testID={`savings-bar-${item.monthKey}`}
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: positive ? colors.success : colors.danger,
                  },
                ]}
              />
            </View>
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {t(`dates.monthsShort.${monthIndex}`)}
            </AppText>
            <AppText
              variant="caption"
              color={positive ? 'textSecondary' : 'danger'}
              numberOfLines={1}>
              {formatMoney(item.netMinor, locale)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  barArea: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  bar: {
    width: 18,
    borderRadius: Radius.sm,
  },
});
