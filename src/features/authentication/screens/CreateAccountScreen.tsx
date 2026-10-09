import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import LanguageSelector from '../../../components/common/LanguageSelector';
import type {
  AuthStackParamList,
  RootStackParamList,
} from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import {
  isValidEmail,
  isValidIndianMobile,
  passwordError,
  digitsOnly,
} from '../../../utils/validation';
import { authService } from '../../../services/authService';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;
type AccountType = 'agency' | 'client';

const CreateAccountScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const forceAccountType = route.params?.forceAccountType;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>(
    forceAccountType ?? 'agency',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cancel = () => {
    if (forceAccountType === 'agency') {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.reset({
          index: 0,
          routes: [{ name: 'SuperAdminFlow' }],
        });
      return;
    }
    navigation.goBack();
  };

  const handleContinue = async () => {
    if (name.trim().length < 2) {
      Alert.alert(t('auth.invalidName'), t('auth.enterFullName'));
      return;
    }
    if (!isValidIndianMobile(mobile)) {
      Alert.alert(t('auth.invalidMobile'), t('auth.enterValidMobile'));
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert(t('auth.invalidEmail'), t('auth.enterValidEmail'));
      return;
    }
    const error = passwordError(password);
    if (error) {
      Alert.alert(t('auth.invalidPassword'), error);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('auth.passwordsMismatch'), t('auth.confirmMustMatch'));
      return;
    }
    try {
      setIsSubmitting(true);
      await authService.startRegistration(
        {
          full_name: name.trim(),
          mobile_number: mobile,
          email: email.trim().toLowerCase(),
          password,
          account_type: accountType,
        },
        forceAccountType === 'agency' ? 'superAdmin' : 'self',
      );
      navigation.navigate(
        accountType === 'agency' ? 'AgencyDetails' : 'ClientDetails',
      );
    } catch (error) {
      Alert.alert(
        t('auth.accountFailed'),
        error instanceof Error ? error.message : t('auth.tryAgain'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      {/* Language pill floats above the header; content wrapper reserves
          vertical room so it never overlaps the back button or logo. */}
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scaleHeight(8) : 0}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.topBar}>
          {forceAccountType ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={cancel}
              accessibilityLabel={t('auth.backToSuperAdmin')}
            >
              <Feather
                name="arrow-left"
                size={scaleFont(26)}
                color={colors.primary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <LanguageSelector />
        </View>

        <Image
          source={require('../../../assets/images/login-shield-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.heading}>{t('auth.createAccount')}</Text>
        <Text style={styles.subtitle}>{t('auth.createSubtitle')}</Text>

        {!forceAccountType ? (
          <View style={styles.authTabs}>
            <TouchableOpacity style={styles.inactiveTab} onPress={cancel}>
              <Text style={styles.inactiveTabText}>{t('auth.login')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.activeTab}>
              <Text style={styles.activeTabText}>
                {t('auth.createAccount')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>{t('auth.fullName')}</Text>
        <FormInput
          icon="user"
          value={name}
          onChangeText={setName}
          placeholder={t('auth.exampleName')}
        />

        <Text style={styles.fieldLabel}>{t('auth.mobileNumber')}</Text>
        <FormInput
          icon="phone"
          value={mobile}
          onChangeText={value => setMobile(digitsOnly(value).slice(0, 10))}
          placeholder="+91 9800 000 000"
          keyboardType="phone-pad"
        />

        <Text style={styles.fieldLabel}>{t('auth.emailAddress')}</Text>
        <FormInput
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="abc@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          visible={passwordVisible}
          onToggleVisibility={() => setPasswordVisible(current => !current)}
          placeholder={t('auth.enterPassword')}
        />

        <Text style={styles.fieldLabel}>
          {t('auth.confirmPassword')}
        </Text>
        <PasswordInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          visible={confirmPasswordVisible}
          onToggleVisibility={() =>
            setConfirmPasswordVisible(current => !current)
          }
          placeholder={t('auth.enterPassword')}
        />

        <Text style={styles.accountTypeLabel}>
          {forceAccountType
            ? t('auth.accountType')
            : t('auth.chooseAccountType')}
        </Text>
        <View style={styles.accountTypeRow}>
          <AccountTypeCard
            active={accountType === 'agency'}
            icon="grid"
            title={t('auth.agency')}
            description={t('auth.agencyDescription')}
            onPress={() => setAccountType('agency')}
            fullWidth={forceAccountType === 'agency'}
          />
          {!forceAccountType ? (
            <AccountTypeCard
              active={accountType === 'client'}
              icon="user"
              title={t('auth.client')}
              description={t('auth.clientDescription')}
              onPress={() => setAccountType('client')}
            />
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, isSubmitting && { opacity: 0.65 }]}
          onPress={handleContinue}
          disabled={isSubmitting}
        >
          <Text style={styles.continueText}>
            {isSubmitting ? t('auth.creatingAccount') : t('common.continue')}
          </Text>
        </TouchableOpacity>

        {!forceAccountType ? (
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>{t('auth.alreadyAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}> {t('auth.login')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

type FormInputProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none';
};

const FormInput: React.FC<FormInputProps> = ({
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}) => (
  <View style={styles.inputWrapper}>
    <Feather name={icon} size={scaleFont(24)} color="#A3A3A3" />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="#A3A3A3"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
    />
  </View>
);

type PasswordInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  placeholder: string;
};

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChangeText,
  visible,
  onToggleVisibility,
  placeholder,
}) => (
  <View style={styles.inputWrapper}>
    <Feather name="lock" size={scaleFont(24)} color="#A3A3A3" />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="#A3A3A3"
      secureTextEntry={!visible}
      autoCapitalize="none"
    />
    <TouchableOpacity
      style={styles.eyeButton}
      onPress={onToggleVisibility}
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      <Feather
        name={visible ? 'eye-off' : 'eye'}
        size={scaleFont(24)}
        color={colors.primary}
      />
    </TouchableOpacity>
  </View>
);

type AccountTypeCardProps = {
  active: boolean;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  onPress: () => void;
  fullWidth?: boolean;
};

const AccountTypeCard: React.FC<AccountTypeCardProps> = ({
  active,
  icon,
  title,
  description,
  onPress,
  fullWidth,
}) => (
  <TouchableOpacity
    style={[
      styles.accountTypeCard,
      fullWidth && styles.accountTypeCardFull,
      active && styles.accountTypeCardActive,
    ]}
    onPress={onPress}
  >
    <Feather
      name={icon}
      size={scaleFont(50)}
      color={active ? colors.white : colors.primary}
    />
    <Text
      style={[styles.accountTypeTitle, active && styles.accountTypeTextActive]}
    >
      {title}
    </Text>
    <Text
      style={[
        styles.accountTypeDescription,
        active && styles.accountTypeTextActive,
      ]}
    >
      {description}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.white,
    paddingHorizontal: scaleWidth(19),
    paddingBottom: scaleHeight(32),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: scaleHeight(44),
    paddingTop: scaleHeight(4),
    marginBottom: scaleHeight(4),
  },
  backButton: {
    width: scaleWidth(44),
    height: scaleHeight(44),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  backButtonPlaceholder: { width: scaleWidth(44), height: scaleHeight(44) },
  logo: {
    alignSelf: 'center',
    width: scaleWidth(101),
    height: scaleHeight(101),
    marginTop: scaleHeight(8),
  },
  heading: {
    marginTop: scaleHeight(8),
    textAlign: 'center',
    fontSize: scaleFont(42),
    lineHeight: scaleFont(51),
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    marginTop: scaleHeight(4),
    textAlign: 'center',
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    color: colors.primary,
  },
  authTabs: {
    marginTop: scaleHeight(16),
    height: scaleHeight(45),
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  activeTab: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabText: {
    fontSize: scaleFont(20),
    fontWeight: '600',
    color: colors.white,
  },
  inactiveTabText: {
    fontSize: scaleFont(20),
    fontWeight: '600',
    color: colors.primary,
  },
  fieldLabel: {
    marginTop: scaleHeight(20),
    marginBottom: scaleHeight(6),
    marginLeft: scaleWidth(4),
    fontSize: scaleFont(22),
    fontWeight: '500',
    color: colors.primary,
  },
  inputWrapper: {
    minHeight: scaleHeight(50),
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: scaleWidth(13),
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: scaleHeight(48),
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(8),
    fontSize: scaleFont(16),
    color: colors.primary,
  },
  eyeButton: {
    minHeight: scaleHeight(48),
    paddingHorizontal: scaleWidth(16),
    justifyContent: 'center',
  },
  accountTypeLabel: {
    marginTop: scaleHeight(24),
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: colors.primary,
  },
  accountTypeRow: {
    marginTop: scaleHeight(12),
    flexDirection: 'row',
    gap: scaleWidth(13),
  },
  accountTypeCard: {
    flex: 1,
    minWidth: 0,
    minHeight: scaleHeight(148),
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleWidth(12),
  },
  accountTypeCardFull: { flex: 1 },
  accountTypeCardActive: { backgroundColor: colors.primary },
  accountTypeTitle: {
    marginTop: scaleHeight(5),
    fontSize: scaleFont(24),
    fontWeight: '600',
    color: colors.primary,
  },
  accountTypeDescription: {
    marginTop: scaleHeight(3),
    textAlign: 'center',
    fontSize: scaleFont(16),
    lineHeight: scaleFont(18),
    color: colors.primary,
  },
  accountTypeTextActive: { color: colors.white },
  continueButton: {
    marginTop: scaleHeight(28),
    minHeight: scaleHeight(50),
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(10),
  },
  continueText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  loginRow: {
    marginTop: scaleHeight(20),
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  loginPrompt: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: colors.primary,
  },
  loginLink: { fontSize: scaleFont(20), fontWeight: '700', color: '#2563EB' },
});

export default CreateAccountScreen;
