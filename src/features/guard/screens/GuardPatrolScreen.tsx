import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';

import ScalePressable from '../../../components/common/ScalePressable';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';
import GuardTopNavigation from '../components/GuardTopNavigation';
import GuardBottomNavigation, {
  type GuardTab,
} from '../components/GuardBottomNavigation';
import {
  guardService,
  type GuardDutyDetails,
  type GuardDutyStatus,
  type PatrolCheckpoint,
  type PatrolScanLog,
} from '../../../services/guardService';
import type { GuardStackParamList } from '../../../navigation/types';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { appAlert } from '../../../services/alertService';

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

/** Route order always comes from the backend sequence. */
const sortBySequence = (list: PatrolCheckpoint[]) =>
  [...list].sort(
    (a, b) =>
      Number(a.sequence_order ?? 0) - Number(b.sequence_order ?? 0) ||
      a.id - b.id,
  );

export default function GuardPatrolScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<GuardStackParamList>>();
  const [guard, setGuard] = useState<GuardDutyDetails | null>(null);
  const [duty, setDuty] = useState<GuardDutyStatus | null>(null);
  const [checkpoints, setCheckpoints] = useState<PatrolCheckpoint[]>([]);
  const [recentScans, setRecentScans] = useState<PatrolScanLog[]>([]);
  const [siteName, setSiteName] = useState('');
  const [siteId, setSiteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      try {
        if (mode === 'refresh') setRefreshing(true);
        else setLoading(true);
        setError('');
        // Duty status and checkpoint state are read together: the patrol list
        // must always reflect the guard's current backend duty session.
        const [details, patrol, dutyStatus] = await Promise.all([
          guardService.getDutyDetails(),
          // Session-scoped visit state: completion resets for every new duty.
          guardService.getPatrolCheckpoints().catch(() => null),
          // The same authoritative endpoint the Duty screen (and its timer) uses.
          guardService.getDutyStatus().catch(() => null),
        ]);
        setGuard(details);
        setDuty(dutyStatus);
        setCheckpoints(sortBySequence(patrol?.checkpoints ?? []));
        setRecentScans(patrol?.recent_scans ?? []);
        setSiteId(patrol?.site_id ?? details.site_id ?? null);
        setSiteName(patrol?.site_name || details.site_name || '');
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t('guard.patrol.loadFailed'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Silent re-read of the authoritative checkpoint state. */
  const syncPatrol = useCallback(async () => {
    const patrol = await guardService.getPatrolCheckpoints();
    setCheckpoints(sortBySequence(patrol.checkpoints ?? []));
    setRecentScans(patrol.recent_scans ?? []);
    setSiteId(current => patrol.site_id ?? current);
    setSiteName(patrol.site_name || '');
  }, []);

  /** Silent re-read of the authoritative duty session. */
  const refreshDuty = useCallback(async () => {
    const status = await guardService.getDutyStatus().catch(() => null);
    setDuty(status);
  }, []);

  // ONE duty state: the backend duty session (duty_logs row), the same source
  // the Duty screen and its timer read. The timer is considered running while
  // that active session has a clock-in timestamp. Checkpoint completion is
  // enabled only while both hold — and the backend enforces it too.
  const isDutyActive =
    duty?.status === 'on_duty' && Boolean(duty?.active_log?.clock_in_at);

  const progress = useMemo(() => {
    const scanned = checkpoints.filter(point => point.visited).length;
    const total = checkpoints.length;
    return {
      scanned,
      total,
      percent: total ? Math.round((scanned / total) * 100) : 0,
    };
  }, [checkpoints]);
  const nextCheckpoint = useMemo(
    () => checkpoints.find(point => !point.visited) ?? null,
    [checkpoints],
  );
  const allVisited =
    checkpoints.length > 0 && progress.scanned === checkpoints.length;

  const scanOne = async (point: PatrolCheckpoint) => {
    // One request at a time, never for an already-visited checkpoint, and only
    // during an active duty session (the backend rejects it too — this is the
    // UX guard, not the security boundary).
    if (!isDutyActive || scanningId != null || point.visited) return;
    try {
      setScanningId(point.id);
      const result = await guardService.scanPatrolCheckpoint(point.id);
      // The API confirmed the visit; only now does the row show as visited.
      setCheckpoints(current =>
        current.map(item =>
          item.id === point.id
            ? { ...item, visited: true, visited_at: result.scan.scanned_at }
            : item,
        ),
      );
      try {
        await syncPatrol();
      } catch {
        // The visit is stored; the next pull-to-refresh re-syncs the list.
      }
      if (result.round_completed) {
        appAlert.success(
          t('guard.patrol.completedTitle'),
          t('guard.patrol.completedBody'),
        );
      }
    } catch (scanError) {
      const message =
        scanError instanceof Error
          ? scanError.message
          : t('guard.common.tryAgain');
      // 409 = the backend already stored this visit: trust the server state.
      if (/already scanned/i.test(message)) {
        await syncPatrol().catch(() => undefined);
      } else {
        appAlert.alert(t('guard.patrol.updateFailed'), message, {
          type: 'error',
        });
      }
      // A rejected scan often means the duty session ended — re-read it so the
      // list flips back to the off-duty state immediately.
      await refreshDuty().catch(() => undefined);
    } finally {
      setScanningId(null);
    }
  };
  const handleTab = (tab: GuardTab) => {
    setProfileMenuOpen(false);
    if (tab === 'duty') navigation.navigate('GuardDuty');
    else if (tab === 'report') navigation.navigate('GuardReport');
    else if (tab === 'profile') navigation.navigate('GuardProfile');
    else if (tab === 'schedule') navigation.navigate('GuardSchedule');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <GuardTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        avatarInitials={(guard?.full_name || 'U')
          .trim()
          .charAt(0)
          .toUpperCase()}
      />
      {loading ? (
        <View style={s.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.muted}>{t('guard.patrol.loading')}</Text>
        </View>
      ) : !guard ? (
        <View style={s.state}>
          <Text style={s.error}>{error || t('guard.patrol.loadFailed')}</Text>
          <ScalePressable style={s.retry} onPress={() => load()}>
            <Text style={s.retryText}>{t('guardProfile.tryAgain')}</Text>
          </ScalePressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.primary}
            />
          }
        >
          {error ? (
            <View style={s.inlineError}>
              <Feather
                name="alert-circle"
                size={scaleFont(18)}
                color={colors.status.danger}
              />
              <Text style={s.inlineErrorText}>{error}</Text>
            </View>
          ) : null}
          {!siteId ? (
            <View style={s.emptyCard}>
              <Feather
                name="map-pin"
                size={scaleFont(26)}
                color={colors.textGray}
              />
              <Text style={s.emptyTitle}>{t('guard.patrol.noSiteTitle')}</Text>
              <Text style={s.muted}>{t('guard.patrol.noSiteBody')}</Text>
            </View>
          ) : checkpoints.length === 0 ? (
            <View style={s.emptyCard}>
              <Feather
                name="map-pin"
                size={scaleFont(26)}
                color={colors.textGray}
              />
              <Text style={s.emptyTitle}>{t('guard.patrol.emptyTitle')}</Text>
              <Text style={s.muted}>{t('guard.patrol.emptyBody')}</Text>
              <ScalePressable style={s.retry} onPress={() => load('refresh')}>
                <Text style={s.retryText}>{t('guardProfile.tryAgain')}</Text>
              </ScalePressable>
            </View>
          ) : (
            <>
              {allVisited ? (
                <View style={s.success}>
                  <Feather
                    name="check-circle"
                    size={scaleFont(30)}
                    color={colors.status.success}
                  />
                  <View>
                    <Text style={s.successTitle}>
                      {t('guard.patrol.allCompleted')}
                    </Text>
                    <Text style={s.muted}>
                      {t('guard.patrol.allCompletedBody')}
                    </Text>
                  </View>
                </View>
              ) : null}
              <Section title={t('guard.patrol.progress')}>
                {isDutyActive ? (
                  <>
                    <View style={s.progressRow}>
                      <Text style={s.progressText}>
                        {t('guard.patrol.completedCount', {
                          scanned: progress.scanned,
                          total: progress.total,
                        })}
                      </Text>
                      <Text
                        style={[
                          s.percent,
                          progress.percent === 100 && s.percentComplete,
                        ]}
                      >
                        {progress.percent}%
                      </Text>
                    </View>
                    <View style={s.track}>
                      <View
                        style={[
                          s.fill,
                          progress.percent === 100 && s.fillComplete,
                          { width: `${progress.percent}%` },
                        ]}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={s.muted}>{t('guard.patrol.startDutyHint')}</Text>
                )}
              </Section>
              {nextCheckpoint ? (
                <Section title={t('guard.patrol.nextCheckpoint')}>
                  <View style={s.locationRow}>
                    <View style={s.locationIcon}>
                      <Feather
                        name="map-pin"
                        size={scaleFont(24)}
                        color={colors.gold}
                      />
                    </View>
                    <View style={s.flex}>
                      <Text style={s.checkpointName}>
                        {nextCheckpoint.name}
                      </Text>
                      <Text style={s.muted}>
                        {t('guard.patrol.nextCheckpointHint')}
                      </Text>
                    </View>
                  </View>
                </Section>
              ) : null}
              <Section title={t('guard.patrol.recentScans')}>
                {recentScans.length ? (
                  recentScans.map(scan => (
                    <View key={scan.id} style={s.scanRow}>
                      <Feather
                        name="check-circle"
                        size={scaleFont(20)}
                        color={colors.status.success}
                      />
                      <Text style={s.scanName}>{scan.checkpoint_name}</Text>
                      <Text style={s.scanTime}>
                        {formatTime(scan.scanned_at)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.muted}>{t('guard.patrol.noScansYet')}</Text>
                )}
              </Section>
              <Section
                title={
                  siteName
                    ? t('guard.patrol.checkpointListWithSite', {
                        site: siteName,
                      })
                    : t('guard.patrol.checkpointList')
                }
              >
                <Text style={s.muted}>
                  {t('guard.patrol.checkpointCount', {
                    count: checkpoints.length,
                  })}
                </Text>
                {checkpoints.map((point, index) => {
                  const busy = scanningId === point.id;
                  return (
                    <View
                      key={point.id}
                      style={[
                        s.checkpointRow,
                        point.visited && s.checkpointRowDone,
                      ]}
                    >
                      <View style={s.sequence}>
                        <Text style={s.sequenceText}>{index + 1}</Text>
                      </View>
                      <View style={s.flex}>
                        <Text style={s.checkpointName}>{point.name}</Text>
                        <Text style={s.muted}>
                          {point.visited
                            ? `${t('guard.patrol.visited')} · ${formatTime(
                                point.visited_at,
                              )}`
                            : t('guard.patrol.notVisited')}
                        </Text>
                      </View>
                      {point.visited ? (
                        <View style={s.visitedBadge}>
                          <Feather
                            name="check"
                            size={scaleFont(16)}
                            color={colors.status.success}
                          />
                          <Text style={s.visitedText}>
                            {t('guard.patrol.visited')}
                          </Text>
                        </View>
                      ) : (
                        <ScalePressable
                          style={s.visitButton}
                          onPress={() => scanOne(point)}
                          disabled={!isDutyActive || busy}
                          accessibilityRole="button"
                          accessibilityLabel={t('guard.patrol.markVisited')}
                        >
                          {busy ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.white}
                            />
                          ) : (
                            <Text style={s.visitText}>
                              {t('guard.patrol.markVisited')}
                            </Text>
                          )}
                        </ScalePressable>
                      )}
                    </View>
                  );
                })}
              </Section>
            </>
          )}
        </ScrollView>
      )}
      <GuardBottomNavigation activeTab="patrol" onTabPress={handleTab} />
      {profileMenuOpen ? (
        <ScalePressable
          style={s.backdrop}
          onPress={() => setProfileMenuOpen(false)}
          accessibilityLabel={t('guard.common.closeProfileMenu')}
        >
          <View />
        </ScalePressable>
      ) : null}
      {profileMenuOpen ? (
        <AgencyProfileMenu
          identity={{
            name: guard?.full_name || t('guard.common.guardFallback'),
            company: guard?.guard_code
              ? t('guard.common.badgeId', { id: guard.guard_code })
              : '',
            initials: (guard?.full_name || 'U').trim().charAt(0).toUpperCase(),
          }}
          onMyProfile={() => {
            setProfileMenuOpen(false);
            navigation.navigate('GuardProfile');
          }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <View style={s.sectionMark} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  muted: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
  },
  error: {
    color: colors.status.danger,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  retry: {
    minHeight: scaleHeight(48),
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  retryText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },
  section: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: scaleWidth(14),
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionMark: {
    width: spacing.xs,
    height: scaleHeight(22),
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  sectionTitle: {
    flex: 1,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
    letterSpacing: scaleFont(1.4),
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  percent: {
    color: colors.gold,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.bold,
  },
  percentComplete: { color: colors.status.success },
  track: {
    height: scaleHeight(10),
    borderRadius: spacing.sm,
    backgroundColor: colors.light.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: spacing.sm,
    backgroundColor: colors.gold,
  },
  fillComplete: { backgroundColor: colors.status.success },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationIcon: {
    height: spacing.xxxl,
    width: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background,
  },
  flex: { flex: 1 },
  checkpointName: {
    flex: 1,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  scanRow: {
    minHeight: scaleHeight(38),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  scanName: {
    flex: 1,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
  },
  scanTime: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
  },
  checkpointRow: {
    minHeight: scaleHeight(64),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  checkpointRowDone: { backgroundColor: '#F0FDF4' },
  visitButton: {
    minHeight: scaleHeight(40),
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(14),
    fontWeight: typography.weights.semiBold,
  },
  visitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.lg,
    backgroundColor: '#E2F5E9',
  },
  visitedText: {
    color: colors.status.success,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(12),
    fontWeight: typography.weights.bold,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  inlineErrorText: {
    flex: 1,
    color: colors.status.danger,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(13),
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: scaleWidth(14),
    backgroundColor: colors.white,
  },
  emptyTitle: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(16),
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  sequence: {
    width: scaleHeight(27),
    height: scaleHeight(27),
    borderRadius: scaleHeight(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.border,
  },
  sequenceText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: '#E2F5E9',
  },
  successTitle: {
    color: colors.status.success,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});
