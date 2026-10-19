import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
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
  type AgencyIncident,
} from '../../../services/agencyApiService';
import { notificationService } from '../../../services/notificationService';
import ScalePressable from '../../../components/common/ScalePressable';
import IncidentStatusModal from '../components/IncidentStatusModal';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyIncidents'>;
type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

const incidentAppearance = {
  high: { icon: 'alert-circle', color: '#FF6262', tint: '#FDE4E4' },
  medium: { icon: 'bell', color: '#FFB43C', tint: '#FFF1D9' },
  low: { icon: 'shield', color: '#5A8DFF', tint: '#E8EEFF' },
} as const;

const formatIncidentTime = (createdAt: string) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const AgencyIncidentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [filter, setFilter] = useState<'All' | Severity>('All');
  const [incidents, setIncidents] = useState<AgencyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedIncident, setSelectedIncident] =
    useState<AgencyIncident | null>(null);
  const loadIncidents = useCallback(async () => {
    try {
      setLoadError('');
      setIncidents(await agencyApiService.getIncidents());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t('dashboard.unableToLoadIncidents'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    if (route.params?.openFileIncident) {
      navigation.setParams({ openFileIncident: undefined });
      navigation.navigate('AgencyFileIncident');
    }
  }, [navigation, route.params?.openFileIncident]);
  // Reload whenever the tab regains focus so an incident filed by a guard (the
  // one the buzzer just announced) is already on screen when the agency looks.
  useFocusEffect(
    useCallback(() => {
      void loadIncidents();
    }, [loadIncidents]),
  );
  // "Agency sees the incident" = opening its detail card. Acknowledge once per
  // incident so the backend buzzer loop stops; the incident itself is NEVER
  // removed from this list or from client alerts.
  useEffect(() => {
    if (selectedIncident && !selectedIncident.acknowledged_at) {
      notificationService
        .acknowledgeIncident(selectedIncident.id)
        .then(() =>
          setIncidents(current =>
            current.map(item =>
              item.id === selectedIncident.id
                ? { ...item, acknowledged_at: new Date().toISOString() }
                : item,
            ),
          ),
        )
        .catch(() => undefined);
    }
  }, [selectedIncident]);
  const visible =
    filter === 'All'
      ? incidents
      : incidents.filter(item => item.severity.toUpperCase() === filter);
  const onTabPress = (tab: AgencyNavTab) => {
    if (tab === 'overview') navigation.navigate('AgencyOverview');
    if (tab === 'guards') navigation.navigate('AgencyGuards');
    if (tab === 'sites') navigation.navigate('AgencySites');
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
      >
        <ScalePressable
          style={s.fileButton}
          onPress={() => navigation.navigate('AgencyFileIncident')}
          accessibilityRole="button"
        >
          <Text style={s.fileText}>{t('dashboard.fileIncident')}</Text>
        </ScalePressable>
        <View style={s.filters}>
          {(['All', 'HIGH', 'MEDIUM', 'LOW'] as const).map(item => (
            <TouchableOpacity
              key={item}
              style={[
                s.filter,
                {
                  backgroundColor:
                    filter === item ? colors.primary : colors.white,
                },
              ]}
              onPress={() => setFilter(item === 'All' ? 'All' : item)}
            >
              <Text
                style={[
                  s.filterText,
                  { color: filter === item ? colors.white : colors.primary },
                ]}
              >
                {item === 'HIGH'
                  ? t('dashboard.high')
                  : item === 'MEDIUM'
                  ? t('dashboard.medium')
                  : item === 'LOW'
                  ? t('dashboard.low')
                  : t('dashboard.all')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.list}>
          {loading ? (
            <Text style={s.message}>{t('dashboard.loadingIncidents')}</Text>
          ) : loadError ? (
            <Text style={s.error}>{loadError}</Text>
          ) : visible.length ? (
            visible.map(item => (
              <IncidentCard
                key={item.id}
                incident={item}
                onPress={() => setSelectedIncident(item)}
              />
            ))
          ) : (
            <Text style={s.message}>{t('dashboard.noIncidents')}</Text>
          )}
        </View>
      </ScrollView>
      <AgencyBottomNavigation activeTab="incidents" onTabPress={onTabPress} />
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
      <IncidentStatusModal
        visible={Boolean(selectedIncident)}
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={updated => {
          setIncidents(current =>
            current.map(item =>
              item.id === updated.id ? { ...item, ...updated } : item,
            ),
          );
          setSelectedIncident(updated);
        }}
      />
    </SafeAreaView>
  );
};

const IncidentCard: React.FC<{
  incident: AgencyIncident;
  onPress: () => void;
}> = ({ incident, onPress }) => {
  const { t } = useTranslation();
  const appearance =
    incidentAppearance[incident.severity] ?? incidentAppearance.low;
  return (
    <ScalePressable
      style={s.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${incident.incident_code}`}
    >
      <View style={[s.icon, { backgroundColor: appearance.tint }]}>
        <Feather
          name={appearance.icon as React.ComponentProps<typeof Feather>['name']}
          size={f(26)}
          color={appearance.color}
        />
      </View>
      <View style={s.copy}>
        <View style={s.topRow}>
          <Text style={[s.id, { color: appearance.color }]}>
            {incident.incident_code}
          </Text>
          <Text
            style={[
              s.severity,
              { color: appearance.color, borderColor: appearance.color },
            ]}
          >
            {t(`dashboard.${incident.severity}`)}
          </Text>
        </View>
        <Text style={s.cardTitle}>{incident.notes}</Text>
        <Text style={s.site}>{incident.site_name}</Text>
        <Text style={s.time}>{formatIncidentTime(incident.created_at)}</Text>
      </View>
    </ScalePressable>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  content: { padding: w(14), paddingBottom: h(22) },
  fileButton: {
    height: h(36),
    backgroundColor: colors.primary,
    borderRadius: w(6),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(22),
    marginBottom: h(23),
  },
  fileText: { color: colors.white, fontWeight: '700', fontSize: f(16) },
  filters: { flexDirection: 'row', gap: w(17), marginBottom: h(23) },
  filter: {
    height: h(30),
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(7),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: f(14), fontWeight: '600' },
  list: { gap: h(22) },
  message: {
    color: '#6A6A6A',
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
    minHeight: h(115),
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: w(8),
    padding: w(8),
    flexDirection: 'row',
  },
  icon: {
    width: w(49),
    height: w(49),
    borderRadius: w(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: h(8),
  },
  copy: { flex: 1, marginLeft: w(9), paddingTop: h(1) },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  id: { fontSize: f(11), fontWeight: '500' },
  severity: {
    borderWidth: 1,
    borderRadius: w(5),
    paddingHorizontal: w(6),
    paddingVertical: h(2),
    fontSize: f(10),
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: f(16),
    fontWeight: '700',
    lineHeight: f(19),
    color: colors.primary,
    marginTop: h(4),
    paddingRight: w(2),
  },
  site: { color: '#6A6A6A', fontSize: f(12), marginTop: h(5) },
  time: { color: '#6A6A6A', fontSize: f(12), marginTop: h(2) },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});

export default AgencyIncidentsScreen;
