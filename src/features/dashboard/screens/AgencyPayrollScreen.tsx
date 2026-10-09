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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import type { MainStackParamList } from '../../../navigation/types';
import {
  payrollService,
  formatINR,
  type PayrollOverviewRow,
  type PayrollStatus,
} from '../../../services/payrollService';
import { colors } from '../../../styles/colors';
import { typography } from '../../../styles/typography';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import ScalePressable from '../../../components/common/ScalePressable';
import AgencyBottomNavigation, {
  AgencyNavTab,
} from '../components/AgencyBottomNavigation';
import AgencyProfileMenu from '../components/AgencyProfileMenu';
import AgencyTopNavigation from '../components/AgencyTopNavigation';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyPayroll'>;

/** Burnt-orange accent reused across the financial screens. */
const AMBER = '#B9640A';
const SUCCESS = colors.status.success;

const isoMonthDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

/** Available payroll months: previous 12 up to the current month. */
const buildMonths = (): { period: string; key: string }[] => {
  const now = new Date();
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return {
      period: isoMonthDay(date),
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
    };
  });
};

const monthLabel = (period: string, locale: string): string => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
};

const statusStyle = (status: PayrollStatus) => {
  if (status === 'paid') {
    return { color: SUCCESS, tint: '#E4F6EA' };
  }
  if (status === 'verified') {
    return { color: colors.status.info, tint: '#EAF1FE' };
  }
  return { color: AMBER, tint: '#FDF1E0' };
};

const statusLabelKey = (status: PayrollStatus) =>
  status === 'paid'
    ? 'statusPaid'
    : status === 'verified'
    ? 'statusVerified'
    : 'statusPending';

const AgencyPayrollScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const months = useMemo(buildMonths, []);
  const [selectedPeriod, setSelectedPeriod] = useState(
    months[0]?.period ?? isoMonthDay(new Date()),
  );

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [rows, setRows] = useState<PayrollOverviewRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, verified: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setLoadError('');
        const data = await payrollService.getOverview(selectedPeriod);
        setRows(data.rows);
        setSummary(data.summary);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : t('payroll.loadFailed'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedPeriod, t],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const navigate = (tab: AgencyNavTab) => {
    if (tab === 'overview') navigation.navigate('AgencyOverview');
    if (tab === 'guards') navigation.navigate('AgencyGuards');
    if (tab === 'sites') navigation.navigate('AgencySites');
    if (tab === 'incidents') navigation.navigate('AgencyIncidents');
    if (tab === 'profile') navigation.navigate('AgencyProfile');
    if (tab === 'plan') navigation.navigate('AgencyPlan');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AgencyTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
      />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={s.section}>{t('payroll.sectionTitle')}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.monthRow}
        >
          {months.map(month => {
            const active = month.period === selectedPeriod;
            return (
              <ScalePressable
                key={month.key}
                style={[s.monthChip, active && s.monthChipActive]}
                onPress={() => {
                  if (active || loading) return;
                  setSelectedPeriod(month.period);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('payroll.selectMonth')}
              >
                <Text style={[s.monthChipText, active && s.monthChipTextActive]}>
                  {monthLabel(month.period, i18n.language)}
                </Text>
              </ScalePressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={s.state}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.stateText}>{t('payroll.loading')}</Text>
          </View>
        ) : null}

        {!loading && loadError ? (
          <View style={s.state}>
            <View style={s.errorIcon}>
              <Feather name="alert-circle" size={f(28)} color={colors.status.danger} />
            </View>
            <Text style={s.errorText}>{loadError}</Text>
            <ScalePressable style={s.retry} onPress={() => load()} accessibilityRole="button">
              <Text style={s.retryText}>{t('payroll.retry')}</Text>
            </ScalePressable>
          </View>
        ) : null}

        {!loading && !loadError ? (
          <>
            <View style={s.summaryRow}>
              <SummaryCard
                highlight
                value={formatINR(summary.total)}
                label={t('payroll.totalPayroll')}
              />
              <SummaryCard
                value={String(summary.verified)}
                label={t('payroll.verified')}
                valueColor={SUCCESS}
              />
              <SummaryCard
                value={String(summary.pending)}
                label={t('payroll.pending')}
                valueColor={AMBER}
              />
            </View>

            <Text style={s.listHeader}>{t('payroll.guardList')}</Text>

            {rows.length === 0 ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIcon}>
                  <Feather name="users" size={f(26)} color={colors.textGray} />
                </View>
                <Text style={s.emptyTitle}>{t('payroll.noGuards')}</Text>
                <Text style={s.emptyText}>{t('payroll.noGuardsHint')}</Text>
              </View>
            ) : (
              <View style={s.list}>
                {rows.map(row => (
                  <GuardRow
                    key={row.guard_id}
                    row={row}
                    onPress={() =>
                      navigation.navigate('AgencyPayrollDetails', {
                        guardId: row.guard_id,
                        period: selectedPeriod,
                      })
                    }
                    statusLabel={t(`payroll.${statusLabelKey(row.status)}`)}
                    notGenerated={t('payroll.notGenerated')}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      <AgencyBottomNavigation activeTab="plan" onTabPress={navigate} />
      {profileMenuOpen ? (
        <ScalePressable
          style={s.backdrop}
          onPress={() => setProfileMenuOpen(false)}
          accessibilityLabel={t('dashboard.close')}
        >
          <View />
        </ScalePressable>
      ) : null}
      {profileMenuOpen ? (
        <AgencyProfileMenu
          onMyProfile={() => {
            setProfileMenuOpen(false);
            navigation.navigate('AgencyProfile');
          }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
};

const SummaryCard: React.FC<{
  value: string;
  label: string;
  valueColor?: string;
  highlight?: boolean;
}> = ({ value, label, valueColor = colors.primary, highlight }) => (
  <View style={[s.summaryCard, highlight && s.summaryCardHighlight]}>
    <Text
      style={[s.summaryValue, { color: valueColor }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
    <Text style={s.summaryLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const GuardRow: React.FC<{
  row: PayrollOverviewRow;
  statusLabel: string;
  notGenerated: string;
  onPress: () => void;
}> = ({ row, statusLabel, notGenerated, onPress }) => {
  const appearance = statusStyle(row.status);
  const generated = row.payroll_id !== null;
  return (
    <ScalePressable
      style={s.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.full_name}
    >
      <View style={s.avatar}>
        <Feather name="user" size={f(20)} color={colors.primary} />
      </View>
      <View style={s.rowCopy}>
        <Text style={s.rowName} numberOfLines={1}>
          {row.full_name}
        </Text>
        <Text style={s.rowAmount}>{formatINR(row.amount)}</Text>
      </View>
      <View
        style={[s.badge, { borderColor: appearance.color, backgroundColor: appearance.tint }]}
      >
        <Text style={[s.badgeText, { color: appearance.color }]} numberOfLines={1}>
          {generated ? statusLabel : notGenerated}
        </Text>
      </View>
      <Feather name="chevron-right" size={f(20)} color={colors.textGray} />
    </ScalePressable>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
  content: { padding: w(16), paddingBottom: h(24) },
  section: {
    color: colors.primary,
    fontSize: f(17),
    fontWeight: '700',
    borderLeftWidth: w(4),
    borderLeftColor: colors.gold,
    paddingLeft: w(9),
    marginTop: h(8),
    marginBottom: h(12),
  },
  monthRow: { gap: w(8), paddingVertical: h(2), paddingRight: w(4) },
  monthChip: {
    paddingHorizontal: w(16),
    height: h(42),
    borderRadius: w(8),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthChipText: {
    color: colors.primary,
    fontSize: f(14),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
  },
  monthChipTextActive: { color: colors.white, fontWeight: typography.weights.semiBold },

  summaryRow: { flexDirection: 'row', gap: w(10), marginTop: h(16) },
  summaryCard: {
    flex: 1,
    minHeight: h(84),
    padding: w(12),
    borderRadius: w(12),
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  summaryCardHighlight: { borderColor: AMBER, backgroundColor: '#FFFDF8' },
  summaryValue: {
    fontSize: f(20),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.extraBold,
  },
  summaryLabel: {
    marginTop: h(4),
    color: colors.light.secondaryText,
    fontSize: f(12),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
  },

  listHeader: {
    color: colors.primary,
    fontSize: f(17),
    fontWeight: '700',
    borderLeftWidth: w(4),
    borderLeftColor: colors.gold,
    paddingLeft: w(9),
    marginTop: h(22),
    marginBottom: h(12),
  },
  list: { gap: h(8) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(10),
    paddingHorizontal: w(12),
    paddingVertical: h(12),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: w(10),
  },
  avatar: {
    width: w(42),
    height: w(42),
    borderRadius: w(21),
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: {
    color: colors.primary,
    fontSize: f(16),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
  },
  rowAmount: {
    color: colors.primary,
    fontSize: f(14),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
    marginTop: h(2),
  },
  badge: {
    paddingHorizontal: w(10),
    paddingVertical: h(5),
    borderRadius: w(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: w(96),
  },
  badgeText: {
    fontSize: f(11),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    letterSpacing: 0.4,
  },

  state: { alignItems: 'center', paddingVertical: h(40), gap: h(10) },
  stateText: { color: colors.light.secondaryText, fontSize: f(14) },
  errorIcon: {
    width: w(52),
    height: w(52),
    borderRadius: w(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  errorText: { color: colors.status.danger, fontSize: f(14), textAlign: 'center' },
  retry: {
    marginTop: h(6),
    paddingHorizontal: w(20),
    height: h(44),
    borderRadius: w(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: colors.white, fontSize: f(15), fontWeight: '700' },

  emptyCard: {
    alignItems: 'center',
    padding: w(24),
    borderRadius: w(12),
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.white,
  },
  emptyIcon: {
    width: w(56),
    height: w(56),
    borderRadius: w(28),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: f(16),
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    marginTop: h(12),
  },
  emptyText: {
    color: colors.light.secondaryText,
    fontSize: f(13),
    textAlign: 'center',
    marginTop: h(4),
  },
});

export default AgencyPayrollScreen;


