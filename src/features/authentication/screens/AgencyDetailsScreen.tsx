import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LanguageSelector from '../../../components/common/LanguageSelector';
import type { AuthStackParamList } from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { digitsOnly, isValidPincode } from '../../../utils/validation';
import { authService } from '../../../services/authService';
import { registrationDraft } from '../../../services/registrationDraft';
import {
  indiaLocationService,
  type IndiaLocationOption,
} from '../../../services/indiaLocationService';

type Props = NativeStackScreenProps<AuthStackParamList, 'AgencyDetails'>;

const BUSINESS_TYPES = [
  { label: 'Private Limited Company', icon: 'briefcase' },
  { label: 'Partnership', icon: 'users' },
  { label: 'Proprietorship', icon: 'user' },
  { label: 'LLP (Limited Liability Partnership)', icon: 'briefcase' },
  { label: 'Public Limited Company', icon: 'home' },
  { label: 'Other', icon: 'help-circle' },
] as const;

const AgencyDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [agencyName, setAgencyName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [businessOpen, setBusinessOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState<
    'state' | 'district' | 'city' | null
  >(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [states, setStates] = useState<IndiaLocationOption[]>([]);
  const [districts, setDistricts] = useState<IndiaLocationOption[]>([]);
  const [cities, setCities] = useState<IndiaLocationOption[]>([]);
  const [stateSlug, setStateSlug] = useState('');
  const [districtSlug, setDistrictSlug] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
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
  }, []);

  const locationOptions = useMemo(() => {
    const options =
      locationOpen === 'state'
        ? states
        : locationOpen === 'district'
        ? districts
        : cities;
    const query = locationQuery.trim().toLowerCase();
    return options.filter(option => option.name.toLowerCase().includes(query));
  }, [cities, districts, locationOpen, locationQuery, states]);

  const toggleBusinessMenu = () => {
    setBusinessOpen(current => !current);
    setLocationOpen(null);
  };

  const openLocationMenu = async (menu: 'state' | 'district' | 'city') => {
    if (locationOpen === menu) {
      setLocationOpen(null);
      return;
    }

    setLocationQuery('');
    setBusinessOpen(false);
    setLocationError(null);
    setLocationOpen(menu);

    try {
      setLocationLoading(true);
      if (menu === 'state' && !states.length) {
        setStates(await indiaLocationService.getStates());
      } else if (menu === 'district' && stateSlug) {
        setDistricts(await indiaLocationService.getDistricts(stateSlug));
      } else if (menu === 'city' && stateSlug && districtSlug) {
        setCities(
          await indiaLocationService.getCities(stateSlug, districtSlug),
        );
      }
    } catch {
      setLocationError('Unable to load locations. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const selectLocation = (option: IndiaLocationOption) => {
    if (locationOpen === 'state') {
      setState(option.name);
      setStateSlug(option.slug);
      setDistrict('');
      setDistrictSlug('');
      setCity('');
      setDistricts([]);
      setCities([]);
    } else if (locationOpen === 'district') {
      setDistrict(option.name);
      setDistrictSlug(option.slug);
      setCity('');
      setCities([]);
    } else if (locationOpen === 'city') {
      setCity(option.name);
    }
    setLocationOpen(null);
    setLocationQuery('');
  };

  const handleContinue = async () => {
    if (agencyName.trim().length < 2) {
      Alert.alert(
        t('details.agencyNameRequired'),
        t('details.enterAgencyCompany'),
      );
      return;
    }
    if (!businessType) {
      Alert.alert(t('details.businessRequired'), t('details.selectBusiness'));
      return;
    }
    if (gstNumber && !/^[A-Z0-9]{15}$/.test(gstNumber.trim().toUpperCase())) {
      Alert.alert(
        'Invalid GST number',
        'Enter a valid 15-character GST number or leave it blank.',
      );
      return;
    }
    if (officeAddress.trim().length < 5) {
      Alert.alert(t('details.officeRequired'), t('details.enterOffice'));
      return;
    }
    if (city.trim().length < 2) {
      Alert.alert(t('details.cityRequired'), t('details.enterYourCity'));
      return;
    }
    if (!state) {
      Alert.alert(
        t('details.stateRequired'),
        t('details.selectStateTerritory'),
      );
      return;
    }
    if (!district) {
      Alert.alert(t('details.districtRequired'), t('details.selectDistrict'));
      return;
    }
    if (!isValidPincode(pincode)) {
      Alert.alert(t('details.invalidPincode'), t('details.enterValidPincode'));
      return;
    }
    try {
      setIsSubmitting(true);
      registrationDraft.setProfile({
        agencyName: agencyName.trim(),
        businessType,
        gstNumber: gstNumber.trim().toUpperCase(),
        officeAddress: officeAddress.trim(),
        city: city.trim(),
        state,
        district,
        pincode,
      });
      const mobile = registrationDraft.get()?.mobile_number;
      if (!mobile)
        throw new Error(
          'Your mobile number is missing. Please create the account again.',
        );
      await authService.sendMobileOtp(mobile);
      navigation.navigate('VerifyMobile');
    } catch (error) {
      Alert.alert(
        'Could not continue',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          // Only the in-flow LanguageSelector sits at the top of this content
          // (back button + logo are absolutely positioned below), so a top
          // inset here seats the button under the status bar without shifting
          // the rest of the screen.
          { paddingTop: insets.top + scaleHeight(8) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('auth.goBack')}
        >
          <Feather name="arrow-left" size={scaleFont(26)} color="#000000" />
        </TouchableOpacity>

        <LanguageSelector />

        <Image
          source={require('../../../assets/images/login-shield-logo.png')}
          style={styles.logo}
          resizeMode="cover"
        />

        <Text style={styles.heading}>{t('details.agencyTitle')}</Text>
        <Text style={styles.subtitle}>{t('details.agencySubtitle')}</Text>

        <Text style={styles.labelAgencyName}>{t('details.agencyName')}</Text>
        <TextInput
          value={agencyName}
          onChangeText={setAgencyName}
          style={[styles.input, styles.agencyNameInput]}
          placeholder={t('details.enterAgencyName')}
          placeholderTextColor="#A3A3A3"
        />

        <Text style={styles.labelBusinessType}>
          {t('details.businessType')}
        </Text>
        <TouchableOpacity
          style={[styles.input, styles.businessInput]}
          onPress={toggleBusinessMenu}
        >
          <Text
            style={[styles.selectText, !businessType && styles.placeholder]}
          >
            {businessType || 'Select business type'}
          </Text>
          <Feather
            name={businessOpen ? 'chevron-up' : 'chevron-down'}
            size={scaleFont(24)}
            color={colors.primary}
          />
        </TouchableOpacity>

        {businessOpen && (
          <View style={styles.businessMenu}>
            {BUSINESS_TYPES.map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.businessOption}
                onPress={() => {
                  setBusinessType(item.label);
                  setBusinessOpen(false);
                }}
              >
                <Feather
                  name={item.icon}
                  size={scaleFont(21)}
                  color={colors.gold}
                />
                <Text style={styles.businessOptionText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.labelGst}>{t('details.gstNumber')}</Text>
        <TextInput
          value={gstNumber}
          onChangeText={setGstNumber}
          style={[styles.input, styles.gstInput]}
          placeholder={t('details.enterGst')}
          placeholderTextColor="#A3A3A3"
          autoCapitalize="characters"
        />

        <Text style={styles.labelOfficeAddress}>
          {t('details.officeAddress')}
        </Text>
        <TextInput
          value={officeAddress}
          onChangeText={setOfficeAddress}
          style={[styles.input, styles.officeInput]}
          placeholder={t('details.enterOfficeAddress')}
          placeholderTextColor="#A3A3A3"
        />

        <Text style={styles.labelState}>{t('dashboard.state')}</Text>
        <TouchableOpacity
          style={[styles.input, styles.stateInput]}
          onPress={() => void openLocationMenu('state')}
        >
          <Text style={[styles.selectText, !state && styles.placeholder]}>
            {state || 'Select state'}
          </Text>
          <Feather
            name={locationOpen === 'state' ? 'chevron-up' : 'chevron-down'}
            size={scaleFont(24)}
            color={colors.primary}
          />
        </TouchableOpacity>

        <Text style={styles.labelDistrict}>{t('dashboard.district')}</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.districtInput,
            !state && styles.disabledInput,
          ]}
          onPress={() => state && void openLocationMenu('district')}
          disabled={!state}
        >
          <Text style={[styles.selectText, !district && styles.placeholder]}>
            {district || 'Select district'}
          </Text>
          <Feather
            name={locationOpen === 'district' ? 'chevron-up' : 'chevron-down'}
            size={scaleFont(24)}
            color={colors.primary}
          />
        </TouchableOpacity>

        <Text style={styles.labelCity}>{t('dashboard.city')}</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.cityInput,
            !district && styles.disabledInput,
          ]}
          onPress={() => district && void openLocationMenu('city')}
          disabled={!district}
        >
          <Text style={[styles.selectText, !city && styles.placeholder]}>
            {city || 'Select city'}
          </Text>
          <Feather
            name={locationOpen === 'city' ? 'chevron-up' : 'chevron-down'}
            size={scaleFont(24)}
            color={colors.primary}
          />
        </TouchableOpacity>

        {locationOpen && (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dropdownBackdrop}
            onPress={() => setLocationOpen(null)}
            accessibilityLabel={t('details.closeLocations')}
          />
        )}

        {locationOpen && (
          <View
            style={[
              styles.locationMenu,
              locationOpen === 'state'
                ? styles.stateMenu
                : locationOpen === 'district'
                ? styles.districtMenu
                : styles.cityMenu,
            ]}
          >
            <View style={styles.stateSearch}>
              <Feather name="search" size={scaleFont(21)} color="#A3A3A3" />
              <TextInput
                value={locationQuery}
                onChangeText={setLocationQuery}
                style={styles.searchInput}
                placeholder={`Search ${locationOpen}`}
                placeholderTextColor="#A3A3A3"
              />
            </View>
            <ScrollView
              style={styles.stateList}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {locationLoading ? (
                <Text style={styles.noLocation}>
                  {t('details.loadingLocations')}
                </Text>
              ) : null}
              {!locationLoading && locationError ? (
                <Text style={styles.noLocation}>{locationError}</Text>
              ) : null}
              {!locationLoading &&
                !locationError &&
                locationOptions.map(option => (
                  <TouchableOpacity
                    key={option.slug}
                    style={styles.stateOption}
                    onPress={() => selectLocation(option)}
                  >
                    <Text style={styles.stateOptionText}>{option.name}</Text>
                  </TouchableOpacity>
                ))}
              {!locationLoading && !locationError && !locationOptions.length ? (
                <Text style={styles.noLocation}>
                  No matching locations found.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        )}

        <Text style={styles.labelPincode}>{t('dashboard.pincode')}</Text>
        <TextInput
          value={pincode}
          onChangeText={value => setPincode(digitsOnly(value).slice(0, 6))}
          style={[styles.input, styles.pincodeInput]}
          placeholder={t('details.enterPincode')}
          placeholderTextColor="#A3A3A3"
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.continueButton, isSubmitting && { opacity: 0.65 }]}
          onPress={handleContinue}
          disabled={isSubmitting}
        >
          <Text style={styles.continueText}>
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: {
    width: scaleWidth(402),
    height: scaleHeight(1210),
    backgroundColor: colors.white,
  },
  backButton: {
    position: 'absolute',
    left: scaleWidth(19),
    top: scaleHeight(50),
    width: scaleWidth(26),
    height: scaleHeight(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    left: scaleWidth(150),
    top: scaleHeight(80),
    width: scaleWidth(101),
    height: scaleHeight(101),
  },
  heading: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(190),
    width: scaleWidth(355),
    textAlign: 'center',
    fontSize: scaleFont(42),
    lineHeight: scaleFont(51),
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(239),
    width: scaleWidth(355),
    textAlign: 'center',
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    color: colors.primary,
  },
  input: {
    position: 'absolute',
    left: scaleWidth(19),
    width: scaleWidth(363),
    height: scaleHeight(50),
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: scaleWidth(13),
    fontSize: scaleFont(16),
    color: colors.primary,
  },
  labelAgencyName: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(292),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  agencyNameInput: { top: scaleHeight(322) },
  labelBusinessType: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(396),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  businessInput: {
    top: scaleHeight(426),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: scaleFont(16), color: colors.primary },
  placeholder: { color: '#A3A3A3' },
  businessMenu: {
    position: 'absolute',
    left: scaleWidth(19),
    top: scaleHeight(484),
    width: scaleWidth(363),
    height: scaleHeight(205),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: scaleHeight(7),
    zIndex: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 3, height: 9 },
  },
  businessOption: {
    height: scaleHeight(32),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(9),
    gap: scaleWidth(9),
  },
  businessOptionText: { fontSize: scaleFont(20), color: '#000000' },
  labelGst: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(497),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  gstInput: { top: scaleHeight(524) },
  labelOfficeAddress: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(594),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  officeInput: { top: scaleHeight(624) },
  labelCity: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(897),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  cityInput: {
    top: scaleHeight(927),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelState: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(693),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  stateInput: {
    top: scaleHeight(724),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelDistrict: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(795),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  districtInput: {
    top: scaleHeight(825),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabledInput: { opacity: 0.55 },
  locationMenu: {
    position: 'absolute',
    left: scaleWidth(19),
    width: scaleWidth(363),
    height: scaleHeight(163),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    zIndex: 30,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 3, height: 9 },
  },
  dropdownBackdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: scaleWidth(402),
    height: scaleHeight(1210),
    zIndex: 25,
  },
  stateMenu: { top: scaleHeight(783) },
  districtMenu: { top: scaleHeight(884) },
  cityMenu: { top: scaleHeight(986) },
  stateSearch: {
    height: scaleHeight(39),
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingHorizontal: scaleWidth(13),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(7),
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontSize: scaleFont(20),
    color: colors.primary,
  },
  stateList: { flex: 1 },
  stateOption: {
    height: scaleHeight(31),
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(23),
  },
  stateOptionText: { fontSize: scaleFont(20), color: '#000000' },
  noLocation: {
    padding: scaleWidth(16),
    fontSize: scaleFont(16),
    color: '#666666',
  },
  labelPincode: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(998),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  pincodeInput: { top: scaleHeight(1028) },
  continueButton: {
    position: 'absolute',
    left: scaleWidth(19),
    top: scaleHeight(1128),
    width: scaleWidth(363),
    height: scaleHeight(50),
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.white,
  },
});

export default AgencyDetailsScreen;
