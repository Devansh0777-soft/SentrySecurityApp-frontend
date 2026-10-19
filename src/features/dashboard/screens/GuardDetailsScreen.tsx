import React, { useCallback, useEffect, useState } from 'react';
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
import AgencyBottomNavigation from '../components/AgencyBottomNavigation';
import AgencyProfileMenu from '../components/AgencyProfileMenu';
import AgencyTopNavigation from '../components/AgencyTopNavigation';
import ScalePressable from '../../../components/common/ScalePressable';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyGuardDetails'>;

const genderLabel = (gender?: AgencyGuard['gender'] | null, t: (k: string) => string = (k: string) => k) => {
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  if (gender === 'other') return 'Other';
  return t('guardDetails.notAvailable');
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (value?: string | null, t: (k: string) => string = (k: string) => k): string => {
  if (!value) return t('guardDetails.notAvailable');
  // Match ISO date-only format YYYY-MM-DD — preserve calendar date, no timezone shift
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
  }
  // Match ISO timestamp format — extract UTC components to avoid timezone shift
  const timestampMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (timestampMatch) {
    const [, year, month, day] = timestampMatch;
    return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
  }
  // Fallback for other date strings
  const d = new Date(value);
  if (isNaN(d.getTime())) return t('guardDetails.notAvailable');
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const AgencyGuardDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { guardId } = route.params;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [guard, setGuard] = useState<AgencyGuard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const fresh = await agencyApiService.getGuard(guardId);
      setGuard(fresh);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t('guardDetails.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [guardId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const navigate = (tab: 'overview' | 'guards' | 'sites' | 'incidents' | 'plan' | 'profile') => {
    if (tab === 'overview') navigation.navigate('AgencyOverview');
    if (tab === 'guards') navigation.navigate('AgencyGuards');
    if (tab === 'sites') navigation.navigate('AgencySites');
    if (tab === 'incidents') navigation.navigate('AgencyIncidents');
    if (tab === 'plan') navigation.navigate('AgencyPlan');
    if (tab === 'profile') navigation.navigate('AgencyProfile');
  };

  const dutyText = guard?.status === 'on_duty' ? t('event.onDuty') : t('event.offDuty');

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <AgencyTopNavigation
          profileMenuOpen={profileMenuOpen}
          onProfilePress={() => setProfileMenuOpen(open => !open)}
        />
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.stateText}>{t('guardDetails.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError && !guard) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <AgencyTopNavigation
          profileMenuOpen={profileMenuOpen}
          onProfilePress={() => setProfileMenuOpen(open => !open)}
        />
        <View style={s.center}>
          <View style={s.errorIcon}>
            <Feather name="alert-circle" size={f(28)} color={colors.status.danger} />
          </View>
          <Text style={s.errorText}>{loadError}</Text>
          <ScalePressable style={s.retry} onPress={load} accessibilityRole="button">
            <Text style={s.retryText}>{t('event.retry')}</Text>
          </ScalePressable>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={s.title}>{t('guardDetails.title')}</Text>
        <View style={s.card}>
          <View style={s.avatar}>
            <Feather name="user" size={f(24)} color={colors.primary} />
          </View>
          <View style={s.guardCopy}>
            <Text style={s.guardName} numberOfLines={1}>
              {guard?.full_name}
            </Text>
            <Text style={s.guardCode} numberOfLines={1}>
              {guard?.guard_code}
            </Text>
            <Text
              style={[
                s.guardStatus,
                guard?.status === 'on_duty' ? s.dutyOn : s.dutyOff,
              ]}
            >
              {dutyText}
            </Text>
          </View>
        </View>
        <InfoRow label={t('guardDetails.guardId')} value={String(guard?.id)} />
        {guard?.mobile_number ? (
          <InfoRow label={t('guardDetails.mobileNumber')} value={guard.mobile_number} />
        ) : null}
        {guard?.email ? (
          <InfoRow label={t('guardDetails.emailAddress')} value={guard.email} />
        ) : null}
        {guard?.joining_date ? (
          <InfoRow label={t('guardDetails.joiningDate')} value={formatDate(guard.joining_date, t)} />
        ) : null}
        {guard?.address ? (
          <InfoRow label={t('guardDetails.address')} value={guard.address} />
        ) : null}
        {guard?.age != null ? (
          <InfoRow label={t('guardDetails.age')} value={String(guard.age)} />
        ) : null}
        <InfoRow
          label={t('guardDetails.gender')}
          value={genderLabel(guard?.gender, t)}
        />
        <InfoRow
          label={t('guardDetails.assignedSite')}
          value={guard?.site_name ?? t('guardDetails.notAvailable')}
        />
        <InfoRow label={t('guardDetails.dutyStatus')} value={dutyText} />
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

export default AgencyGuardDetailsScreen;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: w(18), paddingTop: h(14), paddingBottom: h(28) },
  back: { flexDirection: 'row', alignItems: 'center', gap: w(4) },
  backText: { color: colors.primary, fontSize: f(15), fontWeight: '600' },
  title: { color: colors.primary, fontSize: f(26), fontWeight: '800', marginTop: h(8), marginBottom: h(16) },
  card: { borderWidth: 1, borderColor: '#DCDCDC', borderRadius: w(12), padding: w(16), flexDirection: 'row', alignItems: 'center' },
  avatar: { width: w(48), height: w(48), borderRadius: w(24), backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginRight: w(12) },
  guardCopy: { flex: 1, minWidth: 0 },
  guardName: { color: colors.primary, fontSize: f(17), fontWeight: '700' },
  guardCode: { color: '#667085', fontSize: f(13), marginTop: 1 },
  guardStatus: { fontSize: f(12), fontWeight: '700', marginTop: 2 },
  dutyOn: { color: colors.status.success },
  dutyOff: { color: '#B42318' },
  infoRow: { flexDirection: 'row', gap: w(12), paddingVertical: h(9), borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: h(4) },
  infoLabel: { color: '#667085', fontSize: f(14), flexShrink: 0 },
  infoValue: { color: colors.primary, fontSize: f(15), fontWeight: '600', textAlign: 'right', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: h(12), padding: w(24) },
  stateText: { color: '#667085', fontSize: f(15), textAlign: 'center' },
  errorIcon: { width: w(56), height: w(56), borderRadius: w(28), backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.status.danger, fontSize: f(16), fontWeight: '600', textAlign: 'center' },
  retry: { marginTop: h(6), backgroundColor: colors.primary, borderRadius: w(10), paddingHorizontal: w(22), paddingVertical: h(11) },
  retryText: { color: colors.white, fontSize: f(15), fontWeight: '700' },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});