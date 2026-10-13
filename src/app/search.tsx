import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { SectionHeader } from '@/components/section-header';
import { useSavedSearch, type SavedResultKind } from '@/features/search/hooks/use-saved-search';
import { buildSearchIndex, filterSearchIndex, type SearchTarget } from '@/services/universal-search';
import { useTranslation } from '@/i18n';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';

export default function SearchScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { saved, recent } = useSavedSearch(query);

  const index = useMemo(() => buildSearchIndex(t), [t]);
  const matches = useMemo(() => filterSearchIndex(index, query), [index, query]);
  const commands = matches.filter((target) => target.kind === 'command');
  const places = matches.filter((target) => target.kind !== 'command');

  const trimmed = query.trim();
  const hasResults = commands.length > 0 || places.length > 0 || saved.length > 0;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('search.title')} onBack={goBack} testID="search-header" />
      <View style={styles.fieldWrapper}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          autoFocus
          testID="universal-search-field"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {trimmed === '' ? (
          <>
            <SectionHeader title={t('search.recentTitle')} testID="search-recent-header" />
            {recent.length > 0 ? (
              <View style={styles.list}>
                {recent.map((item) => (
                  <SavedRow
                    key={`${item.kind}-${item.id}`}
                    kind={item.kind}
                    title={item.title}
                    onPress={() => openSaved(item.kind, item.id)}
                    testID={`search-recent-${item.kind}-${item.id}`}
                  />
                ))}
              </View>
            ) : (
              <AppText variant="caption" color="textSecondary">
                {t('search.emptyHint')}
              </AppText>
            )}
          </>
        ) : (
          <>
            {commands.length > 0 ? (
              <>
                <SectionHeader
                  title={t('search.actionsTitle')}
                  count={commands.length}
                  testID="search-actions-header"
                />
                <View style={styles.list}>
                  {commands.map((target) => (
                    <TargetRow
                      key={target.id}
                      target={target}
                      onPress={() => openTarget(target.id)}
                      testID={`search-result-${target.id}`}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {places.length > 0 ? (
              <>
                <SectionHeader
                  title={t('search.featuresTitle')}
                  count={places.length}
                  testID="search-features-header"
                />
                <View style={styles.list}>
                  {places.map((target) => (
                    <TargetRow
                      key={target.id}
                      target={target}
                      onPress={() => openTarget(target.id)}
                      testID={`search-result-${target.id}`}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {saved.length > 0 ? (
              <>
                <SectionHeader
                  title={t('search.savedTitle')}
                  count={saved.length}
                  testID="search-saved-header"
                />
                <View style={styles.list}>
                  {saved.map((item) => (
                    <SavedRow
                      key={`${item.kind}-${item.id}`}
                      kind={item.kind}
                      title={item.title}
                      onPress={() => openSaved(item.kind, item.id)}
                      testID={`search-saved-${item.kind}-${item.id}`}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {!hasResults ? (
              <AppText variant="body" color="textSecondary">
                {t('search.emptyResults', { query: trimmed })}
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function openTarget(id: string) {
  switch (id) {
    case 'add-task':
      router.push('/task-form');
      break;
    case 'add-income':
      router.push({ pathname: '/transaction-form', params: { kind: 'income' } });
      break;
    case 'add-expense':
      router.push({ pathname: '/transaction-form', params: { kind: 'expense' } });
      break;
    case 'new-note':
      router.push('/note-form');
      break;
    case 'add-bill':
      router.push('/bill-form');
      break;
    case 'add-request':
      router.push('/request-form');
      break;
    case 'new-grocery-list':
      router.push('/grocery-list-form');
      break;
    case 'check-updates':
      router.push('/about-update');
      break;
    case 'go-home':
      router.push('/');
      break;
    case 'go-tasks':
      router.push('/tasks');
      break;
    case 'go-bills':
      router.push('/bills');
      break;
    case 'go-finance':
      router.push('/finance');
      break;
    case 'go-notes':
      router.push('/notes');
      break;
    case 'go-family':
      router.push('/family');
      break;
    case 'go-grocery':
      router.push('/grocery');
      break;
    case 'go-prayer':
      router.push('/prayer');
      break;
    case 'go-health':
      router.push('/health');
      break;
    case 'go-entertainment':
      router.push('/entertainment');
      break;
    case 'go-about':
      router.push('/about');
      break;
    case 'go-prayer-settings':
      router.push('/prayer-settings');
      break;
    case 'go-language':
      router.push('/more');
      break;
    case 'go-terms':
      router.push('/about-terms');
      break;
    case 'go-privacy':
      router.push('/about-privacy');
      break;
    default:
      break;
  }
}

function openSaved(kind: SavedResultKind, id: string) {
  switch (kind) {
    case 'task':
      router.push({ pathname: '/task-form', params: { id } });
      break;
    case 'note':
      router.push({ pathname: '/note-form', params: { id } });
      break;
    case 'request':
      router.push({ pathname: '/request-form', params: { id } });
      break;
    case 'grocery':
      router.push({ pathname: '/grocery-detail', params: { id } });
      break;
    default:
      break;
  }
}

const KIND_ICONS: Record<SavedResultKind, keyof typeof Ionicons.glyphMap> = {
  task: 'checkbox-outline',
  note: 'document-text-outline',
  request: 'people-outline',
  grocery: 'cart-outline',
};

function TargetRow({
  target,
  onPress,
  testID,
}: {
  target: SearchTarget;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={target.title}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={target.icon} size={IconSize.md} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <AppText variant="bodyStrong">{target.title}</AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {target.hint}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
    </Pressable>
  );
}

function SavedRow({
  kind,
  title,
  onPress,
  testID,
}: {
  kind: SavedResultKind;
  title: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={KIND_ICONS[kind]} size={IconSize.md} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {t(`search.kinds.${kind}`)}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  fieldWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xs,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...CardShadow,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
});
