import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import type { MainStackParamList } from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import AgencyBottomNavigation, {
  AgencyNavTab,
} from '../components/AgencyBottomNavigation';
import AgencyProfileMenu from '../components/AgencyProfileMenu';
import AgencyTopNavigation from '../components/AgencyTopNavigation';
import {
  agencyApiService,
  type AgencySite,
} from '../../../services/agencyApiService';
import ScalePressable from '../../../components/common/ScalePressable';
import EditSiteModal from '../components/EditSiteModal';
import AgencyCoverageRequests from '../components/AgencyCoverageRequests';
import PlanLimitNotice from '../components/PlanLimitNotice';
import { usePlanUsage } from '../hooks/usePlanUsage';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencySites'>;
const AgencySitesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [siteItems, setSiteItems] = useState<AgencySite[]>([]);
  const [selectedSite, setSelectedSite] = useState<AgencySite | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [section, setSection] = useState<'sites' | 'requests'>(
    route.params?.openRequestId ? 'requests' : 'sites',
  );
  const {
    planName,
    siteLimit,
    sitesAtLimit,
    refresh: refreshPlanUsage,
  } = usePlanUsage();
  const loadSites = useCallback(async () => {
    try {
      setLoadError('');
      setSiteItems(await agencyApiService.getSites());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t('dashboard.unableToLoadSites'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Blocks the form before it opens once the plan's site allowance is used up
  // and points the agency admin at the Plan screen to upgrade.
  const requestAddSite = useCallback(() => {
    if (sitesAtLimit) {
      Alert.alert(
        t('dashboard.planLimitTitle'),
        t('dashboard.siteLimitMessage', {
          plan: planName || t('dashboard.plan'),
          limit: siteLimit,
        }),
        [
          { text: t('dashboard.notNow'), style: 'cancel' },
          {
            text: t('dashboard.upgradePlan'),
            onPress: () => navigation.navigate('AgencyPlan'),
          },
        ],
      );
      return;
    }
    navigation.navigate('AddSiteScreen');
  }, [sitesAtLimit, siteLimit, planName, navigation, t]);

  const handleSitesChanged = useCallback(() => {
    loadSites();
    refreshPlanUsage();
  }, [loadSites, refreshPlanUsage]);
  useEffect(() => {
    if (route.params?.openRequestId) setSection('requests');
  }, [route.params?.openRequestId]);
  const clearRequestedId = useCallback(() => {
    navigation.setParams({ openRequestId: undefined });
  }, [navigation]);
  const visibleSites = useMemo(
    () =>
      siteItems.filter(site =>
        `${site.site_name} ${site.site_address ?? ''} ${site.city ?? ''} ${
          site.state ?? ''
        }`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, siteItems],
  );
  const navigate = (tab: AgencyNavTab) => {
    if (tab === 'sites') setSection('sites');
    if (tab === 'overview') navigation.navigate('AgencyOverview');
    if (tab === 'guards') navigation.navigate('AgencyGuards');
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
        onNotificationSelect={notification => {
          if (
            notification.reference_type === 'coverage_request' &&
            notification.reference_id
          ) {
            setSection('requests');
            navigation.setParams({ openRequestId: notification.reference_id });
          }
        }}
      />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.sectionTabs}>
          <ScalePressable
            style={[s.sectionTab, section === 'sites' && s.sectionTabActive]}
            onPress={() => setSection('sites')}
          >
            <Text
              pointerEvents="none"
              style={[
                s.sectionTabText,
                section === 'sites' && s.sectionTabTextActive,
              ]}
            >
              {t('dashboard.sites')}
            </Text>
          </ScalePressable>
          <ScalePressable
            style={[s.sectionTab, section === 'requests' && s.sectionTabActive]}
            onPress={() => setSection('requests')}
          >
            <Text
              pointerEvents="none"
              style={[
                s.sectionTabText,
                section === 'requests' && s.sectionTabTextActive,
              ]}
            >
              {t('coverageManagement.requests')}
            </Text>
          </ScalePressable>
        </View>
        {section === 'sites' ? (
          <>
            <ScalePressable
              style={s.addButton}
              onPress={requestAddSite}
              accessibilityRole="button"
            >
              <Text style={s.addText}>{t('dashboard.addSite')}</Text>
            </ScalePressable>
            {sitesAtLimit ? (
              <PlanLimitNotice
                title={t('dashboard.planLimitTitle')}
                message={t('dashboard.siteLimitMessage', {
                  plan: planName || t('dashboard.plan'),
                  limit: siteLimit,
                })}
                actionLabel={t('dashboard.upgradePlan')}
                onUpgrade={() => navigation.navigate('AgencyPlan')}
              />
            ) : null}
            <View style={s.searchRow}>
              <View style={s.search}>
                <Feather name="search" size={f(23)} color="#A3A3A3" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('dashboard.searchSites')}
                  placeholderTextColor="#A3A3A3"
                  style={s.input}
                />
              </View>
              <TouchableOpacity
                style={s.filter}
                accessibilityLabel={t('dashboard.filter')}
              >
                <Feather name="filter" size={f(24)} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={s.list}>
              {loading ? (
                <Text style={s.message}>{t('dashboard.loadingSites')}</Text>
              ) : loadError ? (
                <Text style={s.error}>{loadError}</Text>
              ) : visibleSites.length ? (
                visibleSites.map(site => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    onPress={() => setSelectedSite(site)}
                  />
                ))
              ) : (
                <Text style={s.message}>{t('dashboard.noSites')}</Text>
              )}
            </View>
          </>
        ) : (
          <AgencyCoverageRequests
            requestedId={route.params?.openRequestId}
            onRequestedIdHandled={clearRequestedId}
            onRequestUpdated={handleSitesChanged}
          />
        )}
      </ScrollView>
      <AgencyBottomNavigation activeTab="sites" onTabPress={navigate} />
      {profileMenuOpen ? (
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
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
      <EditSiteModal
        visible={selectedSite !== null}
        site={selectedSite}
        onClose={() => setSelectedSite(null)}
        onChanged={() => {
          setSelectedSite(null);
          loadSites();
        }}
      />
    </SafeAreaView>
  );
};

const SiteCard: React.FC<{ site: AgencySite; onPress: () => void }> = ({
  site,
  onPress,
}) => {
  const { t } = useTranslation();
  const address =
    [site.site_address, site.city, site.state].filter(Boolean).join(', ') ||
    t('dashboard.addressNotProvided');
  const plan =
    site.coverage_plan === 'day_shift'
      ? t('dashboard.dayShift')
      : site.coverage_plan === 'night_watch'
      ? t('dashboard.nightWatch')
      : site.coverage_plan === '24x7'
      ? t('dashboard.coverage24x7')
      : t('dashboard.notSet');
  const time =
    site.start_time && site.end_time
      ? `${site.start_time} - ${site.end_time}`
      : t('dashboard.notScheduled');
  return (
    <ScalePressable
      style={s.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={site.site_name}
    >
      <View style={s.cardTop}>
        <Text style={s.name}>{site.site_name}</Text>
        <Feather name="chevron-right" size={f(25)} color="#999" />
      </View>
      <View style={s.addressRow}>
        <Feather name="map-pin" size={f(20)} color="#A0A0A0" />
        <Text style={s.address}>{address}</Text>
      </View>
      <View style={s.details}>
        <Text style={s.detail}>{t('dashboard.guardDataUnavailable')}</Text>
        <Text style={s.detail}>{plan}</Text>
      </View>
      <View style={s.timeRow}>
        <Feather name="clock" size={f(19)} color="#FFB800" />
        <Text style={s.time}>{time}</Text>
      </View>
    </ScalePressable>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  content: { padding: w(14), paddingBottom: h(22) },
  sectionTabs: {
    flexDirection: 'row',
    gap: w(10),
    marginTop: h(18),
    marginBottom: h(16),
  },
  sectionTab: {
    flex: 1,
    height: h(44),
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTabActive: { backgroundColor: colors.primary },
  sectionTabText: { color: colors.primary, fontSize: f(15), fontWeight: '600' },
  sectionTabTextActive: { color: colors.white },
  addButton: {
    height: h(36),
    backgroundColor: colors.primary,
    borderRadius: w(6),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: h(15),
  },
  addText: { color: colors.white, fontSize: f(16), fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: w(10), marginBottom: h(19) },
  search: {
    height: h(46),
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: w(8),
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: w(14),
  },
  input: {
    flex: 1,
    fontSize: f(18),
    color: colors.primary,
    marginLeft: w(9),
    height: '100%',
  },
  filter: {
    width: w(44),
    height: h(46),
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: h(17) },
  message: {
    color: '#707070',
    fontSize: f(15),
    textAlign: 'center',
    marginTop: h(24),
  },
  error: {
    color: '#E53935',
    fontSize: f(14),
    textAlign: 'center',
    marginTop: h(24),
  },
  card: {
    minHeight: h(140),
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(8),
    padding: w(14),
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: f(18), fontWeight: '700', color: colors.primary, flex: 1 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: h(10),
  },
  address: {
    flex: 1,
    color: '#707070',
    fontSize: f(15),
    lineHeight: f(18),
    marginLeft: w(5),
  },
  details: { flexDirection: 'row', marginTop: h(10) },
  detail: { width: '50%', color: '#707070', fontSize: f(12) },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: h(8) },
  time: {
    color: '#FFB800',
    fontSize: f(15),
    fontWeight: '500',
    marginLeft: w(5),
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});
export default AgencySitesScreen;
