import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  type GuardProfileUpdate,
} from '../../../services/guardService';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<GuardStackParamList, 'GuardPersonalInfo'>;

const ACCENT = '#B9640A';

type FormState = {
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  gender: 'male' | 'female' | 'other' | '';
};

const emptyForm: FormState = {
  fullName: '',
  email: '',
  mobileNumber: '',
  address: '',
  gender: '',
};

const stripCountryCode = (value?: string | null) =>
  (value || '').replace(/^\+91/, '').trim();

const GuardPersonalInfoScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<GuardProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setError('');
      const data = await guardService.getProfile();
      setProfile(data);
      setForm({
        fullName: data.full_name || '',
        email: data.email || '',
        mobileNumber: stripCountryCode(data.mobile_number),
        address: data.address || '',
        gender: (data.gender as FormState['gender']) || '',
      });
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

  const update = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const startEditing = () => setEditing(true);
  const cancelEditing = () => {
    setEditing(false);
    if (profile) {
      setForm({
        fullName: profile.full_name || '',
        email: profile.email || '',
        mobileNumber: stripCountryCode(profile.mobile_number),
        address: profile.address || '',
        gender: (profile.gender as FormState['gender']) || '',
      });
    }
  };

  const validate = (): string | null => {
    if (!form.fullName.trim()) return t('guardProfile.validation.nameRequired');
    if (!form.email.trim()) return t('guardProfile.validation.emailRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return t('guardProfile.validation.emailInvalid');
    }
    if (form.mobileNumber.replace(/\D/g, '').length !== 10) {
      return t('guardProfile.validation.mobileInvalid');
    }
    return null;
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      appAlert.alert(t('guardProfile.editProfile'), validationError, {
        type: 'error',
      });
      return;
    }
    const payload: GuardProfileUpdate = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      mobileNumber: form.mobileNumber.trim(),
      address: form.address.trim() || null,
      gender: form.gender || null,
    };
    try {
      setSaving(true);
      const updated = await guardService.updateProfile(payload);
      setProfile(updated);
      setForm({
        fullName: updated.full_name || '',
        email: updated.email || '',
        mobileNumber: stripCountryCode(updated.mobile_number),
        address: updated.address || '',
        gender: (updated.gender as FormState['gender']) || '',
      });
      setEditing(false);
      appAlert.alert(
        t('guardProfile.profileUpdated'),
        t('guardProfile.profileUpdatedHint'),
        { type: 'success' },
      );
    } catch (saveError) {
      appAlert.alert(
        t('guardProfile.updateFailed'),
        saveError instanceof Error
          ? saveError.message
          : t('guardProfile.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };

  const guardCode = profile?.guard_code || `SG-${profile?.id ?? '—'}`;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <ScalePressable
          style={s.iconButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('guardProfile.back')}
        >
          <Feather name="arrow-left" size={f(22)} color={colors.primary} />
        </ScalePressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {t('guardProfile.personalInformation')}
        </Text>
        {editing ? (
          <View style={s.iconButton} />
        ) : (
          <ScalePressable
            style={s.iconButton}
            onPress={startEditing}
            accessibilityRole="button"
            accessibilityLabel={t('guardProfile.editProfile')}
          >
            <Feather name="edit-2" size={f(20)} color={ACCENT} />
          </ScalePressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={s.state}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.stateText}>
                {t('guardProfile.loadingProfile')}
              </Text>
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
              <View style={s.card}>
                <Text style={s.cardTitle}>
                  {t('guardProfile.personalInformation')}
                </Text>

                <Field
                  label={t('dashboard.fullName')}
                  value={form.fullName}
                  editing={editing}
                  onChangeText={text => update('fullName', text)}
                  placeholder={t('guardProfile.notAvailable')}
                />
                <Field
                  label={t('dashboard.emailAddress')}
                  value={form.email}
                  editing={editing}
                  onChangeText={text => update('email', text)}
                  placeholder={t('guardProfile.notAvailable')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label={t('dashboard.mobileNumber')}
                  value={form.mobileNumber}
                  editing={editing}
                  onChangeText={text =>
                    update('mobileNumber', text.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder={t('guardProfile.notAvailable')}
                  keyboardType="number-pad"
                />
                <Field
                  label={t('dashboard.address')}
                  value={form.address}
                  editing={editing}
                  onChangeText={text => update('address', text)}
                  placeholder={t('dashboard.addressNotProvided')}
                  multiline
                />
                <Text style={s.fieldLabel}>{t('guardProfile.gender')}</Text>
                {editing ? (
                  <View style={s.genderRow}>
                    {(['male', 'female', 'other'] as const).map(option => {
                      const active = form.gender === option;
                      return (
                        <ScalePressable
                          key={option}
                          style={[s.genderOption, active && s.genderActive]}
                          onPress={() => update('gender', option)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            style={[s.genderText, active && s.genderTextActive]}
                          >
                            {t(`guardProfile.genderOptions.${option}`)}
                          </Text>
                        </ScalePressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={s.fieldBox}>
                    <Text
                      style={[
                        s.fieldValue,
                        !profile?.gender && s.fieldValueMuted,
                      ]}
                    >
                      {profile?.gender
                        ? t(`guardProfile.genderOptions.${profile.gender}`)
                        : t('guardProfile.notAvailable')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>
                  {t('guardProfile.employmentInformation')}
                </Text>
                <MetaRow label={t('guardProfile.guardId')} value={guardCode} />
                <MetaRow
                  label={t('guardProfile.assignedSite')}
                  value={profile?.site_name || t('dashboard.unassignedSite')}
                />
                <MetaRow
                  label={t('guardProfile.dutyStatus')}
                  value={
                    profile?.status === 'on_duty'
                      ? t('dashboard.onDuty')
                      : t('dashboard.offDuty')
                  }
                  valueColor={
                    profile?.status === 'on_duty'
                      ? colors.status.success
                      : colors.textGray
                  }
                />
              </View>

              {editing ? (
                <View style={s.actions}>
                  <ScalePressable
                    style={[s.button, s.cancelButton]}
                    onPress={cancelEditing}
                    disabled={saving}
                    accessibilityRole="button"
                  >
                    <Text style={s.cancelText}>{t('guardProfile.cancel')}</Text>
                  </ScalePressable>
                  <ScalePressable
                    style={[s.button, s.saveButton, saving && s.buttonDisabled]}
                    onPress={save}
                    disabled={saving}
                    accessibilityRole="button"
                  >
                    <Text style={s.saveText}>
                      {saving
                        ? t('guardProfile.saving')
                        : t('guardProfile.saveChanges')}
                    </Text>
                  </ScalePressable>
                </View>
              ) : (
                <ScalePressable
                  style={[s.button, s.saveButton]}
                  onPress={startEditing}
                  accessibilityRole="button"
                >
                  <Feather name="edit-2" size={f(18)} color={colors.white} />
                  <Text style={s.saveText}>
                    {t('guardProfile.editProfile')}
                  </Text>
                </ScalePressable>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  editing: boolean;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
}> = ({
  label,
  value,
  editing,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline,
}) => (
  <View>
    <Text style={s.fieldLabel}>{label}</Text>
    {editing ? (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[s.fieldBox, multiline && s.fieldBoxMultiline]}
        placeholder={placeholder}
        placeholderTextColor={colors.textGray}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    ) : (
      <View style={s.fieldBox}>
        <Text style={[s.fieldValue, !value && s.fieldValueMuted]}>
          {value && value.length > 0 ? value : placeholder}
        </Text>
      </View>
    )}
  </View>
);

const MetaRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor }) => (
  <View style={s.metaRow}>
    <Text style={s.metaLabel}>{label}</Text>
    <Text
      style={[s.metaValue, valueColor ? { color: valueColor } : null]}
      numberOfLines={2}
    >
      {value}
    </Text>
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: w(12),
    paddingVertical: h(10),
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  iconButton: {
    width: w(40),
    height: w(40),
    borderRadius: w(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: f(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  content: {
    padding: spacing.md,
    paddingBottom: h(28),
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: f(typography.sizes.lg),
    fontWeight: typography.weights.bold,
    borderLeftWidth: w(4),
    borderLeftColor: colors.gold,
    paddingLeft: w(9),
  },
  fieldLabel: {
    color: colors.textGray,
    fontSize: f(typography.sizes.sm),
    fontWeight: typography.weights.medium,
    marginBottom: h(6),
  },
  fieldBox: {
    minHeight: h(50),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: h(12),
    justifyContent: 'center',
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  fieldBoxMultiline: {
    minHeight: h(90),
    paddingTop: h(12),
  },
  fieldValue: {
    color: colors.primary,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  fieldValueMuted: { color: colors.textGray },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderOption: {
    flex: 1,
    minHeight: h(46),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.white,
  },
  genderActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  genderText: {
    color: colors.primary,
    fontSize: f(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  genderTextActive: {
    color: colors.white,
    fontWeight: typography.weights.semiBold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: w(12),
    paddingVertical: h(2),
  },
  metaLabel: {
    flexShrink: 1,
    color: colors.textGray,
    fontSize: f(typography.sizes.md),
  },
  metaValue: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: h(4),
  },
  button: {
    minHeight: h(52),
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  saveButton: {
    flex: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cancelText: {
    color: colors.primary,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  saveText: {
    color: colors.white,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(60),
    gap: spacing.sm,
  },
  stateText: { color: colors.textGray, fontSize: f(16) },
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
});

export default GuardPersonalInfoScreen;
