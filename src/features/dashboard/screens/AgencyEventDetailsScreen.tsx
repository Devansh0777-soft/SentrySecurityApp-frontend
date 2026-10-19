import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import type { MainStackParamList } from '../../../navigation/types';
import {
  agencyApiService,
  type AgencyGuard,
  type AgencySite,
} from '../../../services/agencyApiService';
import { colors } from '../../../styles/colors';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import AgencyBottomNavigation, {
  type AgencyNavTab,
} from '../components/AgencyBottomNavigation';
import AgencyProfileMenu from '../components/AgencyProfileMenu';
import AgencyTopNavigation from '../components/AgencyTopNavigation';
import ScalePressable from '../../../components/common/ScalePressable';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyEventDetails'>;

const coverageName = (plan: AgencySite['coverage_plan'], t: (k: string) => string) => {
  if (plan === 'day_shift') return t('event.coverageDayShift');
  if (plan === 'night_watch') return t('event.coverageNightWatch');
  return t('event.coverageFull');
};

const AgencyEventDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { siteId } = route.params;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [site, setSite] = useState<AgencySite | null>(null);
  const [guards, setGuards] = useState<AgencyGuard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [missing, setMissing] = useState(false);
  const [guardNotice, setGuardNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setMissing(false);
    try {
      if (siteId === 0) {
        setSite(null);
        setGuards(
          (await agencyApiService.getGuards()).filter(g => !g.site_id),
        );
        return;
      }
      const [siteItem, guardItems] = await Promise.all([
        agencyApiService.getSite(siteId),
        agencyApiService.getGuards(),
      ]);
      if (!siteItem) {
        setMissing(true);
        return;
      }
      setSite(siteItem);
      setGuards(guardItems.filter(g => g.site_id === siteItem.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t('event.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [siteId, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const navigate = (tab: AgencyNavTab) => {
    if (tab === 'overview') navigation.navigate('AgencyOverview');
    if (tab === 'guards') navigation.navigate('AgencyGuards');
    if (tab === 'sites') navigation.navigate('AgencySites');
    if (tab === 'incidents') navigation.navigate('AgencyIncidents');
    if (tab === 'profile') navigation.navigate('AgencyProfile');
    if (tab === 'plan') navigation.navigate('AgencyPlan');
  };

  const openGuard = (guard: AgencyGuard) => {
    setGuardNotice('');
    navigation.navigate('AgencyGuardDetails', { guardId: guard.id });
  };

  const onDuty = guards.filter(g => g.status === 'on_duty').length;
  const active = onDuty > 0;

  const renderBody = () => {
    if (loading) {
      return (
        <View style={s.state}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.stateText}>{t('event.loading')}</Text>
        </View>
      );
    }
    if (missing) {
      return (
        <View style={s.state}>
          <View style={s.errorIcon}>
            <Feather name="alert-circle" size={f(28)} color={colors.status.danger} />
          </View>
          <Text style={s.errorText}>{t('event.notFound')}</Text>
          <Text style={s.hintText}>{t('event.notFoundHint')}</Text>
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={s.state}>
          <View style={s.errorIcon}>
            <Feather name="alert-circle" size={f(28)} color={colors.status.danger} />
          </View>
          <Text style={s.errorText}>{loadError}</Text>
          <ScalePressable style={s.retry} onPress={load} accessibilityRole="button">
            <Text style={s.retryText}>{t('event.retry')}</Text>
          </ScalePressable>
        </View>
      );
    }
    return (
      <>
        <View style={s.card}>
          <Text style={s.cardHeading}>{t('event.eventInfo')}</Text>
          <View style={s.statusRow}>
            <View style={[s.dot, active ? s.dotOn : s.dotOff]} />
            <Text style={[s.statusText, active ? s.statusOn : s.statusOff]}>
              {active ? t('event.statusActive') : t('event.statusInactive')}
            </Text>
          </View>
          <InfoRow label={t('event.siteName')} value={site?.site_name ?? t('dashboard.unassigned')} />
          {site?.site_address ? <InfoRow label={t('event.siteAddress')} value={site.site_address} /> : null}
          {site?.coverage_plan ? <InfoRow label={t('event.coveragePlan')} value={coverageName(site.coverage_plan, t)} /> : null}
          <InfoRow label={t('event.guardsOnDuty')} value={String(onDuty)} />
          <InfoRow label={t('event.totalGuards')} value={String(guards.length)} />
        </View>
        <Text style={s.section}>{t('event.assignedGuards')}</Text>
        <Text style={s.hint}>{t('event.tapGuard')}</Text>
        {guardNotice ? <Text style={s.notice}>{guardNotice}</Text> : null}
        {guards.length ? (
          <View style={s.list}>
            {guards.map(guard => (
              <ScalePressable
                key={guard.id}
                style={s.guardRow}
                onPress={() => openGuard(guard)}
                accessibilityRole="button"
                accessibilityLabel={t('event.viewGuardDetails')}
              >
                <View style={s.avatar}>
                  <Feather name="user" size={f(24)} color={colors.primary} />
                </View>
                <View style={s.guardCopy}>
                  <Text style={s.guardName} numberOfLines={1}>{guard.full_name}</Text>
                  <Text style={s.guardCode} numberOfLines={1}>{guard.guard_code}</Text>
                  <Text style={[s.guardStatus, guard.status === 'on_duty' ? s.dutyOn : s.dutyOff]}>
                    {guard.status === 'on_duty' ? t('event.onDuty') : t('event.offDuty')}
                  </Text>
                </View>
                <Feather name="chevron-right" size={f(23)} color="#696969" />
              </ScalePressable>
            ))}
          </View>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{t('event.noGuards')}</Text>
            <Text style={s.hintText}>{t('event.noGuardsHint')}</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AgencyTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title} numberOfLines={2}>
          {site?.site_name || t('event.title')}
        </Text>
        {renderBody()}
      </ScrollView>
      <AgencyBottomNavigation activeTab="overview" onTabPress={navigate} />
      {profileMenuOpen ? (
        <ScalePressable style={s.backdrop} onPress={() => setProfileMenuOpen(false)} accessibilityLabel={t('dashboard.close')}>
          <View />
        </ScalePressable>
      ) : null}
      {profileMenuOpen ? (
        <AgencyProfileMenu
          onMyProfile={() => { setProfileMenuOpen(false); navigation.navigate('AgencyProfile'); }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={s.infoRow}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: w(18), paddingTop: h(14), paddingBottom: h(28) },
  back: { flexDirection: 'row', alignItems: 'center', gap: w(4) },
  backText: { color: colors.primary, fontSize: f(15), fontWeight: '600' },
  title: { color: colors.primary, fontSize: f(26), fontWeight: '800', marginTop: h(8), marginBottom: h(16) },
  section: { color: colors.primary, fontSize: f(19), fontWeight: '800', marginTop: h(22) },
  hint: { color: '#667085', fontSize: f(14), marginTop: h(6), marginBottom: h(12) },
  notice: { color: colors.status.danger, fontSize: f(14), marginBottom: h(10) },
  card: { borderWidth: 1, borderColor: '#DCDCDC', borderRadius: w(12), padding: w(16) },
  cardHeading: { color: colors.primary, fontSize: f(14), fontWeight: '800', letterSpacing: 0.6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: h(12), gap: w(8) },
  dot: { width: w(10), height: w(10), borderRadius: w(5) },
  dotOn: { backgroundColor: colors.status.success },
  dotOff: { backgroundColor: '#9AA0A6' },
  statusText: { fontSize: f(15), fontWeight: '700' },
  statusOn: { color: colors.status.success },
  statusOff: { color: '#667085' },
  infoRow: { flexDirection: 'row', gap: w(12), paddingVertical: h(9), borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: h(4) },
  infoLabel: { color: '#667085', fontSize: f(14), flexShrink: 0 },
  infoValue: { color: colors.primary, fontSize: f(15), fontWeight: '600', textAlign: 'right', flex: 1 },
  list: { borderWidth: 1, borderColor: '#DCDCDC', borderRadius: w(12), overflow: 'hidden' },
  guardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: w(12), paddingVertical: h(12), borderBottomWidth: 1, borderBottomColor: '#EDEDED' },
  avatar: { width: w(48), height: w(48), borderRadius: w(24), backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginRight: w(12) },
  guardCopy: { flex: 1, minWidth: 0 },
  guardName: { color: colors.primary, fontSize: f(17), fontWeight: '700' },
  guardCode: { color: '#667085', fontSize: f(13), marginTop: 1 },
  guardStatus: { fontSize: f(12), fontWeight: '700', marginTop: 2 },
  dutyOn: { color: colors.status.success },
  dutyOff: { color: '#B42318' },
  state: { alignItems: 'center', paddingVertical: h(48), gap: h(12) },
  stateText: { color: '#667085', fontSize: f(15), textAlign: 'center' },
  errorIcon: { width: w(56), height: w(56), borderRadius: w(28), backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.status.danger, fontSize: f(16), fontWeight: '600', textAlign: 'center' },
  hintText: { color: '#667085', fontSize: f(14), textAlign: 'center' },
  retry: { marginTop: h(6), backgroundColor: colors.primary, borderRadius: w(10), paddingHorizontal: w(22), paddingVertical: h(11) },
  retryText: { color: colors.white, fontSize: f(15), fontWeight: '700' },
  empty: { borderWidth: 1, borderColor: '#DCDCDC', borderRadius: w(12), padding: w(20), alignItems: 'center', gap: h(6) },
  emptyTitle: { color: colors.primary, fontSize: f(16), fontWeight: '700', textAlign: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});

export default AgencyEventDetailsScreen;