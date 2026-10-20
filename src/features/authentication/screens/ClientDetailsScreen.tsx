import React, { useMemo, useState } from 'react';
import {
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
import { INDIAN_STATES_AND_UNION_TERRITORIES } from '../../../constants/indianStates';
import type { AuthStackParamList } from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { digitsOnly, isValidPincode } from '../../../utils/validation';
import { authService } from '../../../services/authService';
import { registrationDraft } from '../../../services/registrationDraft';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<AuthStackParamList, 'ClientDetails'>;

const ClientDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [stateQuery, setStateQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredStates = useMemo(
    () =>
      INDIAN_STATES_AND_UNION_TERRITORIES.filter(item =>
        item.toLowerCase().includes(stateQuery.trim().toLowerCase()),
      ),
    [stateQuery],
  );

  const handleContinue = async () => {
    if (companyName.trim().length < 2) {
      appAlert.alert(
        'Company name required',
        'Enter your company or organization name.',
        { type: 'error' },
      );
      return;
    }
    if (siteName.trim().length < 2) {
      appAlert.alert(
        t('details.siteNameRequired'),
        t('details.enterProperty'),
        { type: 'error' },
      );
      return;
    }
    if (siteAddress.trim().length < 5) {
      appAlert.alert(
        t('details.siteAddressRequired'),
        t('details.enterAddress'),
        { type: 'error' },
      );
      return;
    }
    if (city.trim().length < 2) {
      appAlert.alert(t('details.cityRequired'), t('details.enterYourCity'), {
        type: 'error',
      });
      return;
    }
    if (!state) {
      appAlert.alert(
        t('details.stateRequired'),
        t('details.selectStateTerritory'),
        { type: 'error' },
      );
      return;
    }
    if (!isValidPincode(pincode)) {
      appAlert.alert(
        t('details.invalidPincode'),
        t('details.enterValidPincode'),
        { type: 'error' },
      );
      return;
    }
    try {
      setIsSubmitting(true);
      registrationDraft.setProfile({
        companyName: companyName.trim(),
        siteName: siteName.trim(),
        siteAddress: siteAddress.trim(),
        city: city.trim(),
        state,
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
      appAlert.alert(
        'Could not continue',
        error instanceof Error ? error.message : 'Please try again.',
        { type: 'error' },
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

        <Text style={styles.heading}>{t('details.clientTitle')}</Text>
        <Text style={styles.subtitle}>{t('details.clientSubtitle')}</Text>

        <Text style={styles.companyLabel}>{t('details.companyName')}</Text>
        <TextInput
          value={companyName}
          onChangeText={setCompanyName}
          style={[styles.input, styles.companyInput]}
          placeholder={t('details.enterCompanyName')}
          placeholderTextColor="#A3A3A3"
        />

        <Text style={styles.siteNameLabel}>{t('details.siteName')}</Text>
        <TextInput
          value={siteName}
          onChangeText={setSiteName}
          style={[styles.input, styles.siteNameInput]}
          placeholder={t('details.enterSiteName')}
          placeholderTextColor="#A3A3A3"
        />

        <Text style={styles.siteAddressLabel}>{t('details.siteAddress')}</Text>
        <TextInput
          value={siteAddress}
          onChangeText={setSiteAddress}
          style={[styles.input, styles.siteAddressInput]}
          placeholder={t('details.enterSiteAddress')}
          placeholderTextColor="#A3A3A3"
        />

        <Text style={styles.cityLabel}>{t('dashboard.city')}</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          style={[styles.input, styles.cityInput]}
          placeholder={t('details.enterCity')}
          placeholderTextColor="#A3A3A3"
        />

        <Text style={styles.stateLabel}>{t('dashboard.state')}</Text>
        <TouchableOpacity
          style={[styles.input, styles.stateInput]}
          onPress={() => setStateOpen(current => !current)}
        >
          <Text style={[styles.selectText, !state && styles.placeholder]}>
            {state || 'Select state'}
          </Text>
          <Feather
            name={stateOpen ? 'chevron-up' : 'chevron-down'}
            size={scaleFont(24)}
            color={colors.primary}
          />
        </TouchableOpacity>

        {stateOpen && (
          <View style={styles.stateMenu}>
            <View style={styles.stateSearch}>
              <Feather name="search" size={scaleFont(21)} color="#A3A3A3" />
              <TextInput
                value={stateQuery}
                onChangeText={setStateQuery}
                style={styles.searchInput}
                placeholder={t('details.selectState')}
                placeholderTextColor="#A3A3A3"
              />
            </View>
            <ScrollView
              style={styles.stateList}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filteredStates.map(item => (
                <TouchableOpacity
                  key={item}
                  style={styles.stateOption}
                  onPress={() => {
                    setState(item);
                    setStateQuery('');
                    setStateOpen(false);
                  }}
                >
                  <Text style={styles.stateOptionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.pincodeLabel}>{t('dashboard.pincode')}</Text>
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
    height: scaleHeight(1032),
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
  companyLabel: {
    position: 'absolute',
    left: scaleWidth(29),
    top: scaleHeight(292),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  companyInput: { top: scaleHeight(322) },
  siteNameLabel: {
    position: 'absolute',
    left: scaleWidth(27),
    top: scaleHeight(396),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  siteNameInput: { top: scaleHeight(426) },
  siteAddressLabel: {
    position: 'absolute',
    left: scaleWidth(27),
    top: scaleHeight(495),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  siteAddressInput: { top: scaleHeight(524) },
  cityLabel: {
    position: 'absolute',
    left: scaleWidth(27),
    top: scaleHeight(593),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  cityInput: {
    left: scaleWidth(19),
    top: scaleHeight(623),
    width: scaleWidth(173),
  },
  stateLabel: {
    position: 'absolute',
    left: scaleWidth(215),
    top: scaleHeight(593),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  stateInput: {
    left: scaleWidth(209),
    top: scaleHeight(623),
    width: scaleWidth(173),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: scaleFont(16), color: colors.primary },
  placeholder: { color: '#A3A3A3' },
  stateMenu: {
    position: 'absolute',
    left: scaleWidth(19),
    top: scaleHeight(688),
    width: scaleWidth(363),
    height: scaleHeight(237),
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 3, height: 9 },
  },
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
  pincodeLabel: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(690),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  pincodeInput: { top: scaleHeight(721) },
  continueButton: {
    position: 'absolute',
    left: scaleWidth(19),
    top: scaleHeight(803),
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

export default ClientDetailsScreen;
