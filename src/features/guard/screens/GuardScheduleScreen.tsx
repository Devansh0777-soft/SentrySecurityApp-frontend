import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import ScalePressable from '../../../components/common/ScalePressable';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';
import GuardBottomNavigation from '../components/GuardBottomNavigation';
import type { GuardTab } from '../components/GuardBottomNavigation';
import GuardTopNavigation from '../components/GuardTopNavigation';
import { guardService } from '../../../services/guardService';
import type { GuardDutyDetails } from '../../../services/guardService';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import type { GuardStackParamList } from '../../../navigation/types';
import { buildWeekSchedule, weekRangeLabel } from '../utils/guardSchedule';

const GuardScheduleScreen = () => {
  const { t, i18n } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<GuardStackParamList>>();
  const [guard, setGuard] = useState<GuardDutyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');
        setGuard(await guardService.getDutyDetails());
      } catch (e) {
        setError(e instanceof Error ? e.message : t('guard.schedule.loadFailed'));
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
  const week = useMemo(
    () => buildWeekSchedule(guard, new Date(), i18n.language),
    [guard, i18n.language],
  );
  const range = useMemo(() => weekRangeLabel(week, i18n.language), [week, i18n.language]);
  const count = useMemo(() => week.filter(d => d.shifts.length > 0).length, [week]);
  const hasPosting = Boolean(guard?.site_id || guard?.site_name);
  const go = (tab: GuardTab) => {
    setMenuOpen(false);
    if (tab === 'duty') nav.navigate('GuardDuty');
    else if (tab === 'report') nav.navigate('GuardReport');
    else if (tab === 'patrol') nav.navigate('GuardPatrol');
    else if (tab === 'profile') nav.navigate('GuardProfile');
  };

  const menuIdentity = {
    name: guard?.full_name || t('guard.common.guardFallback'),
    company: guard?.guard_code ? t('guard.common.badgeId', { id: guard.guard_code }) : '',
    initials: (guard?.full_name || 'U').trim().charAt(0).toUpperCase(),
  };

  const onProfile = () => {
    setMenuOpen(false);
    nav.navigate('GuardProfile');
  };

  const closeMenu = () => setMenuOpen(false);

  const rangeText = range;
  const countText = t('guard.schedule.shiftsThisWeek', { count });

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <GuardTopNavigation
          profileMenuOpen={menuOpen}
          onProfilePress={() => setMenuOpen(o => !o)}
          avatarInitials={(guard?.full_name || 'U').trim().charAt(0).toUpperCase()}
        />
        <View style={s.state}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.muted}>{t('guard.schedule.loading')}</Text>
        </View>
        <GuardBottomNavigation activeTab="schedule" onTabPress={go} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <GuardTopNavigation
          profileMenuOpen={menuOpen}
          onProfilePress={() => setMenuOpen(o => !o)}
          avatarInitials={(guard?.full_name || 'U').trim().charAt(0).toUpperCase()}
        />
        <View style={s.state}>
          <View style={s.errIcon}>
            <Feather name="alert-circle" size={scaleFont(28)} color={colors.status.danger} />
          </View>
          <Text style={s.errText}>{error}</Text>
          <ScalePressable style={s.retry} onPress={() => load()} accessibilityRole="button">
            <Text style={s.retryText}>{t('guard.schedule.retry')}</Text>
          </ScalePressable>
        </View>
        <GuardBottomNavigation activeTab="schedule" onTabPress={go} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <GuardTopNavigation
        profileMenuOpen={menuOpen}
        onProfilePress={() => setMenuOpen(o => !o)}
        avatarInitials={(guard?.full_name || 'U').trim().charAt(0).toUpperCase()}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }>
        <View style={s.card}>
          <View style={s.titleRow}>
            <View style={s.mark} />
            <Text style={s.title}>{t('guard.schedule.thisWeek')}</Text>
          </View>
          <Text style={s.range}>{rangeText}</Text>
          <Text style={s.summary}>{countText}</Text>
          {!hasPosting ? (
            <View style={s.notice}>
              <Feather name="info" size={scaleFont(16)} color={colors.primary} />
              <Text style={s.noticeText}>{t('guard.schedule.noPosting')}</Text>
            </View>
          ) : null}
          <View style={s.rows}>
            {week.map(day => (
              <View key={day.isoDate} style={s.row}>
                <View style={s.dayCol}>
                  <Text style={[s.day, day.isToday && s.dayToday]}>{day.dayLabel}</Text>
                  <Text style={s.dateNum}>{day.date.getDate()}</Text>
                </View>
                <View style={s.detailCol}>
                  {day.shifts.length ? (
                    day.shifts.map((sh, i) => (
                      <View key={`${day.isoDate}-${i}`} style={s.shift}>
                        <Text style={s.time} numberOfLines={1}>
                          {sh.timeRange}
                        </Text>
                        {sh.siteName ? (
                          <Text style={s.site} numberOfLines={2}>
                            {sh.siteName}
                          </Text>
                        ) : null}
                        {sh.isOvernight ? (
                          <Text style={s.over}>{t('guard.schedule.endsNextDay')}</Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={s.empty}>{t('guard.schedule.noShift')}</Text>
                  )}
                </View>
                {day.isToday ? <View style={s.dot} /> : null}
              </View>
            ))}
          </View>
        </View>
        <View style={s.info}>
          <Feather name="moon" size={scaleFont(16)} color={colors.primary} />
          <Text style={s.infoText}>{t('guard.schedule.overnightNote')}</Text>
        </View>
      </ScrollView>
      <GuardBottomNavigation activeTab="schedule" onTabPress={go} />
      {menuOpen ? (
        <ScalePressable
          style={s.backdrop}
          onPress={closeMenu}
          accessibilityLabel={t('guard.common.closeProfileMenu')}>
          <View />
        </ScalePressable>
      ) : null}
      {menuOpen ? (
        <AgencyProfileMenu identity={menuIdentity} onMyProfile={onProfile} onLogout={closeMenu} />
      ) : null}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.background, position: 'relative' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  errIcon: {
    width: scaleWidth(56),
    height: scaleWidth(56),
    borderRadius: scaleWidth(28),
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errText: {
    color: colors.status.danger,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  retry: {
    minHeight: scaleHeight(46),
    paddingHorizontal: spacing.lg,
    borderRadius: scaleWidth(10),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: scaleWidth(14),
    backgroundColor: colors.white,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  mark: {
    height: scaleHeight(23),
    width: spacing.xs,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: scaleFont(1.8),
  },
  range: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
    color: colors.primary,
  },
  summary: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.medium,
    color: colors.textGray,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: scaleWidth(10),
    backgroundColor: colors.light.background,
  },
  noticeText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  rows: { marginTop: spacing.sm },
  row: {
    minHeight: scaleHeight(56),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  dayCol: { width: scaleWidth(52), gap: 2 },
  day: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
    color: colors.primary,
  },
  dayToday: { color: colors.status.info },
  dateNum: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    color: colors.textGray,
  },
  detailCol: { flex: 1, minWidth: 0, gap: spacing.xs },
  shift: { gap: 2, minWidth: 0 },
  time: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
    color: colors.primary,
  },
  site: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    color: colors.textGray,
  },
  over: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    color: colors.textGray,
  },
  empty: {
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    color: colors.textGray,
    fontStyle: 'italic',
  },
  dot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: colors.status.info,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: scaleWidth(12),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
    color: colors.textGray,
    lineHeight: scaleFont(18),
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});

export default GuardScheduleScreen;
