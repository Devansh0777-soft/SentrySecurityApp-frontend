import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  accountService,
  type AgencyProfile,
} from '../../../services/accountService';
import { useAuth } from '../../authentication/context/AuthContext';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import {
  scaleFont as f,
  scaleHeight as h,
  scaleWidth as w,
} from '../../../styles/dimensions';
import AgencyBottomNavigation, {
  AgencyNavTab,
} from '../components/AgencyBottomNavigation';
import AgencyTopNavigation from '../components/AgencyTopNavigation';
import AgencyProfileMenu from '../components/AgencyProfileMenu';
import ScalePressable from '../../../components/common/ScalePressable';
import {
  indiaLocationService,
  type IndiaLocationOption,
} from '../../../services/indiaLocationService';

type Props = NativeStackScreenProps<MainStackParamList, 'AgencyProfile'>;
type Form = Pick<
  AgencyProfile,
  | 'agency_name'
  | 'business_type'
  | 'gst_number'
  | 'office_address'
  | 'city'
  | 'state'
  | 'district'
  | 'pincode'
  | 'full_name'
  | 'email'
  | 'mobile_number'
>;

const emptyForm: Form = {
  agency_name: '',
  business_type: '',
  gst_number: '',
  office_address: '',
  city: '',
  state: '',
  district: '',
  pincode: '',
  full_name: '',
  email: '',
  mobile_number: '',
};

const AgencyProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<'state' | 'district' | 'city' | null>(
    null,
  );
  const [pickerQuery, setPickerQuery] = useState('');
  const [states, setStates] = useState<IndiaLocationOption[]>([]);
  const [districts, setDistricts] = useState<IndiaLocationOption[]>([]);
  const [cities, setCities] = useState<IndiaLocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setForm({ ...emptyForm, ...(await accountService.getAgencyProfile()) });
    } catch (error) {
      Alert.alert(
        t('dashboard.profile'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);
  useEffect(() => {
    let active = true;
    indiaLocationService
      .getStates()
      .then(options => {
        if (active) setStates(options);
      })
      .catch(() => {
        if (active)
          setLocationError('Unable to load locations. Please try again.');
      });
    return () => {
      active = false;
    };
  }, []);
  const update = (key: keyof Form, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (
      !form.agency_name.trim() ||
      !form.business_type.trim() ||
      !form.office_address.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.district?.trim() ||
      !form.pincode.trim() ||
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.mobile_number.trim()
    ) {
      Alert.alert(
        t('dashboard.missingDetails'),
        t('dashboard.profileRequired'),
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      Alert.alert(t('dashboard.profile'), t('auth.invalidEmail'));
      return;
    }
    if (!/^(?:\+91)?[6-9]\d{9}$/.test(form.mobile_number.trim())) {
      Alert.alert(t('dashboard.profile'), t('auth.invalidMobile'));
      return;
    }
    if (!/^[1-9]\d{5}$/.test(form.pincode.trim())) {
      Alert.alert(t('dashboard.profile'), t('details.enterValidPincode'));
      return;
    }
    try {
      setSaving(true);
      const response = await accountService.updateAgencyProfile({
        agencyName: form.agency_name.trim(),
        businessType: form.business_type.trim(),
        gstNumber: form.gst_number?.trim(),
        officeAddress: form.office_address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        district: form.district?.trim(),
        pincode: form.pincode.trim(),
        fullName: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        mobileNumber: form.mobile_number.trim(),
      });
      setForm({ ...emptyForm, ...response.data });
      Alert.alert(t('dashboard.profile'), t('dashboard.changesSaved'));
    } catch (error) {
      Alert.alert(
        t('dashboard.profile'),
        error instanceof Error ? error.message : t('dashboard.tryAgain'),
      );
    } finally {
      setSaving(false);
    }
  };
  const signOut = async () => {
    // Centralised logout clears persisted auth and flips auth state;
    // AppNavigator resets the stack to AuthFlow.
    await logout();
  };
  const navigate = (tab: AgencyNavTab) => {
    if (tab === 'overview') navigation.navigate('AgencyOverview');
    if (tab === 'guards') navigation.navigate('AgencyGuards');
    if (tab === 'sites') navigation.navigate('AgencySites');
    if (tab === 'incidents') navigation.navigate('AgencyIncidents');
    if (tab === 'plan') navigation.navigate('AgencyPlan');
  };
  const initial = (form.full_name || form.agency_name || 'A')
    .trim()
    .charAt(0)
    .toUpperCase();
  const pickerOptions = useMemo(() => {
    const options =
      picker === 'state' ? states : picker === 'district' ? districts : cities;
    const query = pickerQuery.trim().toLowerCase();
    return options.filter(option => option.name.toLowerCase().includes(query));
  }, [cities, districts, picker, pickerQuery, states]);
  const findLocation = (options: IndiaLocationOption[], value: string) =>
    options.find(
      option => option.name.toLowerCase() === value.trim().toLowerCase(),
    );
  const openPicker = async (type: Exclude<typeof picker, null>) => {
    if (picker === type) {
      setPicker(null);
      return;
    }
    setPicker(type);
    setPickerQuery('');
    setLocationError('');
    setLocationsLoading(true);
    try {
      const stateOptions = states.length
        ? states
        : await indiaLocationService.getStates();
      if (!states.length) setStates(stateOptions);
      if (type === 'state') return;
      const selectedState = findLocation(stateOptions, form.state);
      if (!selectedState) throw new Error('Select a valid state first.');
      const districtOptions = await indiaLocationService.getDistricts(
        selectedState.slug,
      );
      setDistricts(districtOptions);
      if (type === 'district') return;
      const selectedDistrict = findLocation(
        districtOptions,
        form.district ?? '',
      );
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
  const selectLocation = (option: IndiaLocationOption) => {
    if (picker === 'state')
      setForm(current => ({
        ...current,
        state: option.name,
        district: '',
        city: '',
      }));
    if (picker === 'state') {
      setDistricts([]);
      setCities([]);
    }
    if (picker === 'district')
      setForm(current => ({ ...current, district: option.name, city: '' }));
    if (picker === 'district') setCities([]);
    if (picker === 'city') update('city', option.name);
    setPicker(null);
    setPickerQuery('');
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
        <View style={s.profileHeader}>
          <View style={s.photo}>
            <Text style={s.initial}>{initial}</Text>
            <ScalePressable
              style={s.camera}
              onPress={() =>
                Alert.alert(
                  t('dashboard.profilePhoto'),
                  t('dashboard.photoUploadSoon'),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.profilePhoto')}
            >
              <Feather name="camera" size={f(19)} color={colors.white} />
            </ScalePressable>
          </View>
          <View style={s.identity}>
            <Text style={s.name}>
              {form.full_name || t('dashboard.agencyAdmin')}
            </Text>
            <Text style={s.accountId}>
              {form.agency_name || t('dashboard.accountDetails')}
            </Text>
          </View>
        </View>
        <View style={s.divider} />
        <Text style={s.section}>{t('dashboard.yourAccount')}</Text>
        {loading ? (
          <Text style={s.loading}>{t('dashboard.loadingProfile')}</Text>
        ) : (
          <>
            <Field
              label={t('dashboard.fullName')}
              icon="user"
              value={form.full_name}
              onChangeText={value => update('full_name', value)}
            />
            <Field
              label={t('dashboard.mobileNumber')}
              icon="phone"
              value={form.mobile_number}
              keyboardType="phone-pad"
              onChangeText={value => update('mobile_number', value)}
            />
            <Field
              label={t('dashboard.emailAddress')}
              icon="mail"
              value={form.email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={value => update('email', value)}
            />
            <Field
              label={t('dashboard.address')}
              icon="map-pin"
              value={form.office_address}
              onChangeText={value => update('office_address', value)}
            />
            <View style={s.twoCol}>
              <DropdownField
                style={s.half}
                label={t('dashboard.state')}
                value={form.state}
                open={picker === 'state'}
                onPress={() => {
                  openPicker('state');
                }}
              />
              <DropdownField
                style={s.half}
                label={t('dashboard.district')}
                value={form.district ?? ''}
                open={picker === 'district'}
                onPress={() => {
                  if (form.state) openPicker('district');
                }}
                disabled={!form.state}
              />
            </View>
            <View style={s.twoCol}>
              <DropdownField
                style={s.half}
                label={t('dashboard.city')}
                value={form.city}
                open={picker === 'city'}
                onPress={() => {
                  if (form.district) openPicker('city');
                }}
                disabled={!form.district}
              />
              <Field
                style={s.half}
                label={t('dashboard.pincode')}
                value={form.pincode}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={value =>
                  update('pincode', value.replace(/\D/g, ''))
                }
              />
            </View>
            <ScalePressable
              style={s.save}
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              <Text style={s.saveText}>
                {saving ? t('dashboard.saving') : t('dashboard.saveChanges')}
              </Text>
            </ScalePressable>
            <ScalePressable
              style={s.signOut}
              onPress={signOut}
              accessibilityRole="button"
            >
              <Feather
                name="log-out"
                size={f(20)}
                color={colors.status.danger}
              />
              <Text style={s.signOutText}>{t('dashboard.signOut')}</Text>
            </ScalePressable>
          </>
        )}
      </ScrollView>
      <AgencyBottomNavigation activeTab="profile" onTabPress={navigate} />
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
          onMyProfile={() => setProfileMenuOpen(false)}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
      <Modal
        transparent
        visible={picker !== null}
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <TouchableOpacity
          style={s.pickerOverlay}
          activeOpacity={1}
          onPress={() => setPicker(null)}
        >
          <View style={s.pickerSheet} onStartShouldSetResponder={() => true}>
            <Text style={s.pickerTitle}>
              {picker === 'state'
                ? t('dashboard.state')
                : picker === 'district'
                ? t('dashboard.district')
                : t('dashboard.city')}
            </Text>
            <View style={s.pickerSearch}>
              <Feather name="search" size={f(19)} color={colors.textGray} />
              <TextInput
                value={pickerQuery}
                onChangeText={setPickerQuery}
                style={s.pickerSearchInput}
                placeholder={`${t('addGuardForm.search')} ${
                  picker === 'state'
                    ? t('dashboard.state')
                    : picker === 'district'
                    ? t('dashboard.district')
                    : t('dashboard.city')
                }`}
                placeholderTextColor={colors.textGray}
                autoCorrect={false}
              />
            </View>
            <ScrollView
              style={s.pickerList}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {locationsLoading ? (
                <View style={s.pickerMessage}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}
              {!locationsLoading && locationError ? (
                <Text style={s.pickerMessageText}>{locationError}</Text>
              ) : null}
              {!locationsLoading &&
                !locationError &&
                pickerOptions.map(option => (
                  <ScalePressable
                    key={option.slug}
                    style={s.option}
                    onPress={() => selectLocation(option)}
                    accessibilityRole="menuitem"
                  >
                    <Text style={s.optionText}>{option.name}</Text>
                    {option.name ===
                    (picker === 'state'
                      ? form.state
                      : picker === 'district'
                      ? form.district
                      : form.city) ? (
                      <Feather name="check" size={f(19)} color="#2563EB" />
                    ) : null}
                  </ScalePressable>
                ))}
              {!locationsLoading && !locationError && !pickerOptions.length ? (
                <Text style={s.pickerMessageText}>
                  {t('dashboard.noMatchingLocations')}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  onChangeText: (value: string) => void;
  style?: object;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none';
  maxLength?: number;
}> = ({
  label,
  value,
  icon,
  onChangeText,
  style,
  keyboardType,
  autoCapitalize,
  maxLength,
}) => (
  <View style={[s.field, style]}>
    <Text style={s.label}>{label}</Text>
    <View style={s.inputWrap}>
      {icon ? <Feather name={icon} size={f(19)} color="#A3A3A3" /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={s.input}
        placeholder={label}
        placeholderTextColor="#A3A3A3"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  </View>
);
const DropdownField: React.FC<{
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  open?: boolean;
  style?: object;
}> = ({ label, value, onPress, disabled, open, style }) => (
  <View style={[s.field, style]}>
    <Text style={s.label}>{label}</Text>
    <ScalePressable
      style={[s.inputWrap, disabled && s.disabledInput]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded: open }}
    >
      <Text style={[s.input, !value && s.placeholder]}>{value || label}</Text>
      <Feather
        name={open ? 'chevron-up' : 'chevron-down'}
        size={f(20)}
        color={colors.primary}
      />
    </ScalePressable>
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  content: { padding: w(16), paddingBottom: h(20) },
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
  initial: { color: '#B9640A', fontSize: f(36), fontWeight: '700' },
  camera: {
    position: 'absolute',
    right: -w(7),
    bottom: -w(4),
    width: w(34),
    height: w(34),
    borderRadius: w(17),
    backgroundColor: '#B9640A',
    borderWidth: w(3),
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { marginLeft: w(14), flex: 1 },
  name: { color: colors.primary, fontSize: f(27), fontWeight: '700' },
  accountId: { color: '#98A0AD', fontSize: f(16), marginTop: h(3) },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginHorizontal: -w(2),
  },
  section: {
    color: colors.primary,
    fontSize: f(19),
    fontWeight: '700',
    marginTop: h(20),
    marginBottom: h(13),
    borderLeftWidth: w(4),
    borderLeftColor: colors.gold,
    paddingLeft: w(9),
  },
  loading: {
    color: '#667085',
    textAlign: 'center',
    paddingVertical: h(40),
    fontSize: f(16),
  },
  field: { marginBottom: h(16) },
  label: {
    color: colors.primary,
    fontSize: f(19),
    fontWeight: '500',
    marginLeft: w(3),
    marginBottom: h(7),
  },
  inputWrap: {
    height: h(50),
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: w(8),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: w(12),
    gap: w(9),
  },
  disabledInput: { backgroundColor: '#F4F6F8', borderColor: '#D7DCE4' },
  input: { flex: 1, color: colors.primary, fontSize: f(16), padding: 0 },
  placeholder: { color: '#98A0AD' },
  twoCol: { flexDirection: 'row', gap: w(13) },
  half: { flex: 1 },
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
    fontSize: f(typography.sizes.lg),
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
    marginTop: spacing.md,
  },
  signOutText: {
    color: colors.status.danger,
    fontSize: f(typography.sizes.lg),
    fontWeight: typography.weights.semiBold,
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.45)',
    justifyContent: 'center',
    paddingHorizontal: w(24),
  },
  pickerSheet: {
    backgroundColor: colors.white,
    borderRadius: w(12),
    paddingVertical: h(10),
    borderWidth: 1,
    borderColor: '#D7DCE4',
  },
  pickerTitle: {
    color: colors.primary,
    fontSize: f(19),
    fontWeight: '700',
    paddingHorizontal: w(16),
    paddingBottom: h(10),
  },
  pickerSearch: {
    minHeight: h(44),
    marginHorizontal: w(12),
    marginBottom: h(8),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: w(8),
    paddingHorizontal: w(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: w(8),
  },
  pickerSearchInput: {
    flex: 1,
    minHeight: h(42),
    paddingVertical: 0,
    color: colors.primary,
    fontSize: f(16),
  },
  pickerList: { maxHeight: h(184) },
  pickerMessage: {
    minHeight: h(46),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerMessageText: {
    minHeight: h(46),
    paddingHorizontal: w(16),
    textAlignVertical: 'center',
    color: colors.textGray,
    fontSize: f(14),
  },
  option: {
    minHeight: h(46),
    paddingHorizontal: w(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  optionText: { color: colors.primary, fontSize: f(16) },
});

export default AgencyProfileScreen;
