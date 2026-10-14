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

import ScalePressable from '../../../components/common/ScalePressable';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import type { GuardStackParamList } from '../../../navigation/types';
import {
  guardService,
  type GuardProfile,
} from '../../../services/guardService';
import { useAuth } from '../../authentication/context/AuthContext';
import GuardTopNavigation from '../components/GuardTopNavigation';
import GuardBottomNavigation, {
  type GuardTab,
} from '../components/GuardBottomNavigation';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';

type Props = NativeStackScreenProps<GuardStackParamList, 'GuardProfile'>;

const ACCENT = '#B9640A';

const GuardProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<GuardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setError('');
      setProfile(await guardService.getProfile());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('guardProfile.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signOut = async () => {
    // Centralised logout clears persisted auth and flips auth state;
    // AppNavigator resets the stack to AuthFlow.
    await logout();
  };
  const handleTab = (tab: GuardTab) => {
    setProfileMenuOpen(false);
    if (tab === 'duty') navigation.navigate('GuardDuty');
    else if (tab === 'report') navigation.navigate('GuardReport');
    else if (tab === 'patrol') navigation.navigate('GuardPatrol');
    else if (tab === 'schedule') navigation.navigate('GuardSchedule');
  };

  const initial = (profile?.full_name || 'U').trim().charAt(0).toUpperCase();
  const guardCode = profile?.guard_code || `SG-${profile?.id ?? '—'}`;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <GuardTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        avatarInitials={initial}
      />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.profileHeader}>
          <View style={s.photo}>
            <Text style={s.initial}>{initial}</Text>
          </View>
          <View style={s.identity}>
            <Text style={s.name} numberOfLines={1}>
              {profile?.full_name || t('guardProfile.role')}
            </Text>
            <Text style={s.role}>{t('guardProfile.role')}</Text>
            <Text style={s.empId}>
              {t('guardProfile.empId', { id: guardCode })}
            </Text>
          </View>
        </View>
        <View style={s.divider} />

        {loading ? (
          <View style={s.state}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.stateText}>{t('guardProfile.loadingProfile')}</Text>
          </View>
        ) : error ? (
          <View style={s.state}>
            <Text style={s.error}>{error}</Text>
            <ScalePressable
              style={s.retry}
              onPress={() => {
                setLoading(true);
                loadProfile();
              }}
              accessibilityRole="button"
            >
              <Text style={s.retryText}>{t('guardProfile.tryAgain')}</Text>
            </ScalePressable>
          </View>
        ) : (
          <>
            <MenuRow
              icon="user"
              label={t('guardProfile.personalInformation')}
              onPress={() => navigation.navigate('GuardPersonalInfo')}
            />
            <MenuRow
              icon="file-text"
              label={t('guardProfile.documents')}
              onPress={() => navigation.navigate('GuardDocuments')}
            />
            <MenuRow
              icon="briefcase"
              label={t('guardProfile.bankDetails')}
              onPress={() => navigation.navigate('GuardBankDetails')}
            />
            <MenuRow
              icon="phone-call"
              label={t('guardProfile.emergencyContact')}
              onPress={() => navigation.navigate('GuardEmergencyContact')}
            />
            <MenuRow
              icon="settings"
              label={t('guardProfile.settings')}
              onPress={() =>
                navigation.navigate('GuardSection', { section: 'settings' })
              }
            />
            <ScalePressable
              style={s.signOut}
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel={t('guardProfile.signOut')}
            >
              <Feather
                name="log-out"
                size={f(20)}
                color={colors.status.danger}
              />
              <Text style={s.signOutText}>{t('guardProfile.signOut')}</Text>
            </ScalePressable>
          </>
        )}
      </ScrollView>

      <GuardBottomNavigation activeTab="profile" onTabPress={handleTab} />

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
          identity={{
            name: profile?.full_name || t('guardProfile.role'),
            company: t('guardProfile.empId', { id: guardCode }),
            initials: initial,
          }}
          onMyProfile={() => {
            setProfileMenuOpen(false);
            navigation.navigate('GuardPersonalInfo');
          }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
};

const MenuRow: React.FC<{
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <ScalePressable
    style={s.row}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Feather name={icon} size={f(22)} color={ACCENT} />
    <Text style={s.rowLabel}>{label}</Text>
    <Feather name="chevron-right" size={f(23)} color={colors.primary} />
  </ScalePressable>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  content: {
    paddingHorizontal: w(16),
    paddingTop: h(12),
    paddingBottom: h(20),
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: h(15),
  },
  photo: {
    width: w(80),
    height: w(80),
    borderRadius: w(40),
    backgroundColor: '#E2DBCA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: w(2),
    borderColor: '#D2C9B3',
    position: 'relative',
  },
  initial: { color: ACCENT, fontSize: f(36), fontWeight: '700' },
  identity: { marginLeft: w(16), flex: 1 },
  name: { color: colors.primary, fontSize: f(27), fontWeight: '700' },
  role: {
    color: colors.textGray,
    fontSize: f(17),
    fontWeight: '500',
    marginTop: h(3),
  },
  empId: {
    color: ACCENT,
    fontSize: f(17),
    fontWeight: '600',
    marginTop: h(4),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginBottom: h(8),
  },
  row: {
    minHeight: h(62),
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: {
    flex: 1,
    color: colors.primary,
    fontSize: f(20),
    fontWeight: '500',
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(60),
    gap: spacing.sm,
  },
  stateText: {
    color: colors.textGray,
    fontSize: f(16),
  },
  error: {
    color: colors.status.danger,
    fontSize: f(16),
    textAlign: 'center',
  },
  retry: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.white,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  signOut: {
    minHeight: 54,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.status.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: h(28),
  },
  signOutText: {
    color: colors.status.danger,
    fontSize: f(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});

export default GuardProfileScreen;
