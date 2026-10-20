import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import ScalePressable from '../../../components/common/ScalePressable';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import {
  indiaLocationService,
  type IndiaLocationOption,
} from '../../../services/indiaLocationService';
import { appAlert } from '../../../services/alertService';

export type DemoAgency = {
  id: string;
  agencyName: string;
  ownerName: string;
  email: string;
  mobile: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  gstNumber: string;
  status: 'active' | 'inactive';
};

type PickerType = 'state' | 'district' | 'city' | null;

export default function SuperAdminAgencyEditorModal({
  agency,
  visible,
  onClose,
  onSave,
  onRemove,
}: {
  agency: DemoAgency | null;
  visible: boolean;
  onClose: () => void;
  onSave: (agency: DemoAgency, newPassword: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DemoAgency | null>(agency);
  const [picker, setPicker] = useState<PickerType>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [states, setStates] = useState<IndiaLocationOption[]>([]);
  const [districts, setDistricts] = useState<IndiaLocationOption[]>([]);
  const [cities, setCities] = useState<IndiaLocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setDraft(agency);
      setConfirmingRemoval(false);
      setPicker(null);
      setPickerQuery('');
      setNewPassword('');
    }
  }, [agency, visible]);

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;

    void indiaLocationService
      .getStates()
      .then(options => {
        if (isMounted) setStates(options);
      })
      .catch(() => {
        if (isMounted)
          setLocationError('Unable to load locations. Please try again.');
      });

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const pickerOptions = useMemo(() => {
    const options =
      picker === 'state' ? states : picker === 'district' ? districts : cities;
    const query = pickerQuery.trim().toLowerCase();
    return options.filter(option => option.name.toLowerCase().includes(query));
  }, [cities, districts, picker, pickerQuery, states]);
  const update = (key: keyof DemoAgency, value: string) =>
    setDraft(current => (current ? { ...current, [key]: value } : current));
  const getOption = (options: IndiaLocationOption[], name: string) =>
    options.find(
      option => option.name.toLowerCase() === name.trim().toLowerCase(),
    );

  const openPicker = async (type: Exclude<PickerType, null>) => {
    if (!draft) return;
    if (picker === type) {
      setPicker(null);
      return;
    }

    setPicker(type);
    setPickerQuery('');
    setLocationError(null);
    setLocationsLoading(true);
    try {
      const stateOptions = states.length
        ? states
        : await indiaLocationService.getStates();
      if (!states.length) setStates(stateOptions);
      if (type === 'state') return;

      const selectedState = getOption(stateOptions, draft.state);
      if (!selectedState) throw new Error('Select a valid state first.');
      const districtOptions = await indiaLocationService.getDistricts(
        selectedState.slug,
      );
      setDistricts(districtOptions);
      if (type === 'district') return;

      const selectedDistrict = getOption(districtOptions, draft.district);
      if (!selectedDistrict) throw new Error('Select a valid district first.');
      setCities(
        await indiaLocationService.getCities(
          selectedState.slug,
          selectedDistrict.slug,
        ),
      );
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : 'Unable to load locations. Please try again.',
      );
    } finally {
      setLocationsLoading(false);
    }
  };

  const select = (option: IndiaLocationOption) => {
    if (picker === 'state') {
      setDraft(current =>
        current
          ? { ...current, state: option.name, district: '', city: '' }
          : current,
      );
      setDistricts([]);
      setCities([]);
    } else if (picker === 'district') {
      setDraft(current =>
        current ? { ...current, district: option.name, city: '' } : current,
      );
      setCities([]);
    } else if (picker === 'city') {
      setDraft(current =>
        current ? { ...current, city: option.name } : current,
      );
    }
    setPicker(null);
  };

  const save = async () => {
    if (!draft) return;
    if (
      !draft.ownerName.trim() ||
      !draft.agencyName.trim() ||
      !draft.city.trim() ||
      !draft.email.trim() ||
      !draft.mobile.trim() ||
      !draft.address.trim() ||
      !draft.state ||
      !draft.district ||
      !draft.pincode.trim()
    ) {
      appAlert.alert(
        'Missing details',
        'Complete the required Agency details before saving.',
        { type: 'error' },
      );
      return;
    }
    const mobile = `+91${draft.mobile.replace(/\D/g, '').slice(-10)}`;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) ||
      !/^\+91[6-9]\d{9}$/.test(mobile) ||
      !/^[1-9]\d{5}$/.test(draft.pincode)
    ) {
      appAlert.alert(
        'Invalid details',
        'Enter a valid email, Indian mobile number and pincode.',
        { type: 'error' },
      );
      return;
    }
    if (
      (draft.gstNumber && !/^[A-Z0-9]{15}$/.test(draft.gstNumber)) ||
      (newPassword && newPassword.length < 8)
    ) {
      appAlert.alert(
        'Invalid details',
        'GST must contain 15 letters or digits. A new password must contain at least 8 characters.',
        { type: 'error' },
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          ...draft,
          mobile,
          ownerName: draft.ownerName.trim(),
          email: draft.email.trim().toLowerCase(),
        },
        newPassword,
      );
      appAlert.alert(
        t('superAdmin.agencyUpdated'),
        t('superAdmin.agencySaved'),
        { type: 'success' },
      );
      onClose();
    } catch (error) {
      appAlert.alert(
        'Could not save agency',
        error instanceof Error ? error.message : 'Please try again.',
        { type: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };

  if (!draft) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>{t('superAdmin.editAgency')}</Text>
              <Text style={s.subtitle}>{t('superAdmin.manageAgency')}</Text>
            </View>
            <ScalePressable
              style={s.close}
              onPress={onClose}
              accessibilityLabel={t('superAdmin.closeEditor')}
            >
              <Feather name="x" size={scaleFont(24)} color={colors.primary} />
            </ScalePressable>
          </View>
          <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.summary}>
              <Text style={s.summaryTitle}>
                {t('superAdmin.agencyDetails')}
              </Text>
              <Summary label={t('auth.fullName')} value={draft.ownerName} />
              <Summary
                label={t('details.agencyName')}
                value={draft.agencyName}
              />
              <Summary
                label={t('superAdmin.status')}
                value={
                  draft.status === 'active'
                    ? t('superAdmin.active')
                    : t('superAdmin.inactive')
                }
              />
            </View>
            <Text style={s.section}>{t('superAdmin.accountDetails')}</Text>
            <Field
              label={t('auth.fullName')}
              value={draft.ownerName}
              onChangeText={value => update('ownerName', value)}
            />
            <Field
              label={t('superAdmin.email')}
              value={draft.email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={value => update('email', value)}
            />
            <Field
              label={t('superAdmin.mobileNumber')}
              value={draft.mobile}
              keyboardType="phone-pad"
              onChangeText={value =>
                update('mobile', value.replace(/[^\d+]/g, ''))
              }
            />
            <Text style={s.section}>{t('superAdmin.businessDetails')}</Text>
            <Field
              label={t('details.agencyName')}
              value={draft.agencyName}
              onChangeText={value => update('agencyName', value)}
            />
            <Field
              label={t('superAdmin.address')}
              value={draft.address}
              onChangeText={value => update('address', value)}
            />
            <SelectField
              label={t('dashboard.state')}
              value={draft.state}
              open={picker === 'state'}
              onPress={() => void openPicker('state')}
            />
            <SelectField
              label={t('dashboard.district')}
              value={draft.district}
              open={picker === 'district'}
              disabled={!draft.state}
              onPress={() => void openPicker('district')}
            />
            <View style={s.twoColumns}>
              <SelectField
                style={s.flex}
                label={t('dashboard.city')}
                value={draft.city}
                open={picker === 'city'}
                disabled={!draft.district}
                onPress={() => void openPicker('city')}
              />
              <Field
                style={s.flex}
                label={t('dashboard.pincode')}
                value={draft.pincode}
                keyboardType="number-pad"
                onChangeText={value =>
                  update('pincode', value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </View>
            <Field
              label={t('details.gstNumber')}
              value={draft.gstNumber}
              autoCapitalize="characters"
              onChangeText={value => update('gstNumber', value)}
            />
            <Field
              label={t('dashboard.newGuardPassword')}
              value={newPassword}
              secureTextEntry
              placeholder={t('superAdmin.leavePassword')}
              onChangeText={setNewPassword}
            />
            <Text style={s.label}>{t('superAdmin.status')}</Text>
            <View style={s.statusRow}>
              {(['active', 'inactive'] as const).map(status => (
                <ScalePressable
                  key={status}
                  style={[
                    s.statusOption,
                    draft.status === status &&
                      (status === 'active' ? s.activeStatus : s.inactiveStatus),
                  ]}
                  onPress={() =>
                    setDraft(current =>
                      current ? { ...current, status } : current,
                    )
                  }
                >
                  <Text
                    style={[
                      s.statusText,
                      draft.status === status &&
                        (status === 'active'
                          ? s.activeStatusText
                          : s.inactiveStatusText),
                    ]}
                  >
                    {status === 'active'
                      ? t('superAdmin.active')
                      : t('superAdmin.inactive')}
                  </Text>
                </ScalePressable>
              ))}
            </View>
            <ScalePressable
              style={s.save}
              disabled={saving}
              onPress={save}
              accessibilityRole="button"
            >
              <Text style={s.saveText}>
                {saving ? t('superAdmin.saving') : t('superAdmin.saveChanges')}
              </Text>
            </ScalePressable>
            {confirmingRemoval ? (
              <View style={s.confirmation}>
                <Text style={s.confirmationText}>
                  Remove this agency? Their Admin login will stop working. This
                  can’t be undone.
                </Text>
                <View style={s.confirmationActions}>
                  <ScalePressable
                    style={s.removeConfirm}
                    disabled={saving}
                    onPress={async () => {
                      setSaving(true);
                      try {
                        await onRemove(draft.id);
                        onClose();
                      } catch (error) {
                        appAlert.error(
                          'Could not remove agency',
                          error instanceof Error
                            ? error.message
                            : 'Please try again.',
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    <Text style={s.removeConfirmText}>
                      {t('superAdmin.removeAgency')}
                    </Text>
                  </ScalePressable>
                  <ScalePressable
                    style={s.cancel}
                    onPress={() => setConfirmingRemoval(false)}
                  >
                    <Text style={s.cancelText}>{t('superAdmin.cancel')}</Text>
                  </ScalePressable>
                </View>
              </View>
            ) : (
              <ScalePressable
                style={s.remove}
                onPress={() => setConfirmingRemoval(true)}
                accessibilityRole="button"
              >
                <Text style={s.removeText}>{t('superAdmin.removeAgency')}</Text>
              </ScalePressable>
            )}
          </ScrollView>
        </View>
      </View>
      <Modal
        transparent
        visible={picker !== null}
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.pickerOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPicker(null)}
          />
          <View style={s.picker}>
            <Text style={s.pickerTitle}>
              {picker === 'state'
                ? 'Select state'
                : picker === 'district'
                ? 'Select district'
                : 'Select city'}
            </Text>
            <View style={s.search}>
              <Feather
                name="search"
                size={scaleFont(18)}
                color={colors.textGray}
              />
              <TextInput
                value={pickerQuery}
                onChangeText={setPickerQuery}
                style={s.searchInput}
                placeholder={`Search ${picker ?? 'location'}`}
                placeholderTextColor={colors.textGray}
                autoCorrect={false}
              />
            </View>
            <ScrollView
              style={s.pickerList}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {locationsLoading ? (
                <Text style={s.pickerMessage}>
                  {t('superAdmin.loadingLocations')}
                </Text>
              ) : null}
              {!locationsLoading && locationError ? (
                <Text style={s.pickerMessage}>{locationError}</Text>
              ) : null}
              {!locationsLoading &&
                !locationError &&
                pickerOptions.map(option => (
                  <ScalePressable
                    key={option.slug}
                    style={s.pickerOption}
                    onPress={() => select(option)}
                  >
                    <Text style={s.pickerOptionText}>{option.name}</Text>
                    {option.name ===
                    (picker === 'state'
                      ? draft.state
                      : picker === 'district'
                      ? draft.district
                      : draft.city) ? (
                      <Feather
                        name="check"
                        size={scaleFont(18)}
                        color={colors.status.info}
                      />
                    ) : null}
                  </ScalePressable>
                ))}
              {!locationsLoading && !locationError && !pickerOptions.length ? (
                <Text style={s.pickerMessage}>
                  No matching locations found.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function Summary({
  label,
  value,
  accent,
  success,
}: {
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
}) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, accent && s.accent, success && s.success]}>
        {value}
      </Text>
    </View>
  );
}
function Field({
  label,
  value,
  onChangeText,
  style,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  style?: object;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'characters';
  secureTextEntry?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={[s.field, style]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={s.input}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={colors.textGray}
        autoCorrect={false}
      />
    </View>
  );
}
function SelectField({
  label,
  value,
  onPress,
  disabled,
  open,
  style,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  open?: boolean;
  style?: object;
}) {
  return (
    <View style={[s.field, style]}>
      <Text style={s.label}>{label}</Text>
      <ScalePressable
        style={[s.select, disabled && s.disabled]}
        disabled={disabled}
        onPress={onPress}
      >
        <Text style={[s.selectText, !value && s.placeholder]} numberOfLines={1}>
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={scaleFont(21)}
          color={colors.primary}
        />
      </ScalePressable>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.66)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xl),
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    marginTop: spacing.xs,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.background,
  },
  content: { padding: spacing.lg, gap: spacing.md },
  summary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    flex: 1,
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  accent: { color: colors.gold },
  success: { color: colors.status.success },
  section: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
    letterSpacing: 1.1,
    marginTop: spacing.sm,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  select: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  placeholder: { color: colors.textGray },
  disabled: { opacity: 0.5 },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusOption: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  activeStatus: { borderColor: colors.status.success },
  activeStatusText: { color: colors.status.success },
  inactiveStatus: { borderColor: colors.status.danger },
  inactiveStatusText: { color: colors.status.danger },
  save: {
    minHeight: 52,
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
  remove: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.status.danger,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.status.danger,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  confirmation: {
    borderWidth: 1,
    borderColor: colors.status.danger,
    borderRadius: spacing.sm,
    padding: spacing.md,
    gap: spacing.md,
  },
  confirmationText: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: 21,
  },
  confirmationActions: { flexDirection: 'row', gap: spacing.sm },
  removeConfirm: {
    flex: 1,
    minHeight: 46,
    borderRadius: spacing.sm,
    backgroundColor: colors.status.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeConfirmText: {
    color: colors.white,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.bold,
  },
  cancel: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.4)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  picker: {
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pickerTitle: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
    paddingHorizontal: spacing.sm,
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
    paddingVertical: 0,
  },
  pickerList: { maxHeight: 192 },
  pickerOption: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptionText: {
    flex: 1,
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.md),
  },
  pickerMessage: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    color: colors.textGray,
    fontSize: scaleFont(typography.sizes.sm),
    textAlignVertical: 'center',
  },
});
