import React, { useCallback, useEffect, useState } from 'react';
import AgencyApprovalsPanel from '../components/AgencyApprovalsPanel';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import SuperAdminTopNavigation from '../components/SuperAdminTopNavigation';
import SuperAdminBottomNavigation, {
  AdminTab,
} from '../components/SuperAdminBottomNavigation';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';
import SuperAdminProfilePanel from '../components/SuperAdminProfilePanel';
import SuperAdminAgencyEditorModal, {
  type DemoAgency,
} from '../components/SuperAdminAgencyEditorModal';
import SuperAdminNotificationsModal from '../components/SuperAdminNotificationsModal';
import ScalePressable from '../../../components/common/ScalePressable';
import { useAuth } from '../../authentication/context/AuthContext';
import {
  takeSlot,
  awaitBootPrefetch,
} from '../../../services/bootPrefetch';
import {
  superAdminService,
  type AgencyRecord,
} from '../../../services/superAdminService';
import { notificationService } from '../../../services/notificationService';
import { colors } from '../../../styles/colors';
import { typography } from '../../../styles/typography';
import { spacing } from '../../../styles/spacing';
import { scaleFont } from '../../../styles/dimensions';
import type { RootStackParamList } from '../../../navigation/types';

export default function SuperAdminScreen() {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<AdminTab>('agencies');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [agency, setAgency] = useState<DemoAgency | null>(null);
  const [agencies, setAgencies] = useState<DemoAgency[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [agencyQuery, setAgencyQuery] = useState('');
  const filteredAgencies = agencies.filter(
    item =>
      item.status === (showInactive ? 'inactive' : 'active') &&
      item.agencyName.toLowerCase().includes(agencyQuery.trim().toLowerCase()),
  );
  const loadAgencies = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      // First mount joins this session's boot prefetch flight: await the
      // shared promise (already settled in the normal case), then take the
      // slot. Refreshes and cache-misses fetch live.
      let records = takeSlot<AgencyRecord[]>('agencies');
      if (records === undefined) {
        try {
          await awaitBootPrefetch();
        } catch {
          // Fall through to the live fetch below.
        }
        records = takeSlot<AgencyRecord[]>('agencies');
      }
      const live =
        records ??
        (await superAdminService.getAgencies());
      setAgencies(
        live
          .filter(item => ['approved', 'inactive'].includes(item.status))
          .map(item => ({
            id: String(item.id),
            agencyName: item.agency_name,
            ownerName: item.full_name,
            email: item.email,
            mobile: item.mobile_number,
            address: item.office_address,
            state: item.state,
            district: item.district || '',
            city: item.city,
            pincode: item.pincode,
            gstNumber: item.gst_number || '',
            status: item.status === 'approved' ? 'active' : 'inactive',
          })),
      );
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : t('superAdmin.unableAgencies'),
      );
    } finally {
      setListLoading(false);
    }
  }, [t]);
  useFocusEffect(
    useCallback(() => {
      void loadAgencies();
    }, [loadAgencies]),
  );
  const [editingAgency, setEditingAgency] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const refreshNotifications = useCallback(() => {
    void notificationService
      .getUnreadCount()
      .then(response => setUnreadNotificationCount(response.count))
      .catch(() => setUnreadNotificationCount(0));
  }, []);
  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const signOut = async () => {
    // Centralised logout clears persisted auth and flips auth state;
    // AppNavigator resets the stack to AuthFlow.
    await logout();
  };
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <SuperAdminTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        onNotificationPress={() => setNotificationsOpen(true)}
        unreadNotificationCount={unreadNotificationCount}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          tab === 'agencies' ? (
            <RefreshControl
              refreshing={listLoading}
              onRefresh={() => void loadAgencies()}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {tab === 'profile' ? (
          <SuperAdminProfilePanel
            onSignOut={() => {
              void signOut();
            }}
          />
        ) : (
          <>
            {tab === 'agencies' && (
              <View style={s.dashboard}>
                <View style={s.summaryGroup}>
                  <View style={s.metrics}>
                    {(['agencies', 'guards', 'clients'] as const).map(label => (
                      <View key={label} style={s.metric}>
                        <Text style={s.value}>
                          {label === 'agencies'
                            ? agencies.filter(item => item.status === 'active')
                                .length
                            : '—'}
                        </Text>
                        <Text style={s.metricLabel}>
                          {t(`superAdmin.${label}`)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <ScalePressable
                    style={s.addAgencyButton}
                    onPress={() =>
                      navigation.navigate('AuthFlow', {
                        screen: 'CreateAccount',
                        params: { forceAccountType: 'agency' },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('superAdmin.addAgency')}
                  >
                    <Feather
                      name="plus"
                      size={scaleFont(20)}
                      color={colors.white}
                    />
                    <Text style={s.addAgencyText}>
                      {t('superAdmin.addAgency')}
                    </Text>
                  </ScalePressable>
                </View>
                <View style={s.directoryGroup}>
                  <View style={s.searchGroup}>
                    <View style={s.searchBar}>
                      <Feather
                        name="search"
                        size={scaleFont(20)}
                        color={colors.textGray}
                      />
                      <TextInput
                        style={s.searchInput}
                        value={agencyQuery}
                        onChangeText={setAgencyQuery}
                        placeholder={t('superAdmin.searchAgencies')}
                        placeholderTextColor={colors.textGray}
                        accessibilityLabel={t('superAdmin.searchAgencies')}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                      />
                    </View>
                    <View style={s.filters}>
                      {(['active', 'inactive'] as const).map(status => {
                        const selected =
                          showInactive === (status === 'inactive');
                        return (
                          <ScalePressable
                            key={status}
                            style={[s.filter, selected && s.selectedFilter]}
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
                            onPress={() =>
                              setShowInactive(status === 'inactive')
                            }
                          >
                            <Text
                              style={[
                                s.filterText,
                                selected && s.selectedFilterText,
                              ]}
                            >
                              {status === 'active'
                                ? t('superAdmin.active')
                                : t('superAdmin.inactive')}
                            </Text>
                          </ScalePressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={s.resultsGroup}>
                    {listLoading ? (
                      <ActivityIndicator
                        color={colors.primary}
                        accessibilityLabel={t('superAdmin.loadingAgencies')}
                      />
                    ) : null}
                    {listError ? <Text style={s.body}>{listError}</Text> : null}
                    {!listLoading && !listError && !filteredAgencies.length ? (
                      <View style={s.empty}>
                        <Text style={s.emptyTitle}>
                          {agencyQuery.trim()
                            ? t('superAdmin.noMatching')
                            : showInactive
                            ? t('superAdmin.noInactive')
                            : t('superAdmin.noActive')}
                        </Text>
                        <Text style={s.body}>
                          {agencyQuery.trim()
                            ? t('superAdmin.searchHint')
                            : t('superAdmin.approvalHint')}
                        </Text>
                      </View>
                    ) : null}
                    {!listLoading &&
                      !listError &&
                      filteredAgencies.map(item => (
                        <ScalePressable
                          key={item.id}
                          style={s.agencyCard}
                          onPress={() => {
                            setAgency(item);
                            setEditingAgency(true);
                          }}
                          accessibilityLabel={`Edit ${item.agencyName}`}
                        >
                          <View style={s.agencyCopy}>
                            <View style={s.agencyTitleRow}>
                              <Text style={s.agencyName}>
                                {item.agencyName}
                              </Text>
                              <Text
                                style={[
                                  s.statusBadge,
                                  item.status === 'active'
                                    ? s.activeBadge
                                    : s.inactiveBadge,
                                ]}
                              >
                                {item.status === 'active'
                                  ? t('superAdmin.active')
                                  : t('superAdmin.inactive')}
                              </Text>
                            </View>
                            <Text style={s.agencyDetail}>{item.ownerName}</Text>
                            <Text style={s.agencyDetail}>{item.email}</Text>
                            <Text style={s.agencyDetail}>
                              {[item.city, item.state]
                                .filter(Boolean)
                                .join(', ')}
                            </Text>
                          </View>
                          <Feather
                            name="chevron-right"
                            size={scaleFont(22)}
                            color={colors.textGray}
                          />
                        </ScalePressable>
                      ))}
                  </View>
                </View>
              </View>
            )}
            {tab === 'approval' ? (
              <AgencyApprovalsPanel
                onChanged={() => {
                  refreshNotifications();
                  void loadAgencies();
                }}
              />
            ) : null}
            {tab === 'live' ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Feather name="activity" size={28} color={colors.primary} />
                </View>
                <Text style={s.emptyTitle}>{t('superAdmin.networkTitle')}</Text>
                <Text style={s.body}>{t('superAdmin.liveUnavailable')}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <SuperAdminBottomNavigation activeTab={tab} onTabPress={setTab} />
      {profileMenuOpen ? (
        <Pressable
          style={s.menuBackdrop}
          onPress={() => setProfileMenuOpen(false)}
        />
      ) : null}
      {profileMenuOpen ? (
        <AgencyProfileMenu
          identity={{
            name: (user?.full_name ?? '').trim() || 'Super Admin',
            company: 'Sentry Security Services',
            initials: ((user?.full_name ?? '').trim() || 'U')
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
      <SuperAdminAgencyEditorModal
        agency={agency}
        visible={editingAgency}
        onClose={() => setEditingAgency(false)}
        onSave={async (updated, newPassword) => {
          await superAdminService.updateAgency(updated.id, {
            ...updated,
            newPassword,
          });
          await loadAgencies();
        }}
        onRemove={async id => {
          await superAdminService.rejectAgency(Number(id));
          await loadAgencies();
          refreshNotifications();
        }}
      />
      <SuperAdminNotificationsModal
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadCountChange={setUnreadNotificationCount}
        onReviewApprovals={() => {
          setNotificationsOpen(false);
          setTab('approval');
        }}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: spacing.xxxl,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.regular,
    paddingVertical: spacing.sm,
  },
  dashboard: { gap: spacing.lg },
  summaryGroup: { gap: spacing.md },
  directoryGroup: { gap: spacing.md },
  searchGroup: { gap: spacing.sm },
  resultsGroup: { gap: spacing.md },
  metricLabel: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background,
  },
  filter: {
    flex: 1,
    minHeight: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
  },
  selectedFilter: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  selectedFilterText: { color: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.md, gap: spacing.md },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    flex: 1,
    backgroundColor: colors.light.background,
    borderRadius: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  value: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xxl),
    fontWeight: typography.weights.bold,
  },
  body: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: 22,
  },
  addAgencyButton: {
    minHeight: 52,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addAgencyText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  reviewButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewButtonText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  section: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
  agencyCard: {
    minHeight: 132,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  agencyIcon: {
    width: 48,
    height: 48,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
  },
  agencyCopy: { flex: 1, gap: spacing.xs },
  agencyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  agencyName: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  agencyDetail: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
  },
  agencyStats: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.bold,
  },
  activeBadge: {
    color: colors.status.success,
    borderColor: colors.status.success,
  },
  inactiveBadge: {
    color: colors.status.danger,
    borderColor: colors.status.danger,
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyIcon: {
    alignSelf: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.light.background,
    borderRadius: spacing.md,
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
  menuBackdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});
