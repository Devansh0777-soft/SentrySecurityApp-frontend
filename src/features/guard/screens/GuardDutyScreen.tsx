import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import ScalePressable from '../../../components/common/ScalePressable';
import { resolveMediaUrl } from '../../../config/api';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import GuardTopNavigation from '../components/GuardTopNavigation';
import GuardBottomNavigation, {
  type GuardTab,
} from '../components/GuardBottomNavigation';
import {
  guardService,
  type GuardDutyDetails,
  type GuardDutyLog,
  type GuardDutyStatus,
} from '../../../services/guardService';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GuardStackParamList } from '../../../navigation/types';
import { useDutyTimer } from '../hooks/useDutyTimer';
import { useTranslation } from 'react-i18next';

const formatTime = (time?: string | null, notSetLabel?: string) => {
  if (!time) return notSetLabel ?? 'Schedule not set';
  const [hour = '0', minute = '00'] = time.split(':');
  const number = Number(hour);
  const suffix = number >= 12 ? 'PM' : 'AM';
  return `${String(number % 12 || 12).padStart(2, '0')}:${minute} ${suffix}`;
};

const formatClock = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const GuardDutyScreen = () => {
  const { t } = useTranslation();
  const [guard, setGuard] = useState<GuardDutyDetails | null>(null);
  const [duty, setDuty] = useState<GuardDutyStatus | null>(null);
  const [dutyLogs, setDutyLogs] = useState<GuardDutyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<GuardTab>('duty');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<GuardStackParamList>>();

  const load = useCallback(async () => {
    try {
      setError('');
      const [details, status, logs] = await Promise.all([
        guardService.getDutyDetails(),
        guardService.getDutyStatus(),
        // The photo log is supporting information — never block the dashboard.
        guardService.getDutyHistory().catch(() => [] as GuardDutyLog[]),
      ]);
      setGuard(details);
      setDuty(status);
      setDutyLogs(logs);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('guard.duty.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Runs on mount and again after the selfie capture screen closes, so the
  // timer and photo log reflect the new duty log immediately.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isOnDuty = duty?.status === 'on_duty';
  const activeLog = duty?.active_log ?? null;
  const timer = useDutyTimer(activeLog?.clock_in_at);
  // Backend-authoritative 24-hour cycle state (display-only UX guard; the
  // backend re-validates every clock-in/out).
  const canStart = duty ? (duty.can_start ?? duty.status === 'off_duty') : false;
  const nextDutyAt = duty?.next_start_at ?? null;
  const coolingDown = !isOnDuty && !canStart;
  const notSetLabel = t('guard.duty.scheduleNotSet');
  const assignmentText = useMemo(() => {
    if (!guard?.site_name) return t('guard.duty.noActiveSite');
    return `${formatTime(guard.start_time, notSetLabel)} – ${formatTime(
      guard.end_time,
      notSetLabel,
    )}`;
  }, [guard, notSetLabel, t]);
  const todayLogs = useMemo(() => {
    const today = new Date().toDateString();
    return dutyLogs.filter(
      log => new Date(log.clock_in_at).toDateString() === today,
    );
  }, [dutyLogs]);

  const startDuty = () => {
    if (!guard?.site_id) {
      Alert.alert(
        t('guard.duty.noActiveSite'),
        t('guard.duty.noActiveSiteHint'),
      );
      return;
    }
    if (!canStart) {
      // 24-hour duty cycle: explain why, using the backend-computed next
      // allowed start time (never a hardcoded reset time).
      Alert.alert(
        t('guard.duty.dutyCycleTitle'),
        nextDutyAt
          ? t('guard.duty.dutyCycleWait', { time: formatClock(nextDutyAt) })
          : t('guard.duty.dutyCycleNoTime'),
      );
      return;
    }
    navigation.navigate('GuardDutyCapture', { mode: 'clock_in' });
  };
  const endDuty = () => navigation.navigate('GuardDutyCapture', { mode: 'clock_out' });
  const showUnavailable = (label: string) =>
    Alert.alert(label, t('guard.common.featureSoon'));
  const handleTab = (tab: GuardTab) => {
    setActiveTab(tab);
    if (tab === 'report') {
      navigation.navigate('GuardReport');
      return;
    }
    if (tab === 'patrol') {
      navigation.navigate('GuardPatrol');
      return;
    }
    if (tab === 'profile') {
      navigation.navigate('GuardProfile');
      return;
    }
    if (tab === 'schedule') {
      navigation.navigate('GuardSchedule');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <GuardTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        avatarInitials={(guard?.full_name || 'G')
          .trim()
          .charAt(0)
          .toUpperCase()}
      />
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>{t('guard.duty.loading')}</Text>
        </View>
      ) : null}
      {!loading && error ? (
        <View style={styles.state}>
          <Text style={styles.error}>{error}</Text>
          <ScalePressable
            style={styles.retry}
            onPress={() => {
              setLoading(true);
              load();
            }}
          >
            <Text style={styles.retryText}>{t('guardProfile.tryAgain')}</Text>
          </ScalePressable>
        </View>
      ) : null}
      {!loading && !error && guard ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                setLoading(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <ScalePressable
            style={[styles.dutyCard, isOnDuty && styles.dutyCardActive]}
            onPress={isOnDuty ? endDuty : startDuty}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              isOnDuty ? t('guard.duty.clockOut') : t('guard.duty.clockIn')
            }
          >
            <View
              style={[styles.dutyCircle, isOnDuty && styles.dutyCircleActive]}
            >
              <Feather
                name={isOnDuty ? 'sun' : 'moon'}
                size={scaleFont(34)}
                color={colors.primary}
              />
              <Text style={styles.dutyLabel}>
                {isOnDuty ? t('guard.duty.onDuty') : t('guard.duty.offDuty')}
              </Text>
            </View>
            {isOnDuty ? (
              <>
                <Text style={styles.timerLabel}>
                  {t('guard.duty.timerLabel')}
                </Text>
                <Text style={styles.dutyTimer}>{timer.label}</Text>
                <Text style={styles.dutyHint}>
                  {t('guard.duty.startedAt', {
                    time: formatClock(activeLog?.clock_in_at),
                  })}
                </Text>
              </>
            ) : null}
            <Text style={styles.dutyAction}>
              {isOnDuty
                ? t('guard.duty.tapToClockOut')
                : coolingDown
                  ? t('guard.duty.dutyCycleTitle')
                  : t('guard.duty.tapToClockIn')}
            </Text>
            <Text style={styles.dutyHint}>
              {isOnDuty
                ? t('guard.duty.clockOutPhotoNotice')
                : coolingDown
                  ? nextDutyAt
                    ? t('guard.duty.nextDutyHint', {
                        time: formatClock(nextDutyAt),
                      })
                    : t('guard.duty.dutyCycleNoTime')
                  : t('guard.duty.clockInPhotoRequired')}
            </Text>
          </ScalePressable>

          <Card
            title={t('guard.duty.currentAssignment')}
            action={() => showUnavailable(t('guard.duty.assignmentDetails'))}
          >
            <View style={styles.assignmentRow}>
              <IconBox icon="map-pin" />
              <View style={styles.flex}>
                <Text style={styles.assignmentName}>
                  {guard.site_name || t('guard.duty.noSiteAssigned')}
                </Text>
                <Text style={styles.muted}>
                  {guard.site_address || assignmentText}
                </Text>
              </View>
              {guard.site_name ? (
                <Badge
                  label={
                    isOnDuty ? t('guard.duty.active') : t('guard.duty.assigned')
                  }
                />
              ) : null}
            </View>
            {guard.site_name && guard.site_address ? (
              <Text style={[styles.muted, styles.schedule]}>
                {assignmentText}
              </Text>
            ) : null}
          </Card>

          <Card title={t('guard.duty.radioContact')}>
            <View style={styles.assignmentRow}>
              <IconBox icon="radio" />
              <View style={styles.flex}>
                <Text style={styles.assignmentName}>
                  {t('guard.duty.controlRoom')}
                </Text>
                <Text style={styles.muted}>{t('guard.duty.channel')}</Text>
              </View>
              <ScalePressable
                style={styles.call}
                onPress={() => showUnavailable(t('guard.duty.callControlRoom'))}
                accessibilityLabel={t('guard.duty.callControlRoom')}
              >
                <Feather
                  name="phone"
                  size={scaleFont(22)}
                  color={colors.primary}
                />
              </ScalePressable>
            </View>
          </Card>
          <Card
            title={t('guard.duty.salaryTitle')}
            action={() => navigation.navigate('GuardSalary')}
          >
            <ScalePressable
              style={styles.assignmentRow}
              onPress={() => navigation.navigate('GuardSalary')}
              accessibilityRole="button"
              accessibilityLabel={t('guard.duty.salaryRow')}
            >
              <IconBox icon="dollar-sign" />
              <View style={styles.flex}>
                <Text style={styles.assignmentName}>
                  {t('guard.duty.salaryRow')}
                </Text>
                <Text style={styles.muted}>
                  {t('guard.duty.salaryCaption')}
                </Text>
              </View>
            </ScalePressable>
          </Card>
          <Card title={t('guard.duty.photoLogTitle')}>
            {todayLogs.length ? (
              todayLogs.map(log => (
                <View key={log.id} style={styles.logGroup}>
                  <Text style={styles.logSite}>
                    {log.site_name || t('guard.duty.noSiteAssigned')}
                  </Text>
                  <DutyPhotoRow
                    label={t('guard.duty.clockInPhoto')}
                    time={formatClock(log.clock_in_at)}
                    photo={log.clock_in_photo}
                  />
                  <DutyPhotoRow
                    label={t('guard.duty.clockOutPhoto')}
                    time={formatClock(log.clock_out_at)}
                    photo={log.clock_out_photo}
                  />
                </View>
              ))
            ) : (
              <View style={styles.assignmentRow}>
                <IconBox icon="image" />
                <Text style={[styles.muted, styles.flex]}>
                  {t('guard.duty.photoEmpty')}
                </Text>
              </View>
            )}
          </Card>
        </ScrollView>
      ) : null}
      <GuardBottomNavigation
        activeTab={activeTab}
        onTabPress={tab => {
          setProfileMenuOpen(false);
          handleTab(tab);
        }}
      />
      {profileMenuOpen ? (
        <ScalePressable
          style={styles.backdrop}
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
            initials: (guard?.full_name || 'G').trim().charAt(0).toUpperCase(),
          }}
          onMyProfile={() => {
            setProfileMenuOpen(false);
            handleTab('profile');
          }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
};

const IconBox = ({
  icon,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
}) => (
  <View style={styles.iconBox}>
    <Feather name={icon} size={scaleFont(24)} color={colors.gold} />
  </View>
);
const Badge = ({ label }: { label: string }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);
const Card = ({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: () => void;
}) => (
  <View style={styles.card}>
    <View style={styles.cardTitleRow}>
      <View style={styles.sectionMark} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <ScalePressable
          onPress={action}
          style={styles.chevron}
          accessibilityLabel={`${title} details`}
        >
          <Feather
            name="chevron-right"
            size={scaleFont(23)}
            color={colors.primary}
          />
        </ScalePressable>
      ) : null}
    </View>
    {children}
  </View>
);

const DutyPhotoRow = ({
  label,
  time,
  photo,
}: {
  label: string;
  time: string;
  photo?: string | null;
}) => {
  const { t } = useTranslation();
  const uri = resolveMediaUrl(photo);

  return (
    <View style={styles.logRow}>
      {uri ? (
        <Image source={{ uri }} style={styles.logThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.logThumb, styles.logThumbEmpty]}>
          <Feather name="image" size={scaleFont(18)} color={colors.textGray} />
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.logLabel}>{label}</Text>
        <Text style={styles.muted}>
          {uri ? time : t('guard.duty.photoPending')}
        </Text>
      </View>
      {uri ? (
        <Feather
          name="check-circle"
          size={scaleFont(18)}
          color={colors.status.success}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.regular,
    color: colors.textGray,
  },
  error: {
    color: colors.status.danger,
    fontFamily: typography.fontFamily,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(12),
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },
  dutyCard: {
    minHeight: scaleHeight(250),
    borderRadius: spacing.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dutyCardActive: {
    backgroundColor: colors.white,
    borderColor: colors.gold,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dutyCircle: {
    width: scaleWidth(142),
    height: scaleWidth(142),
    borderRadius: scaleWidth(71),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: scaleWidth(3),
    borderColor: colors.border,
  },
  dutyCircleActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  dutyLabel: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    fontSize: scaleFont(typography.sizes.sm),
    letterSpacing: scaleFont(1.5),
  },
  dutyAction: {
    marginTop: spacing.md,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    fontSize: scaleFont(typography.sizes.lg),
  },
  dutyHint: {
    marginTop: spacing.xs,
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
  },
  timerLabel: {
    marginTop: spacing.md,
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    fontSize: scaleFont(typography.sizes.xs),
    letterSpacing: scaleFont(1.4),
  },
  dutyTimer: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    fontSize: scaleFont(typography.sizes.xxxl),
    letterSpacing: scaleFont(1.2),
  },
  logGroup: { gap: spacing.sm, marginBottom: spacing.sm },
  logSite: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    fontSize: scaleFont(typography.sizes.sm),
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logThumb: {
    height: scaleWidth(46),
    width: scaleWidth(46),
    borderRadius: scaleWidth(10),
    backgroundColor: colors.light.background,
  },
  logThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  logLabel: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
    fontSize: scaleFont(typography.sizes.sm),
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: scaleWidth(14),
    backgroundColor: colors.white,
  },
  cardTitleRow: {
    minHeight: scaleHeight(28),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionMark: {
    height: scaleHeight(23),
    width: spacing.xs,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: scaleFont(1.8),
  },
  chevron: { padding: spacing.xs },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: { flex: 1 },
  iconBox: {
    height: spacing.xxxl,
    width: spacing.xxxl,
    borderRadius: spacing.lg,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentName: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    color: colors.primary,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.lg,
    backgroundColor: colors.light.background,
  },
  badgeText: {
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    fontSize: scaleFont(typography.sizes.xs),
    color: colors.status.success,
    letterSpacing: scaleFont(0.8),
  },
  schedule: { marginTop: spacing.sm, marginLeft: scaleWidth(58) },
  call: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GuardDutyScreen;
