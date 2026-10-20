import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import {
  agencyApiService,
  type AgencySite,
} from '../../../services/agencyApiService';
import { ApiError } from '../../../services/apiClient';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { scaleFont } from '../../../styles/dimensions';
import { typography } from '../../../styles/typography';
import ScalePressable from '../../../components/common/ScalePressable';
import type { MainStackParamList } from '../../../navigation/types';
import { appAlert } from '../../../services/alertService';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'AddSiteScreen'>;
};

const AddSiteScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState('day_shift');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !address.trim()) {
      appAlert.alert(
        t('dashboard.missingDetails'),
        t('dashboard.siteAndAddressRequired'),
        { type: 'error' },
      );
      return;
    }
    try {
      setSaving(true);
      const response = (await agencyApiService.createSite({
        siteName: name.trim(),
        siteAddress: address.trim(),
        coveragePlan: plan,
      })) as { data: AgencySite };
      navigation.navigate('AgencySites');
      appAlert.alert(t('dashboard.saveSite'), t('dashboard.siteCreated'), {
        type: 'success',
      });
    } catch (error) {
      const limitReached = error instanceof ApiError && error.status === 403;
      appAlert.alert(
        limitReached ? t('dashboard.planLimitTitle') : t('dashboard.saveSite'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <View style={s.headerContent}>
          <Pressable
            style={s.iconButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('dashboard.back')}
          >
            <Feather
              name="chevron-left"
              size={scaleFont(typography.sizes.xxl)}
              color={colors.primary}
            />
          </Pressable>
          <View style={s.titleContainer}>
            <Text style={s.title}>{t('dashboard.addSite')}</Text>
          </View>
          <View style={s.iconButton} />
        </View>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.keyboard}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>{t('dashboard.siteName')} *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder={t('dashboard.enterSiteName')}
                placeholderTextColor="#999"
                maxLength={100}
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>{t('dashboard.address')} *</Text>
              <TextInput
                style={s.input}
                value={address}
                onChangeText={setAddress}
                placeholder={t('dashboard.enterCompleteAddress')}
                placeholderTextColor="#999"
                maxLength={200}
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <TouchableOpacity
                style={s.gps}
                onPress={() => {
                  // GPS capture handled by backend integration
                }}
              >
                <Text style={s.gpsText}>
                  {t('dashboard.useCurrentLocation')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={s.label}>{t('dashboard.coveragePlan')} *</Text>
            <View style={s.planRow}>
              {['day_shift', 'night_watch', '24x7'].map(p => (
                <ScalePressable
                  key={p}
                  style={[s.plan, plan === p && s.activePlan]}
                  disabled={saving}
                  onPress={() => setPlan(p)}
                >
                  <Text
                    style={[s.planText, plan === p && s.activePlanText]}
                    numberOfLines={2}
                  >
                    {p === 'day_shift'
                      ? t('dashboard.dayShift')
                      : p === 'night_watch'
                      ? t('dashboard.nightWatch')
                      : t('dashboard.coverage24x7')}
                  </Text>
                </ScalePressable>
              ))}
            </View>
            <View style={s.submitWrapper}>
              <ScalePressable
                style={[s.save, saving && { opacity: 0.7 }]}
                disabled={saving}
                onPress={save}
                accessibilityRole="button"
              >
                <Text style={s.saveText}>
                  {saving ? t('dashboard.saving') : t('dashboard.saveSite')}
                </Text>
              </ScalePressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.md,
  },
  titleContainer: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: scaleFont(typography.sizes.xxl),
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  iconButton: {
    minWidth: spacing.xxxl,
    minHeight: spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  form: { flex: 1, gap: spacing.sm },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: scaleFont(typography.sizes.md),
    color: colors.primary,
    backgroundColor: colors.white,
  },
  gps: {
    minHeight: spacing.xxxl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  gpsText: {
    fontSize: scaleFont(typography.sizes.md),
    color: colors.primary,
    textAlign: 'center',
  },
  planRow: { flexDirection: 'row', gap: spacing.sm },
  plan: {
    minHeight: spacing.xxxl,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  activePlan: { backgroundColor: colors.primary, borderColor: colors.primary },
  planText: {
    fontSize: scaleFont(typography.sizes.sm),
    color: colors.primary,
    textAlign: 'center',
  },
  activePlanText: { color: colors.white },
  submitWrapper: {
    marginTop: spacing.md,
  },
  save: {
    width: '100%',
    minHeight: spacing.xxxl,
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: scaleFont(typography.sizes.lg),
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
});

export default AddSiteScreen;
