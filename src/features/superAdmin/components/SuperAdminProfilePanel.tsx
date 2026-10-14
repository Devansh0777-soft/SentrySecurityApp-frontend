import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import ScalePressable from '../../../components/common/ScalePressable';
import {
  superAdminService,
  type SuperAdminProfile,
} from '../../../services/superAdminService';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { isValidEmail, isValidIndianMobile } from '../../../utils/validation';

type Form = Pick<SuperAdminProfile, 'full_name' | 'email' | 'mobile_number'>;

const emptyForm: Form = { full_name: '', email: '', mobile_number: '' };

export default function SuperAdminProfilePanel({
  onSignOut,
}: {
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<SuperAdminProfile | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const account = await superAdminService.getProfile();
      setProfile(account);
      setForm({
        full_name: account.full_name ?? '',
        email: account.email ?? '',
        mobile_number: account.mobile_number ?? '',
      });
    } catch (error) {
      Alert.alert(
        t('superAdmin.profile'),
        error instanceof Error ? error.message : t('auth.tryAgain'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const update = (key: keyof Form, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const save = async () => {
    if (form.full_name.trim().length < 2) {
      Alert.alert(
        t('superAdmin.fullNameRequired'),
        t('superAdmin.enterFullName'),
      );
      return;
    }
    if (!isValidEmail(form.email)) {
      Alert.alert(t('superAdmin.invalidEmail'), t('superAdmin.enterEmail'));
      return;
    }
    if (!isValidIndianMobile(form.mobile_number)) {
      Alert.alert(t('superAdmin.invalidPhone'), t('superAdmin.enterPhone'));
      return;
    }
    try {
      setSaving(true);
      const response = await superAdminService.updateProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        mobile_number: form.mobile_number.trim(),
      });
      setProfile(current =>
        current ? { ...current, ...response.admin } : response.admin,
      );
      setForm(current => ({
        ...current,
        email: current.email.trim().toLowerCase(),
      }));
      Alert.alert(t('superAdmin.profileUpdated'), t('superAdmin.changesSaved'));
    } catch (error) {
      Alert.alert(
        t('superAdmin.profile'),
        error instanceof Error ? error.message : t('auth.tryAgain'),
      );
    } finally {
      setSaving(false);
    }
  };

  const initial = (form.full_name || 'U').trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={s.helper}>{t('superAdmin.loadingProfile')}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.profileHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={s.identityCopy}>
          <Text style={s.name}>{form.full_name || 'Super Admin'}</Text>
          <Text style={s.accountId}>
            {t('superAdmin.accountId', { id: profile?.account_id || '—' })}
          </Text>
        </View>
      </View>
      <View style={s.divider} />
      <Text style={s.section}>{t('superAdmin.yourAccount')}</Text>
      <Field
        label={t('superAdmin.fullName')}
        icon="user"
        value={form.full_name}
        onChangeText={value => update('full_name', value)}
      />
      <Field
        label={t('superAdmin.email')}
        icon="mail"
        value={form.email}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={value => update('email', value)}
      />
      <Field
        label={t('superAdmin.mobileNumber')}
        icon="phone"
        value={form.mobile_number}
        keyboardType="phone-pad"
        onChangeText={value =>
          update('mobile_number', value.replace(/[^\d+]/g, ''))
        }
        maxLength={13}
      />
      <ScalePressable
        style={s.save}
        onPress={save}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving, busy: saving }}
      >
        <Text style={s.saveText}>
          {saving ? t('superAdmin.saving') : t('superAdmin.saveChanges')}
        </Text>
      </ScalePressable>
      <ScalePressable
        style={s.signOut}
        onPress={onSignOut}
        accessibilityRole="button"
      >
        <Feather
          name="log-out"
          size={scaleFont(20)}
          color={colors.status.danger}
        />
        <Text style={s.signOutText}>{t('superAdmin.signOut')}</Text>
      </ScalePressable>
    </View>
  );
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none';
  maxLength?: number;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        <Feather name={icon} size={scaleFont(19)} color={colors.textGray} />
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          style={s.input}
          placeholder={label}
          placeholderTextColor={colors.textGray}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: spacing.md },
  loading: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  helper: { color: colors.textGray, fontSize: scaleFont(typography.sizes.sm) },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: scaleFont(76),
    height: scaleFont(76),
    borderRadius: scaleFont(38),
    backgroundColor: '#E2DBCA',
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#B9640A',
    fontSize: scaleFont(typography.sizes.xxxl),
    fontWeight: typography.weights.bold,
  },
  identityCopy: { flex: 1, gap: spacing.xs },
  name: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xxl),
    fontWeight: typography.weights.bold,
  },
  accountId: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.md),
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  section: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.gold,
    paddingLeft: spacing.sm,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  inputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  save: {
    minHeight: 50,
    borderRadius: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
  },
  signOut: {
    minHeight: 50,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.status.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  signOutText: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
});
