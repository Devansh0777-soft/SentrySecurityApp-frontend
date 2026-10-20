import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import ScalePressable from '../../../components/common/ScalePressable';
import {
  agencyApiService,
  type AgencyCoverageRequest,
  type AgencyGuard,
  type AgencySite,
} from '../../../services/agencyApiService';
import { ApiError } from '../../../services/apiClient';
import { assignmentErrorMessage } from '../../../utils/assignmentErrors';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

type Props = {
  requestedId?: number;
  onRequestedIdHandled: () => void;
  onRequestUpdated?: () => void;
};

export default function AgencyCoverageRequests({
  requestedId,
  onRequestedIdHandled,
  onRequestUpdated,
}: Props) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<AgencyCoverageRequest[]>([]);
  const [guards, setGuards] = useState<AgencyGuard[]>([]);
  const [sites, setSites] = useState<AgencySite[]>([]);
  const [selected, setSelected] = useState<AgencyCoverageRequest | null>(null);
  const [selectedGuardIds, setSelectedGuardIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      setError('');
      try {
        const [requestData, guardData, siteData] = await Promise.all([
          agencyApiService.getCoverageRequests(),
          agencyApiService.getGuards(),
          agencyApiService.getSites(),
        ]);
        setRequests(requestData);
        setGuards(guardData);
        setSites(siteData);
        if (requestedId) {
          const target = requestData.find(item => item.id === requestedId);
          if (target) setSelected(target);
          onRequestedIdHandled();
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t('coverageManagement.loadFailed'),
        );
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [onRequestedIdHandled, requestedId, t],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedGuardIds(selected?.assigned_guard_ids ?? []);
  }, [selected]);

  const eligibleGuards = useMemo(
    () => guards.filter(guard => guard.status !== 'on_duty'),
    [guards],
  );

  // Site provisioned from this request: guards are assigned there.
  const linkedSite = useMemo(
    () =>
      sites.find(site => site.source_coverage_request_id === selected?.id) ??
      null,
    [sites, selected],
  );
  const guardsOnSite = useMemo(
    () =>
      linkedSite ? guards.filter(guard => guard.site_id === linkedSite.id) : [],
    [guards, linkedSite],
  );
  const capacity = selected?.guards_needed ?? 0;
  const assignedCount = guardsOnSite.length;
  const remainingSlots = Math.max(0, capacity - assignedCount);

  const updateStatus = async (status: AgencyCoverageRequest['status']) => {
    if (status === 'assigned' && !selectedGuardIds.length) {
      appAlert.error(
        t('coverageManagement.assignGuards'),
        t('coverageManagement.selectGuardFirst'),
      );
      return;
    }
    if (!selected) return;
    setWorking(true);
    try {
      const updated = await agencyApiService.updateCoverageRequest(
        selected.id,
        {
          status,
          ...(status === 'assigned' ? { guardIds: selectedGuardIds } : {}),
        },
      );
      setRequests(current =>
        current.map(item =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      setSelected(current => (current ? { ...current, ...updated } : current));
      onRequestUpdated?.();
      // Refresh guards/sites from the server so counts and availability
      // always reflect the committed assignment.
      load({ silent: true });
      appAlert.alert(
        t('coverageManagement.requestUpdated'),
        t('coverageManagement.requestUpdatedHint'),
        { type: 'success' },
      );
    } catch (updateError) {
      const limitReached =
        updateError instanceof ApiError && updateError.status === 403;
      appAlert.alert(
        limitReached
          ? t('dashboard.planLimitTitle')
          : t('coverageManagement.unableToUpdate'),
        assignmentErrorMessage(updateError, t),
        { type: 'error' },
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>{t('coverageManagement.loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.state}>
        <Text style={styles.error}>{error}</Text>
        <ScalePressable style={styles.outlineButton} onPress={() => load()}>
          <Text style={styles.outlineText}>{t('superAdmin.tryAgain')}</Text>
        </ScalePressable>
      </View>
    );
  }

  return (
    <>
      <View style={styles.list}>
        {!requests.length ? (
          <View style={styles.state}>
            <Feather name="inbox" size={scaleFont(28)} color={colors.primary} />
            <Text style={styles.title}>
              {t('coverageManagement.noRequests')}
            </Text>
            <Text style={styles.muted}>
              {t('coverageManagement.noRequestsHint')}
            </Text>
          </View>
        ) : (
          requests.map(request => (
            <ScalePressable
              key={request.id}
              style={styles.card}
              onPress={() => setSelected(request)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.title} numberOfLines={1}>
                  {request.event_name}
                </Text>
                <StatusBadge status={request.status} />
              </View>
              <Text style={styles.company}>{request.company_name}</Text>
              <View style={styles.metaRow}>
                <Feather
                  name="map-pin"
                  size={scaleFont(16)}
                  color={colors.textGray}
                />
                <Text style={styles.muted} numberOfLines={2}>
                  {request.site_location}, {request.city}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.guardsNeeded}>
                  {t('coverageManagement.guardsCount', {
                    count: request.guards_needed,
                  })}
                </Text>
                <Feather
                  name="chevron-right"
                  size={scaleFont(21)}
                  color={colors.primary}
                />
              </View>
            </ScalePressable>
          ))
        )}
      </View>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelected(null)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('coverageManagement.requestDetails')}
              </Text>
              <ScalePressable
                style={styles.close}
                onPress={() => setSelected(null)}
              >
                <Feather name="x" size={scaleFont(22)} color={colors.primary} />
              </ScalePressable>
            </View>
            {selected ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.details}>
                  <Detail
                    label={t('coverageManagement.client')}
                    value={selected.company_name}
                  />
                  <Detail
                    label={t('coverageManagement.event')}
                    value={selected.event_name}
                  />
                  <Detail
                    label={t('coverageManagement.location')}
                    value={`${selected.site_location}, ${selected.city}, ${selected.district}, ${selected.state}`}
                  />
                  <Detail
                    label={t('coverageManagement.guardsNeeded')}
                    value={String(selected.guards_needed)}
                  />
                  <Detail
                    label={t('coverageManagement.notes')}
                    value={selected.notes || t('coverageManagement.noNotes')}
                  />
                  <Detail
                    label={t('coverageManagement.status')}
                    value={t(`coverageManagement.statuses.${selected.status}`)}
                  />
                  {(selected.checkpoints?.length ?? 0) > 0 ? (
                    <View style={styles.guardSection}>
                      <Text style={styles.sectionTitle}>
                        {t('coverageManagement.checkpointsTitle')}
                      </Text>
                      <Text style={styles.muted}>
                        {t('coverageManagement.checkpointsHint')}
                      </Text>
                      {(selected.checkpoints ?? []).map((point, index) => (
                        <View
                          key={point.id ?? `${point.name}-${index}`}
                          style={styles.checkpointRow}
                        >
                          <Text style={styles.checkpointSeq}>
                            {point.sequence_order ?? index + 1}
                          </Text>
                          <Text style={styles.checkpointName}>
                            {point.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {selected.status === 'approved' ? (
                    <View style={styles.guardSection}>
                      <Text style={styles.sectionTitle}>
                        {t('coverageManagement.assignGuards')}
                      </Text>
                      <Text style={styles.muted}>
                        {t('coverageManagement.siteCapacity', {
                          assigned: assignedCount,
                          total: capacity,
                        })}
                      </Text>
                      <Text style={styles.muted}>
                        {remainingSlots > 0
                          ? t('coverageManagement.assignLimit', {
                              count: remainingSlots,
                            })
                          : t('coverageManagement.siteFull')}
                      </Text>
                      {eligibleGuards.length ? (
                        eligibleGuards.map(guard => {
                          const active = selectedGuardIds.includes(guard.id);
                          const alreadyHere =
                            linkedSite != null &&
                            guard.site_id === linkedSite.id;
                          const elsewhere =
                            guard.site_id != null && !alreadyHere;
                          const limitReached =
                            !active &&
                            selectedGuardIds.length >= remainingSlots;
                          const unavailable =
                            elsewhere || alreadyHere || limitReached;
                          const subtitle = alreadyHere
                            ? t('coverageManagement.alreadyOnSite')
                            : elsewhere
                            ? t('coverageManagement.assignedTo', {
                                site:
                                  guard.site_name ||
                                  t('addGuardForm.unassigned'),
                              })
                            : `${guard.guard_code} · ${
                                guard.site_name || t('addGuardForm.unassigned')
                              }`;
                          return (
                            <ScalePressable
                              key={guard.id}
                              style={[
                                styles.guardRow,
                                active && styles.guardRowActive,
                                unavailable &&
                                  !active &&
                                  styles.guardRowDisabled,
                              ]}
                              disabled={unavailable && !active}
                              onPress={() => {
                                if (unavailable && !active) return;
                                setSelectedGuardIds(current =>
                                  active
                                    ? current.filter(id => id !== guard.id)
                                    : [...current, guard.id],
                                );
                              }}
                            >
                              <View
                                style={[
                                  styles.checkbox,
                                  active && styles.checkboxActive,
                                ]}
                              >
                                {active ? (
                                  <Feather
                                    name="check"
                                    size={scaleFont(15)}
                                    color={colors.white}
                                  />
                                ) : null}
                              </View>
                              <View style={styles.flex}>
                                <Text style={styles.guardName}>
                                  {guard.full_name}
                                </Text>
                                <Text style={styles.muted}>{subtitle}</Text>
                              </View>
                            </ScalePressable>
                          );
                        })
                      ) : (
                        <Text style={styles.error}>
                          {t('coverageManagement.noAvailableGuards')}
                        </Text>
                      )}
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    {selected.status === 'pending' ? (
                      <>
                        <ActionButton
                          label={t('coverageManagement.reject')}
                          variant="danger"
                          disabled={working}
                          onPress={() => updateStatus('rejected')}
                        />
                        <ActionButton
                          label={t('coverageManagement.approve')}
                          disabled={working}
                          onPress={() => updateStatus('approved')}
                        />
                      </>
                    ) : null}
                    {selected.status === 'approved' ? (
                      <ActionButton
                        label={t('coverageManagement.assignSelected')}
                        disabled={working || !selectedGuardIds.length}
                        onPress={() => updateStatus('assigned')}
                      />
                    ) : null}
                    {selected.status === 'assigned' ? (
                      <ActionButton
                        label={t('coverageManagement.markCompleted')}
                        disabled={working}
                        onPress={() => updateStatus('completed')}
                      />
                    ) : null}
                  </View>
                  {working ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : null}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: AgencyCoverageRequest['status'] }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, styles[`badge_${status}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${status}`]]}>
        {t(`coverageManagement.statuses.${status}`)}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger';
}) {
  return (
    <ScalePressable
      style={[
        styles.actionButton,
        variant === 'danger' && styles.dangerButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[styles.actionText, variant === 'danger' && styles.dangerText]}
      >
        {label}
      </Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  state: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.bold,
  },
  company: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  muted: {
    flexShrink: 1,
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
  },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  guardsNeeded: {
    color: colors.gold,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  badge: {
    borderWidth: 1,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badge_pending: { borderColor: colors.gold },
  badge_approved: { borderColor: colors.status.success },
  badge_assigned: { borderColor: colors.primary },
  badge_completed: { borderColor: colors.status.success },
  badge_rejected: { borderColor: colors.status.danger },
  badgeText: {
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  badgeText_pending: { color: colors.gold },
  badgeText_approved: { color: colors.status.success },
  badgeText_assigned: { color: colors.primary },
  badgeText_completed: { color: colors.status.success },
  badgeText_rejected: { color: colors.status.danger },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(11,31,58,0.56)',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xl),
    fontWeight: typography.weights.bold,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  detail: { gap: spacing.xs },
  detailLabel: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.xs),
  },
  detailValue: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  guardSection: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.bold,
  },
  checkpointRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkpointSeq: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.light.background,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
    overflow: 'hidden',
  },
  checkpointName: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  guardRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.light.background,
  },
  guardRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.sm,
  },
  guardRowDisabled: { opacity: 0.6 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary },
  guardName: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
  },
  dangerButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.status.danger,
  },
  dangerText: { color: colors.status.danger },
  disabled: { opacity: 0.45 },
  outlineButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  outlineText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
});
