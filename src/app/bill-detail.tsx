import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { OccurrenceCard } from '@/features/bills/components/occurrence-card';
import { BILL_CATEGORY_ICONS } from '@/features/bills/meta';
import { useBillDetail } from '@/features/bills/hooks/use-bill-detail';
import { formatIsoDateDisplay, formatMoney } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import type { BillOccurrence } from '@/types/bill';
import { todayIsoDate } from '@/utils/dates';

export default function BillDetailScreen() {
  const { t, locale } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const billId = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const detail = useBillDetail(billId);
  const today = todayIsoDate();

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/bills');
  }

  function openEdit() {
    if (!billId) return;
    router.push({ pathname: '/bill-form', params: { id: billId } });
  }

  function openPayment(occurrence: BillOccurrence) {
    router.push({ pathname: '/bill-pay', params: { occurrenceId: occurrence.id } });
  }

  async function handleArchiveToggle() {
    if (!detail.bill) return;
    await detail.setArchived(!detail.bill.isArchived);
  }

  async function handleDelete() {
    if (!detail.bill) return;
    const confirmed = await confirmDestructive({
      title: t('bills.form.deleteTitle'),
      message: t('bills.form.deleteMessage', { name: detail.bill.name }),
      confirmLabel: t('bills.form.deleteConfirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) {
      return;
    }
    const removed = await detail.remove();
    if (removed) {
      goBack();
    }
  }

  async function handleMarkUnpaid(occurrence: BillOccurrence) {
    const confirmed = await confirmDestructive({
      title: t('bills.detail.undoTitle'),
      message: t('bills.detail.undoMessage', {
        amount: formatMoney(occurrence.paidAmountMinor ?? occurrence.expectedAmountMinor, locale),
        date: formatIsoDateDisplay(occurrence.paidOn ?? occurrence.dueOn, t),
      }),
      confirmLabel: t('bills.detail.markUnpaid'),
      cancelLabel: t('common.cancel'),
    });
    if (confirmed) {
      await detail.markUnpaid(occurrence.id);
    }
  }

  const deleteBlocked = detail.paidCount > 0;
  const bill = detail.bill;

  return (
    <>
      <Stack.Screen options={{ title: t('bills.detail.headerTitle') }} />
      <Screen edges={['bottom']}>
        {detail.loadState === 'loading' ? (
          <LoadingState label={t('bills.form.loading')} />
        ) : detail.loadState === 'error' || !bill ? (
          <ErrorState
            title={t('bills.detail.loadErrorTitle')}
            message={detail.loadError ?? t('errors.generic')}
            onRetry={detail.retryLoad}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {detail.actionError ? (
              <Banner message={detail.actionError} onDismiss={detail.clearActionError} />
            ) : null}

            {/* Severity rule 13: a recorded payment is a local record only. */}
            <Banner tone="info" message={t('bills.detail.offlineNote')} />

            <Card style={styles.identityCard}>
              <View style={styles.identityRow}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={BILL_CATEGORY_ICONS[bill.category]}
                    size={IconSize.lg}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.identityBody}>
                  <View style={styles.titleRow}>
                    <AppText variant="heading" numberOfLines={2} style={styles.name}>
                      {bill.name}
                    </AppText>
                    {bill.isArchived ? (
                      <Badge
                        label={t('bills.list.archived')}
                        color={Colors.textMuted}
                        backgroundColor={Colors.surfaceMuted}
                      />
                    ) : null}
                  </View>
                  <AppText variant="caption" color="textSecondary">
                    {`${t(`bills.categories.${bill.category}`)} · ${t(`bills.recurrences.${bill.recurrence}`)}`}
                  </AppText>
                </View>
              </View>
              <AppText variant="subheading">
                {formatMoney(bill.expectedAmountMinor, locale)}
              </AppText>
            </Card>

            <Card style={styles.factsCard}>
              <InfoRow
                label={t('bills.detail.firstDueLabel')}
                value={formatIsoDateDisplay(bill.firstDueOn, t)}
              />
              {bill.installmentCount !== null ? (
                <InfoRow
                  label={t('bills.detail.installmentsLabel')}
                  value={t('bills.list.installmentProgress', {
                    paid: detail.paidCount,
                    total: bill.installmentCount,
                  })}
                />
              ) : null}
              {bill.reminderDaysBefore !== null ? (
                <>
                  <InfoRow
                    label={t('bills.detail.reminderLabel')}
                    value={t('bills.detail.reminderValue', { days: bill.reminderDaysBefore })}
                  />
                  <AppText variant="caption" color="textMuted">
                    {t('bills.detail.reminderDeferred')}
                  </AppText>
                </>
              ) : (
                <InfoRow
                  label={t('bills.detail.reminderLabel')}
                  value={t('bills.detail.reminderNone')}
                />
              )}
              {bill.notes ? (
                <InfoRow label={t('bills.detail.notesLabel')} value={bill.notes} />
              ) : null}
              <AppText variant="caption" color="textMuted">
                {t('bills.detail.createdLabel', {
                  date: formatIsoDateDisplay(bill.createdAt.slice(0, 10), t),
                })}
              </AppText>
            </Card>

            <View style={styles.actionsRow}>
              <View style={styles.actionItem}>
                <Button
                  label={t('bills.detail.edit')}
                  variant="secondary"
                  onPress={openEdit}
                  disabled={detail.busy}
                  fullWidth
                  testID="bill-edit-button"
                />
              </View>
              <View style={styles.actionItem}>
                <Button
                  label={bill.isArchived ? t('bills.detail.restore') : t('bills.detail.archive')}
                  variant="secondary"
                  onPress={handleArchiveToggle}
                  loading={detail.busy}
                  fullWidth
                  testID="bill-archive-button"
                />
              </View>
            </View>

            <Button
              label={t('bills.detail.delete')}
              variant="danger"
              onPress={handleDelete}
              disabled={deleteBlocked || detail.busy}
              fullWidth
              icon={<Ionicons name="trash-outline" size={IconSize.sm} color={Colors.danger} />}
              testID="bill-delete-button"
            />
            {deleteBlocked ? (
              <AppText variant="caption" color="textMuted">
                {t('bills.detail.deleteBlocked')}
              </AppText>
            ) : null}

            <AppText variant="subheading" style={styles.scheduleTitle}>
              {t('bills.detail.scheduleTitle')}
            </AppText>
            <View style={styles.scheduleList}>
              {detail.occurrences.map((occurrence) => (
                <OccurrenceCard
                  key={occurrence.id}
                  occurrence={occurrence}
                  category={bill.category}
                  today={today}
                  variant={occurrence.status === 'paid' ? 'history' : 'due'}
                  actionLabel={
                    occurrence.status === 'paid'
                      ? t('bills.detail.markUnpaid')
                      : t('bills.detail.recordPayment')
                  }
                  onAction={() => {
                    if (occurrence.status === 'paid') {
                      void handleMarkUnpaid(occurrence);
                    } else {
                      openPayment(occurrence);
                    }
                  }}
                  actionLoading={detail.busy}
                  testID={`bill-occurrence-${occurrence.id}`}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </Screen>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="caption" style={styles.infoValue} numberOfLines={4}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  identityCard: {
    gap: Spacing.md,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBody: {
    flex: 1,
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  factsCard: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionItem: {
    flex: 1,
  },
  scheduleTitle: {
    paddingTop: Spacing.sm,
  },
  scheduleList: {
    gap: Spacing.sm,
  },
});
