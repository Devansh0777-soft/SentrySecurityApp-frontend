import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ClientTopNavigation from '../components/ClientTopNavigation';
import ClientBottomNavigation, {
  type ClientTab,
} from '../components/ClientBottomNavigation';
import ClientProfilePanel from '../components/ClientProfilePanel';
import ClientCoverageRequests from '../components/ClientCoverageRequests';
import ClientHomeContent from '../components/ClientHomeContent';
import ClientInformationScreen, {
  type ClientInformationPage,
} from '../components/ClientInformationScreen';
import ClientAlerts from '../components/ClientAlerts';
import ClientInvoices from '../components/ClientInvoices';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';
import ScalePressable from '../../../components/common/ScalePressable';
import {
  clientService,
  type ClientDetails,
  type CoverageRequest,
} from '../../../services/clientService';
import { useAuth } from '../../authentication/context/AuthContext';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { scaleFont } from '../../../styles/dimensions';

export default function ClientPortalScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [tab, setTab] = useState<ClientTab>('home');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [details, setDetails] = useState<ClientDetails | null>(null);
  const [coverageRequests, setCoverageRequests] = useState<CoverageRequest[]>(
    [],
  );
  const [informationPage, setInformationPage] =
    useState<ClientInformationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clientDetails, requests] = await Promise.all([
        clientService.getDetails(),
        clientService.getCoverageRequests(),
      ]);
      setDetails(clientDetails);
      setCoverageRequests(requests);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t('client.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!informationPage) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setInformationPage(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [informationPage]);
  const signOut = async () => {
    // Centralised logout clears persisted auth and flips auth state;
    // AppNavigator resets the stack to AuthFlow.
    await logout();
  };
  const emailSupport = async () => {
    try {
      await Linking.openURL(
        `mailto:helpdesk@gmail.com?subject=${encodeURIComponent(
          t('clientInfo.supportSubject'),
        )}`,
      );
    } catch {
      Alert.alert(t('client.needHelp'), t('clientInfo.emailUnavailable'));
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ClientTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        onNotificationOpen={() => setProfileMenuOpen(false)}
        avatarInitials={(details?.full_name || 'C')
          .trim()
          .charAt(0)
          .toUpperCase()}
      />
      {informationPage && tab === 'home' ? (
        <View style={s.informationContent}>
          <ClientInformationScreen page={informationPage} />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={colors.primary}
            />
          }
        >
          {loading ? (
            <View style={s.state}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.muted}>{t('client.loading')}</Text>
            </View>
          ) : null}
          {!loading && error ? (
            <View style={s.state}>
              <Text style={s.error}>{error}</Text>
              <ScalePressable style={s.outline} onPress={load}>
                <Text style={s.outlineText}>{t('superAdmin.tryAgain')}</Text>
              </ScalePressable>
            </View>
          ) : null}
          {!loading && !error && tab === 'home' ? (
            <ClientHomeContent
              details={details}
              requests={coverageRequests}
              onHowItWorks={() => setInformationPage('howItWorks')}
              onWhyHireAgency={() => setInformationPage('whyHireAgency')}
              onNeedHelp={emailSupport}
            />
          ) : null}
          {!loading && !error && tab === 'request' ? (
            <ClientCoverageRequests />
          ) : null}
          {/* Invoices render inside the standard padded content area. */}
          {!loading && !error && tab === 'invoices' ? <ClientInvoices /> : null}
          {!loading && !error && tab === 'alerts' ? <ClientAlerts /> : null}
          {!loading && !error && tab === 'profile' && details ? (
            <ClientProfilePanel
              details={details}
              onUpdated={setDetails}
              onSignOut={signOut}
            />
          ) : null}
        </ScrollView>
      )}
      <ClientBottomNavigation
        activeTab={tab}
        onTabPress={nextTab => {
          setProfileMenuOpen(false);
          setInformationPage(null);
          setTab(nextTab);
        }}
      />
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
            name: details?.full_name || t('client.profile'),
            company: details?.site_name || '',
            initials: (details?.full_name || 'C')
              .trim()
              .charAt(0)
              .toUpperCase(),
          }}
          onMyProfile={() => {
            setTab('profile');
            setProfileMenuOpen(false);
          }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  scroll: { flex: 1 },
  informationContent: { flex: 1, padding: spacing.md },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  state: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  muted: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: 21,
  },
  error: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.sm),
    textAlign: 'center',
  },
  outline: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});
