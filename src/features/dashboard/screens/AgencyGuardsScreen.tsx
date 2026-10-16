import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import type { MainStackParamList } from '../../../navigation/types';
import {
  agencyApiService,
  type AgencyGuard,
} from '../../../services/agencyApiService';
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
import ScalePressable from '../../../components/common/ScalePressable';
import AddGuardModal from '../components/AddGuardModal';
import PlanLimitNotice from '../components/PlanLimitNotice';
import { usePlanUsage } from '../hooks/usePlanUsage';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyGuards'>;
type Filter = 'all' | 'on_duty' | 'off_duty';

const AgencyGuardsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const {
    planName,
    guardLimit,
    guardsAtLimit,
    refresh: refreshPlanUsage,
  } = usePlanUsage();

  // Blocks the form before it opens once the plan's guard allowance is used up
  // and points the agency admin at the Plan screen to upgrade.
  const requestAddGuard = useCallback(() => {
    if (guardsAtLimit) {
      Alert.alert(
        t('dashboard.planLimitTitle'),
        t('dashboard.guardLimitMessage', {
          plan: planName || t('dashboard.plan'),
          limit: guardLimit,
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
    navigation.navigate('AddGuardScreen');
  }, [guardsAtLimit, guardLimit, planName, navigation, t]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [guards, setGuards] = useState<AgencyGuard[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedGuard, setSelectedGuard] = useState<AgencyGuard | null>(null);

  const loadGuards = useCallback(async () => {
    try {
      setLoadError('');
      setGuards(await agencyApiService.getGuards());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t('dashboard.unableToLoadGuards'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    loadGuards();
  }, [loadGuards]);

  const visibleGuards = useMemo(
    () =>
      guards.filter(guard => {
        const matchesFilter = filter === 'all' || guard.status === filter;
        const text = `${guard.full_name} ${guard.guard_code} ${
          guard.site_name ?? ''
        }`.toLowerCase();
        return matchesFilter && text.includes(query.trim().toLowerCase());
      }),
    [guards, filter, query],
  );
  const count = (value: Filter) =>
    value === 'all'
      ? guards.length
      : guards.filter(guard => guard.status === value).length;
  const navigate = (tab: AgencyNavTab) => {
    if (tab === 'overview') navigation.navigate('AgencyOverview');
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
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScalePressable
          style={s.addButton}
          onPress={requestAddGuard}
          accessibilityRole="button"
        >
          <Text style={s.addText}>{t('dashboard.addGuard')}</Text>
        </ScalePressable>
        {guardsAtLimit ? (
          <PlanLimitNotice
            title={t('dashboard.planLimitTitle')}
            message={t('dashboard.guardLimitMessage', {
              plan: planName || t('dashboard.plan'),
              limit: guardLimit,
            })}
            actionLabel={t('dashboard.upgradePlan')}
            onUpgrade={() => navigation.navigate('AgencyPlan')}
          />
        ) : null}
        <View style={s.searchRow}>
          <View style={s.search}>
            <Feather name="search" size={f(22)} color="#A3A3A3" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('dashboard.searchGuards')}
              placeholderTextColor="#A3A3A3"
              style={s.searchInput}
            />
          </View>
          <ScalePressable
            style={s.filterButton}
            onPress={() => setFilter('all')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.filter')}
          >
            <Feather name="filter" size={f(23)} color={colors.primary} />
          </ScalePressable>
        </View>
        <View style={s.filters}>
          {(['all', 'on_duty', 'off_duty'] as const).map(item => (
            <ScalePressable
              key={item}
              style={[s.filter, filter === item && s.activeFilter]}
              onPress={() => setFilter(item)}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === item }}
            >
              <Text
                style={[s.filterText, filter === item && s.activeFilterText]}
              >
                {item === 'all'
                  ? `${t('dashboard.all')} (${count(item)})`
                  : item === 'on_duty'
                  ? `${t('dashboard.onDuty')} (${count(item)})`
                  : `${t('dashboard.offDuty')} (${count(item)})`}
              </Text>
            </ScalePressable>
          ))}
        </View>
        <View style={s.list}>
          {loading ? (
            <Text style={s.message}>{t('dashboard.loadingGuards')}</Text>
          ) : loadError ? (
            <Text style={s.error}>{loadError}</Text>
          ) : visibleGuards.length ? (
            visibleGuards.map(guard => (
              <GuardCard
                key={guard.id}
                guard={guard}
                onPress={() => setSelectedGuard(guard)}
              />
            ))
          ) : (
            <Text style={s.message}>{t('dashboard.noGuardsFound')}</Text>
          )}
        </View>
      </ScrollView>
      <AgencyBottomNavigation activeTab="guards" onTabPress={navigate} />
      <AddGuardModal
        visible={selectedGuard !== null}
        guard={selectedGuard}
        onClose={() => setSelectedGuard(null)}
        onCreated={() => {
          setSelectedGuard(null);
          setQuery('');
          setFilter('all');
          loadGuards();
        }}
      />
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
    </SafeAreaView>
  );
};

const GuardCard: React.FC<{ guard: AgencyGuard; onPress: () => void }> = ({
  guard,
  onPress,
}) => {
  const { t } = useTranslation();
  const initial = guard.full_name.trim().charAt(0).toUpperCase();
  const time =
    guard.start_time && guard.end_time
      ? `${guard.start_time} – ${guard.end_time}`
      : t('dashboard.notScheduled');
  const onCall = () => {
    if (guard.mobile_number) {
      Linking.openURL(`tel:${guard.mobile_number}`);
    }
  };
  return (
    <ScalePressable
      style={s.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={guard.full_name}
    >
      <View style={s.avatar}>
        <Text style={s.initial}>{initial}</Text>
      </View>
      <View style={s.cardCopy}>
        <View style={s.cardTop}>
          <Text style={s.name}>{guard.full_name}</Text>
          <Text
            style={[
              s.status,
              guard.status === 'on_duty' ? s.onDuty : s.offDuty,
            ]}
          >
            {guard.status === 'on_duty'
              ? t('dashboard.onDuty')
              : t('dashboard.offDuty')}
          </Text>
          <Feather name="chevron-right" size={f(22)} color="#9CA3AF" />
        </View>
        <View style={s.siteRow}>
          <Feather name="map-pin" size={f(18)} color="#A3A3A3" />
          <Text style={s.site}>
            {guard.site_name || t('dashboard.unassignedSite')}
          </Text>
        </View>
        <View style={s.bottomRow}>
          <Text style={s.code}>{guard.guard_code}</Text>
          <View style={s.shift}>
            <Feather name="clock" size={f(17)} color={colors.gold} />
            <Text style={s.shiftText}>{time}</Text>
          </View>
          <ScalePressable
            style={s.call}
            onPress={onCall}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.callGuard')}
          >
            <Feather name="phone" size={f(22)} color={colors.primary} />
          </ScalePressable>
        </View>
      </View>
    </ScalePressable>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  content: { padding: w(14), paddingBottom: h(22) },
  addButton: {
    height: h(36),
    backgroundColor: colors.primary,
    borderRadius: w(6),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(22),
    marginBottom: h(15),
  },
  addText: { color: colors.white, fontSize: f(16), fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: w(10), marginBottom: h(17) },
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
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.primary,
    fontSize: f(16),
    marginLeft: w(8),
  },
  filterButton: {
    width: w(44),
    height: h(46),
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { flexDirection: 'row', gap: w(12), marginBottom: h(17) },
  filter: {
    height: h(40),
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: w(5),
  },
  activeFilter: { backgroundColor: colors.primary },
  filterText: {
    color: colors.primary,
    fontSize: f(14),
    fontWeight: '500',
    textAlign: 'center',
  },
  activeFilterText: { color: colors.white, fontWeight: '600' },
  list: { gap: h(17) },
  card: {
    minHeight: h(115),
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(8),
    padding: w(10),
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: w(55),
    height: w(55),
    borderRadius: w(28),
    backgroundColor: '#FFE08A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: w(12),
  },
  initial: { color: '#B9640A', fontSize: f(24), fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: w(7) },
  name: { flex: 1, color: colors.primary, fontSize: f(17), fontWeight: '700' },
  status: {
    fontSize: f(10),
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: w(5),
    paddingHorizontal: w(5),
    paddingVertical: h(2),
  },
  onDuty: { color: '#079B52', borderColor: '#079B52' },
  offDuty: { color: '#667085', borderColor: '#98A2B3' },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: h(7),
    gap: w(5),
  },
  site: { flex: 1, color: '#667085', fontSize: f(13) },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: h(9),
    gap: w(8),
  },
  code: { color: '#667085', fontSize: f(12), fontWeight: '500' },
  shift: { flexDirection: 'row', alignItems: 'center', gap: w(4), flex: 1 },
  shiftText: { color: '#667085', fontSize: f(12) },
  call: {
    width: w(35),
    height: w(35),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: w(18),
    backgroundColor: '#F4F6F8',
  },
  message: {
    color: '#667085',
    fontSize: f(15),
    textAlign: 'center',
    marginTop: h(28),
  },
  error: {
    color: colors.status.danger,
    fontSize: f(14),
    textAlign: 'center',
    marginTop: h(28),
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});

export default AgencyGuardsScreen;
