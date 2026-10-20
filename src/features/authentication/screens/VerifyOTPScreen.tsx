import React, { useEffect, useRef, useState } from 'react';
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
import { isCompleteOtp } from '../../../utils/validation';
import { authService } from '../../../services/authService';
import { session } from '../../../services/session';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOTP'>;

const OTP_LENGTH = 6;

const VerifyOTPScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [identifier, setIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputs = useRef<Array<React.ComponentRef<typeof TextInput> | null>>([]);

  useEffect(() => {
    session.getPendingIdentifier().then(value => setIdentifier(value || ''));
  }, []);

  const updateOtp = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    const nextOtp = [...otp];

    if (digits.length > 1) {
      digits
        .slice(0, OTP_LENGTH - index)
        .split('')
        .forEach((digit, offset) => {
          nextOtp[index + offset] = digit;
        });
      setOtp(nextOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputs.current[nextIndex]?.focus();
      return;
    }

    nextOtp[index] = digits;
    setOtp(nextOtp);

    if (digits && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key !== 'Backspace') {
      return;
    }

    if (otp[index]) {
      const nextOtp = [...otp];
      nextOtp[index] = '';
      setOtp(nextOtp);
      return;
    }

    if (index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if (!isCompleteOtp(otp)) {
      appAlert.alert(t('auth.invalidOtp'), t('auth.completeOtp'), {
        type: 'error',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      const identifier = await session.getPendingIdentifier();
      if (!identifier)
        throw new Error('Your reset session has expired. Request a new OTP.');
      await authService.verifyForgotPasswordOtp(identifier, otp.join(''));
      navigation.navigate('CreateNewPassword');
    } catch (error) {
      appAlert.alert(
        t('auth.verificationFailed'),
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

          <Text style={styles.heading}>{t('auth.verifyOtp')}</Text>
          <Text style={styles.subtitle}>{t('auth.enterCodeSent')}</Text>
          <Text style={styles.phoneNumber}>
            {identifier || t('auth.identifierFallback')}
          </Text>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={input => {
                  inputs.current[index] = input;
                }}
                value={digit}
                onChangeText={value => updateOtp(value, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                selectTextOnFocus
                accessibilityLabel={t('auth.otpDigit', { number: index + 1 })}
              />
            ))}
          </View>

          <Text style={styles.didNotReceive}>{t('auth.didNotReceive')}</Text>
          <View style={styles.resendRow}>
            <TouchableOpacity>
              <Text style={styles.resendLink}>{t('auth.resendOtp')}</Text>
            </TouchableOpacity>
            <Text style={styles.resendTimer}> {t('auth.resendIn')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, isSubmitting && { opacity: 0.65 }]}
            onPress={handleVerifyOtp}
            disabled={isSubmitting}
          >
            <Text style={styles.verifyButtonText}>
              {isSubmitting ? t('auth.verifying') : t('auth.verifyContinue')}
            </Text>
          </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  logo: {
    alignSelf: 'center',
    width: scaleWidth(101),
    height: scaleHeight(101),
    marginTop: scaleHeight(8),
  },
  heading: {
    marginTop: scaleHeight(16),
    textAlign: 'center',
    fontSize: scaleFont(32),
    lineHeight: scaleFont(39),
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
  phoneNumber: {
    marginTop: scaleHeight(8),
    textAlign: 'center',
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    fontWeight: '700',
    color: colors.primary,
  },
  otpRow: {
    marginTop: scaleHeight(24),
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scaleWidth(10),
    flexWrap: 'wrap',
  },
  otpInput: {
    flex: 1,
    minWidth: scaleWidth(44),
    maxWidth: scaleWidth(56),
    minHeight: scaleHeight(49),
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 0,
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: '#000000',
  },
  didNotReceive: {
    marginTop: scaleHeight(24),
    textAlign: 'center',
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    color: colors.primary,
  },
  resendRow: {
    marginTop: scaleHeight(4),
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resendLink: {
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    fontWeight: '700',
    color: '#2563EB',
  },
  resendTimer: {
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    color: colors.primary,
  },
  verifyButton: {
    marginTop: scaleHeight(32),
    minHeight: scaleHeight(50),
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(10),
  },
  verifyButtonText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
});

export default VerifyOTPScreen;
