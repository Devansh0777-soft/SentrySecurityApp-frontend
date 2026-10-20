import React, { useState } from 'react';
import {
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
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import LanguageSelector from '../../../components/common/LanguageSelector';
import type { AuthStackParamList } from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { isValidIdentifier } from '../../../utils/validation';
import { authService } from '../../../services/authService';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOtp = async () => {
    if (!isValidIdentifier(identifier)) {
      appAlert.alert(t('auth.invalidDetails'), t('auth.enterValidIdentifier'), {
        type: 'error',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      await authService.requestPasswordReset(identifier.trim());
      navigation.navigate('VerifyOTP');
    } catch (error) {
      appAlert.alert(
        t('auth.couldNotSendOtp'),
        error instanceof Error ? error.message : t('auth.tryAgain'),
        { type: 'error' },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scaleHeight(8) : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('auth.goBack')}
            >
              <Feather name="arrow-left" size={scaleFont(26)} color="#000000" />
            </TouchableOpacity>
            <LanguageSelector />
          </View>

          <Image
            source={require('../../../assets/images/login-shield-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.heading}>{t('auth.forgotTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.forgotSubtitle')}</Text>

          <Text style={styles.fieldLabel}>{t('auth.emailOrMobile')}</Text>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={scaleFont(24)} color="#A3A3A3" />
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              style={styles.input}
              placeholder={t('auth.identifierPlaceholder')}
              placeholderTextColor="#A3A3A3"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <TouchableOpacity
            style={[styles.sendOtpButton, isSubmitting && { opacity: 0.65 }]}
            onPress={handleSendOtp}
            disabled={isSubmitting}
          >
            <Text style={styles.sendOtpText}>
              {isSubmitting ? t('auth.sending') : t('auth.sendOtp')}
            </Text>
          </TouchableOpacity>

          <View style={styles.rememberRow}>
            <Text style={styles.rememberText}>
              {t('auth.rememberPassword')}
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}> {t('auth.login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
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
  fieldLabel: {
    marginTop: scaleHeight(32),
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
  sendOtpButton: {
    marginTop: scaleHeight(28),
    minHeight: scaleHeight(50),
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(10),
  },
  sendOtpText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  rememberRow: {
    marginTop: scaleHeight(24),
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  rememberText: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: colors.primary,
  },
  loginLink: { fontSize: scaleFont(20), fontWeight: '700', color: '#2563EB' },
});

export default ForgotPasswordScreen;
