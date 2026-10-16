import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../../styles/colors';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import AgencyBottomNavigation from '../components/AgencyBottomNavigation';
import AgencyProfileMenu from '../components/AgencyProfileMenu';
import AgencyTopNavigation from '../components/AgencyTopNavigation';
import type { MainStackParamList } from '../../../navigation/types';
import ScalePressable from '../../../components/common/ScalePressable';
import GuardsOnDutyModal from '../components/GuardsOnDutyModal';
import ActiveSitesModal from '../components/ActiveSitesModal';
import {
  agencyApiService,
  type AgencyGuard,
  type AgencyIncident,
  type AgencyRatingSummary,
  type AgencySite,
} from '../../../services/agencyApiService';
import {
  takeSlot,
  awaitBootPrefetch,
} from '../../../services/bootPrefetch';
import {
  payrollService,
  formatINR,
  type PayrollSummary,
} from '../../../services/payrollService';
import {
  invoiceService,
  type AgencyInvoice,
} from '../../../services/invoiceService';

/** First day of the current month — the period payroll's overview expects. */
const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

type AgencyResults = [
  PromiseSettledResult<AgencySite[]>,
  PromiseSettledResult<AgencyGuard[]>,
  PromiseSettledResult<AgencyIncident[]>,
  PromiseSettledResult<{ summary: PayrollSummary; period: string }>,
  PromiseSettledResult<AgencyInvoice[]>,
  PromiseSettledResult<AgencyRatingSummary>,
];

const ok = <T,>(value: T): PromiseFulfilledResult<T> => ({
  status: 'fulfilled',
  value,
});

const monthLabel = (period: string, locale: string): string => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString(
    `${locale}-IN`,
    { month: 'long', year: 'numeric' },
  );
};

const todayLabel = (locale: string): string =>
  new Date().toLocaleDateString(`${locale}-IN`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Placeholder shown while a stat is loading or its request failed. */
const DASH = '—';

/**
 * An incident counts as open until the agency resolves it. Backend statuses
 * are open/pending/in_progress/resolved ('closed' is kept for legacy rows);
 * the old check tested against 'closed', which never occurs, so resolved
 * incidents kept being counted as open.
 */
const isOpenIncident = (item: AgencyIncident): boolean =>
  !['resolved', 'closed'].includes(item.status ?? 'open');

const Icon = ({
  name,
  color,
  size = 23,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  color: string;
  size?: number;
}) => <Feather name={name} size={f(size)} color={color} />;
const Chevron = () => <Icon name="chevron-right" color="#696969" />;

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyOverview'>;

const AgencyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [guardsOnDutyOpen, setGuardsOnDutyOpen] = useState(false);
  const [activeSitesOpen, setActiveSitesOpen] = useState(false);
  const [sites, setSites] = useState<AgencySite[]>([]);
  const [guards, setGuards] = useState<AgencyGuard[]>([]);
  const [incidents, setIncidents] = useState<AgencyIncident[]>([]);
  // Insight data. Null means "not loaded or request failed" — never rendered
  // as a zero, so a failed request can't masquerade as an empty result.
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
  const [payrollPeriod, setPayrollPeriod] = useState(currentPeriod());
  const [invoices, setInvoices] = useState<AgencyInvoice[] | null>(null);
  const [ratings, setRatings] = useState<AgencyRatingSummary | null>(null);
  // Booted gates the first paint: the loading state shows until the first
  // response arrives, then later focus refreshes update in place.
  const [booted, setBooted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const period = currentPeriod();
    // First mount joins this session's boot prefetch flight: await the
    // shared promise (already settled in the normal case), then take the
    // slots as settled results. Refreshes rerun the live fetch directly.
    let results: AgencyResults;
    const cached: [
      AgencySite[] | undefined,
      AgencyGuard[] | undefined,
      AgencyIncident[] | undefined,
      { summary: PayrollSummary; period: string } | undefined,
      AgencyInvoice[] | undefined,
      AgencyRatingSummary | undefined,
    ] = [
      takeSlot<AgencySite[]>('sites'),
      takeSlot<AgencyGuard[]>('guards'),
      takeSlot<AgencyIncident[]>('incidents'),
      takeSlot<{ summary: PayrollSummary; period: string }>('payroll'),
      takeSlot<AgencyInvoice[]>('invoices'),
      takeSlot<AgencyRatingSummary>('ratings'),
    ];
    const [cSites, cGuards, cIncidents, cPayroll, cInvoices, cRatings] = cached;
    if (
      cSites !== undefined &&
      cGuards !== undefined &&
      cIncidents !== undefined &&
      cPayroll !== undefined &&
      cInvoices !== undefined &&
      cRatings !== undefined
    ) {
      results = [
        ok(cSites),
        ok(cGuards),
        ok(cIncidents),
        ok(cPayroll),
        ok(cInvoices),
        ok(cRatings),
      ];
    } else {
      try {
        await awaitBootPrefetch();
      } catch {
        // Fall through to the live fetch below.
      }
      const recheck: [
        AgencySite[] | undefined,
        AgencyGuard[] | undefined,
        AgencyIncident[] | undefined,
        { summary: PayrollSummary; period: string } | undefined,
        AgencyInvoice[] | undefined,
        AgencyRatingSummary | undefined,
      ] = [
        takeSlot<AgencySite[]>('sites'),
        takeSlot<AgencyGuard[]>('guards'),
        takeSlot<AgencyIncident[]>('incidents'),
        takeSlot<{ summary: PayrollSummary; period: string }>('payroll'),
        takeSlot<AgencyInvoice[]>('invoices'),
        takeSlot<AgencyRatingSummary>('ratings'),
      ];
      const [rSites, rGuards, rIncidents, rPayroll, rInvoices, rRatings] =
        recheck;
      if (
        rSites !== undefined &&
        rGuards !== undefined &&
        rIncidents !== undefined &&
        rPayroll !== undefined &&
        rInvoices !== undefined &&
        rRatings !== undefined
      ) {
        results = [
          ok(rSites),
          ok(rGuards),
          ok(rIncidents),
          ok(rPayroll),
          ok(rInvoices),
          ok(rRatings),
        ];
      } else {
        results = await Promise.allSettled([
          agencyApiService.getSites(),
          agencyApiService.getGuards(),
          agencyApiService.getIncidents(),
          payrollService.getOverview(period),
          invoiceService.getAgencyInvoices(),
          agencyApiService.getRatings(),
        ]);
      }
    }
    // Ignore an obsolete response when a newer request has already started
    // (fast focus switches, retry while a request is in flight).
    if (requestIdRef.current !== requestId) return;
    const [
      sitesResult,
      guardsResult,
      incidentsResult,
      payrollResult,
      invoicesResult,
      ratingsResult,
    ] = results;
    let failed = false;
    if (sitesResult.status === 'fulfilled') {
      setSites(sitesResult.value);
    } else {
      failed = true;
    }
    if (guardsResult.status === 'fulfilled') {
      setGuards(guardsResult.value);
    } else {
      failed = true;
    }
    if (incidentsResult.status === 'fulfilled') {
      setIncidents(incidentsResult.value);
    } else {
      failed = true;
    }
    if (payrollResult.status === 'fulfilled') {
      setPayroll(payrollResult.value.summary);
      setPayrollPeriod(payrollResult.value.period);
    } else {
      failed = true;
    }
    if (invoicesResult.status === 'fulfilled') {
      setInvoices(invoicesResult.value);
    } else {
      failed = true;
    }
    if (ratingsResult.status === 'fulfilled') {
      setRatings(ratingsResult.value);
    } else {
      failed = true;
    }
    // Partial data still renders; the banner flags exactly what happened
    // instead of silently showing zeros.
    setLoadError(failed ? t('dashboard.summaryLoadError') : '');
    setBooted(true);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const summary = [
    [
      'users',
      String(guards.filter(item => item.status === 'on_duty').length),
      'guardsOnDuty',
      '#0EAE5A',
      '#E2F5E9',
    ],
    ['grid', String(sites.length), 'activeSites', '#F5A400', '#FFF1D9'],
    [
      'alert-circle',
      String(incidents.filter(isOpenIncident).length),
      'openIncidents',
      '#EF4444',
      '#FDE4E4',
    ],
    [
      'user',
      String(guards.filter(item => !item.site_id).length),
      'unassignedGuards',
      '#2563EB',
      '#E8EEFF',
    ],
  ] as const;

  const invoiceTotal = (invoices ?? []).reduce(
    (sum, invoice) => sum + invoice.amount,
    0,
  );
  const invoiceUnpaid = (invoices ?? []).filter(
    invoice => invoice.status !== 'paid',
  ).length;
  const reviewCount = ratings?.rating_count ?? 0;
  const reviewAverage =
    ratings && ratings.average_rating != null
      ? Number(ratings.average_rating)
      : NaN;
  const hasReviews =
    reviewCount > 0 && Number.isFinite(reviewAverage) && reviewAverage > 0;
  const reviewValue = hasReviews
    ? `${'★'.repeat(Math.round(reviewAverage))}${'☆'.repeat(
        5 - Math.round(reviewAverage),
      )} ${reviewAverage.toFixed(1)} (${reviewCount})`
    : DASH;
  const reviewCaption = !ratings
    ? t('dashboard.notAvailable')
    : !hasReviews
    ? t('dashboard.noReviewsYet')
    : t('dashboard.insightReviewsCaption', { count: reviewCount });
  return (
    // edges: top keeps the header clear of the notch/status bar; bottom keeps
    // the tab bar clear of the home indicator on notched devices.
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <AgencyTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        onNotificationSelect={notification => {
          if (
            notification.reference_type === 'coverage_request' &&
            notification.reference_id
          ) {
            navigation.navigate('AgencySites', {
              openRequestId: notification.reference_id,
            });
          }
        }}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {!booted ? (
          <View style={s.stateBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.stateText}>{t('dashboard.loadingDashboard')}</Text>
          </View>
        ) : (
          <>
            {loadError ? (
              <View style={s.errorBanner}>
                <Feather
                  name="alert-circle"
                  size={f(18)}
                  color={colors.status.danger}
                />
                <Text style={s.errorText}>{loadError}</Text>
                <ScalePressable
                  style={s.retryButton}
                  onPress={load}
                  accessibilityRole="button"
                >
                  <Text style={s.retryText}>{t('dashboard.retry')}</Text>
                </ScalePressable>
              </View>
            ) : null}
            <View style={s.titleRow}>
              <Text style={s.section}>{t('dashboard.quickSummary')}</Text>
              <View style={s.date}>
                <Text style={s.dateText}>
                  {t('dashboard.today')}, {todayLabel(i18n.language)}
                </Text>
                <Icon name="calendar" color="#666" size={24} />
              </View>
            </View>

            <View style={s.grid}>
              {summary.map(([icon, value, label, color, tint]) => (
                <TouchableOpacity
                  key={label}
                  style={s.card}
                  onPress={
                    label === 'guardsOnDuty'
                      ? () => setGuardsOnDutyOpen(true)
                      : label === 'activeSites'
                      ? () => setActiveSitesOpen(true)
                      : label === 'openIncidents'
                      ? () => navigation.navigate('AgencyIncidents')
                      : undefined
                  }
                  activeOpacity={
                    label === 'guardsOnDuty' ||
                    label === 'activeSites' ||
                    label === 'openIncidents'
                      ? 0.8
                      : 1
                  }
                >
                  <View style={[s.cardIcon, { backgroundColor: tint }]}>
                    <Icon name={icon} color={color} size={27} />
                  </View>
                  <View style={s.cardCopy}>
                    <Text style={[s.number, { color }]}>{value}</Text>
                    <Text style={s.cardLabel}>{t(`dashboard.${label}`)}</Text>
                    <Text style={s.details}>{t('dashboard.viewDetails')} ›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.insights}>
              <Insight
                icon="credit-card"
                title={t('dashboard.payrollSummary')}
                value={payroll ? formatINR(payroll.total) : DASH}
                caption={
                  payroll
                    ? t('dashboard.insightPayrollCaption', {
                        month: monthLabel(payrollPeriod, i18n.language),
                        pending: payroll.pending,
                      })
                    : t('dashboard.notAvailable')
                }
                color="#33C977"
                tint="#E2F5E9"
                onPress={() => navigation.navigate('AgencyPayroll')}
              />
              <Insight
                icon="file-text"
                title={t('dashboard.invoices')}
                value={invoices ? formatINR(invoiceTotal) : DASH}
                caption={
                  invoices
                    ? t('dashboard.insightInvoicesCaption', {
                        pending: invoiceUnpaid,
                        total: invoices.length,
                      })
                    : t('dashboard.notAvailable')
                }
                color="#5A8DFF"
                tint="#EEF3FF"
                onPress={() => navigation.navigate('AgencyInvoices')}
              />
              <Insight
                icon="star"
                title={t('dashboard.clientReviews')}
                value={reviewValue}
                caption={reviewCaption}
                color="#A57AFF"
                tint="#F2EDFF"
                stars
              />
            </View>

            <Text style={s.section}>{t('dashboard.quickActions')}</Text>
            <View style={s.actions}>
              <Action
                icon="user-plus"
                text={t('dashboard.addGuard')}
                color="#0EAA55"
                onPress={() =>
                  navigation.navigate('AddGuardScreen')
                }
              />
              <Action
                icon="grid"
                text={t('dashboard.addSite')}
                color="#F39A00"
                onPress={() =>
                  navigation.navigate('AddSiteScreen')
                }
              />
              <Action
                icon="alert-triangle"
                text={t('dashboard.incident')}
                color="#F22121"
                onPress={() =>
                  navigation.navigate('AgencyIncidents', { openFileIncident: true })
                }
              />
            </View>

            <Text style={[s.section, s.liveSection]}>{t('dashboard.liveStatus')}</Text>

            <View style={s.list}>
              {sites.map(site => (
                <Live
                  key={site.id}
                  title={site.site_name}
                  assigned
                  total={guards.filter(guard => guard.site_id === site.id).length}
                  onDuty={
                    guards.filter(
                      guard =>
                        guard.site_id === site.id && guard.status === 'on_duty',
                    ).length
                  }
                  onPress={() =>
                    navigation.navigate('AgencyEventDetails', { siteId: site.id })
                  }
                />
              ))}
              {guards.some(guard => !guard.site_id) ? (
                <Live
                  title={t('dashboard.unassigned')}
                  assigned={false}
                  total={guards.filter(guard => !guard.site_id).length}
                  onDuty={0}
                  onPress={() =>
                    navigation.navigate('AgencyEventDetails', { siteId: 0 })
                  }
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <AgencyBottomNavigation
        activeTab="overview"
        onTabPress={tab => {
          if (tab === 'guards') navigation.navigate('AgencyGuards');
          if (tab === 'incidents') navigation.navigate('AgencyIncidents');
          if (tab === 'sites') navigation.navigate('AgencySites');
          if (tab === 'profile') navigation.navigate('AgencyProfile');
          if (tab === 'plan') navigation.navigate('AgencyPlan');
        }}
      />
      {profileMenuOpen ? (
        <Pressable
          style={s.menuBackdrop}
          onPress={() => setProfileMenuOpen(false)}
        />
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
      <GuardsOnDutyModal
        visible={guardsOnDutyOpen}
        onClose={() => setGuardsOnDutyOpen(false)}
      />
      <ActiveSitesModal
        visible={activeSitesOpen}
        onClose={() => setActiveSitesOpen(false)}
      />
    </SafeAreaView>
  );
};

const Insight = ({
  icon,
  title,
  value,
  caption,
  color,
  tint,
  stars,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  value: string;
  caption: string;
  color: string;
  tint: string;
  stars?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={s.insight}
    onPress={onPress}
    activeOpacity={onPress ? 0.8 : 1}
    accessibilityRole={onPress ? 'button' : undefined}
  >
    <View style={[s.insightIcon, { backgroundColor: tint }]}>
      <Icon name={icon} color={color} />
    </View>
    <View style={s.insightCopy}>
      <Text style={s.insightTitle}>{title}</Text>
      <Text style={[s.insightValue, stars && s.stars]}>{value}</Text>
      <Text style={s.caption}>{caption}</Text>
    </View>
    <Chevron />
  </TouchableOpacity>
);
const Action = ({
  icon,
  text,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
  color: string;
  onPress?: () => void;
}) => (
  <ScalePressable
    style={[s.action, { borderColor: color }]}
    onPress={onPress}
    accessibilityRole="button"
  >
    <Icon name={icon} color={color} size={20} />
    <Text style={[s.actionText, { color }]}>{text}</Text>
  </ScalePressable>
);
const Live = ({
  title,
  assigned,
  total,
  onDuty,
  onPress,
}: {
  title: string;
  assigned: boolean;
  total: number;
  onDuty: number;
  onPress: () => void;
}) => (
  <LiveContent
    title={title}
    assigned={assigned}
    total={total}
    onDuty={onDuty}
    onPress={onPress}
  />
);
const LiveContent = ({
  title,
  assigned,
  total,
  onDuty,
  onPress,
}: {
  title: string;
  assigned: boolean;
  total: number;
  onDuty: number;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <ScalePressable style={s.live} onPress={onPress} accessibilityRole="button">
      <View
        style={[
          s.liveIcon,
          assigned ? s.liveIconAssigned : s.liveIconUnassigned,
        ]}
      >
        <Icon
          name={assigned ? 'grid' : 'user'}
          color={assigned ? '#16A34A' : '#F26E6E'}
          size={22}
        />
      </View>
      <View style={s.liveCopy}>
        <Text style={s.liveTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[s.liveCaption, assigned ? s.liveAssigned : s.liveUnassigned]}
        >
          {`${onDuty}/${total} ${t('dashboard.onDuty')}`}
        </Text>
      </View>
      <Chevron />
    </ScalePressable>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  menuBackdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
  header: {
    height: h(64),
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: w(14),
    backgroundColor: colors.white,
    zIndex: 30,
    elevation: 0,
  },
  logo: { width: w(180), height: h(180) },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: w(10) },
  profileTrigger: { flexDirection: 'row', alignItems: 'center', gap: w(10) },
  bellWrapper: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: -w(5),
    top: -h(5),
    width: w(13),
    height: w(13),
    borderRadius: w(7),
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: f(8), fontWeight: '700' },
  avatarWrapper: { position: 'relative', marginRight: w(11) },
  avatar: {
    width: w(33),
    height: w(33),
    borderRadius: w(17),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: f(13) },
  online: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: w(10),
    height: w(10),
    borderRadius: w(5),
    backgroundColor: '#19B563',
    borderWidth: 1,
    borderColor: colors.white,
  },
  scroll: { flex: 1 },
  content: { padding: w(11), paddingBottom: h(14) },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(60),
    gap: h(12),
  },
  stateText: { color: '#707070', fontSize: f(15) },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
    borderWidth: 1,
    borderColor: '#F5C2C2',
    backgroundColor: '#FDE4E4',
    borderRadius: w(8),
    paddingHorizontal: w(10),
    paddingVertical: h(10),
    marginBottom: h(12),
  },
  errorText: { flex: 1, color: colors.status.danger, fontSize: f(13) },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: w(6),
    paddingHorizontal: w(12),
    paddingVertical: h(6),
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: f(13) },
  titleRow: {
    height: h(54),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: { color: colors.primary, fontWeight: '700', fontSize: f(17) },
  date: { flexDirection: 'row', alignItems: 'center', gap: w(6) },
  dateText: { color: '#747474', fontSize: f(16) },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: w(16),
  },
  card: {
    width: w(181),
    height: h(100),
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(8),
    padding: w(12),
    flexDirection: 'row',
  },
  cardIcon: {
    width: w(50),
    height: w(50),
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { marginLeft: w(12), flex: 1 },
  number: { fontSize: f(31), lineHeight: f(32), fontWeight: '500' },
  cardLabel: { color: colors.primary, fontSize: f(13), fontWeight: '500' },
  details: { color: '#707070', fontSize: f(10), marginTop: h(4) },
  insights: { gap: h(15), marginTop: h(27), marginBottom: h(23) },
  insight: {
    height: h(71),
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(8),
    paddingHorizontal: w(11),
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightIcon: {
    width: w(42),
    height: w(42),
    borderRadius: w(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: { flex: 1, marginLeft: w(13) },
  insightTitle: {
    fontSize: f(12),
    lineHeight: f(15),
    color: '#6C6C6C',
    fontWeight: '500',
  },
  insightValue: {
    fontSize: f(17),
    lineHeight: f(21),
    color: colors.primary,
    fontWeight: '700',
  },
  stars: { color: colors.primary },
  caption: { fontSize: f(10), lineHeight: f(13), color: '#686868' },
  actions: {
    flexDirection: 'row',
    gap: w(10),
    marginTop: h(12),
    marginBottom: h(27),
  },
  action: {
    height: h(36),
    borderRadius: w(7),
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: w(6),
  },
  actionText: { fontWeight: '700', fontSize: f(15) },
  liveSection: { marginTop: h(22), marginBottom: h(12) },
  list: {
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(8),
    overflow: 'hidden',
  },
  live: {
    height: h(65),
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: w(11),
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIcon: {
    width: w(40),
    height: w(40),
    borderRadius: w(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveIconAssigned: { backgroundColor: '#E2F5E9' },
  liveIconUnassigned: { backgroundColor: '#FDE4E4' },
  liveCopy: { flex: 1, marginLeft: w(13) },
  liveTitle: { fontSize: f(16), fontWeight: '700', color: colors.primary },
  liveCaption: { fontSize: f(10), marginTop: 2 },
  liveAssigned: { color: '#16A34A' },
  liveUnassigned: { color: '#EF4444' },
});

export default AgencyOverviewScreen;
