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
import { passwordError } from '../../../utils/validation';
import { authService } from '../../../services/authService';
import { session } from '../../../services/session';
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateNewPassword'>;

const CreateNewPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async () => {
    const error = passwordError(newPassword);
    if (error) {
      appAlert.error(t('auth.invalidPassword'), error);
      return;
    }
    if (newPassword !== confirmPassword) {
      appAlert.error(
        t('auth.passwordsMismatch'),
        'Confirm password must match the new password.',
      );
      return;
    }
    try {
      setIsSubmitting(true);
      const identifier = await session.getPendingIdentifier();
      if (!identifier)
        throw new Error('Your reset session has expired. Request a new OTP.');
      await authService.resetPassword(identifier, newPassword, confirmPassword);
      navigation.navigate('PasswordUpdated');
    } catch (error) {
      appAlert.error(
        'Could not reset password',
        error instanceof Error ? error.message : 'Please try again.',
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

          <Text style={styles.heading}>Create New{`\n`}Password</Text>
          <Text style={styles.subtitle}>{t('auth.newPasswordSubtitle')}</Text>

          <Text style={styles.fieldLabel}>{t('auth.newPassword')}</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={scaleFont(24)} color="#A3A3A3" />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              placeholder={t('auth.enterNewPassword')}
              placeholderTextColor="#A3A3A3"
              secureTextEntry={!newPasswordVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setNewPasswordVisible(current => !current)}
              accessibilityLabel={
                newPasswordVisible ? 'Hide password' : 'Show password'
              }
            >
              <Feather
                name={newPasswordVisible ? 'eye-off' : 'eye'}
                size={scaleFont(24)}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>{t('auth.confirmPassword')}</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={scaleFont(24)} color="#A3A3A3" />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              placeholder={t('auth.confirmNewPassword')}
              placeholderTextColor="#A3A3A3"
              secureTextEntry={!confirmPasswordVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setConfirmPasswordVisible(current => !current)}
              accessibilityLabel={
                confirmPasswordVisible ? 'Hide password' : 'Show password'
              }
            >
              <Feather
                name={confirmPasswordVisible ? 'eye-off' : 'eye'}
                size={scaleFont(24)}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.resetButton, isSubmitting && { opacity: 0.65 }]}
            onPress={handleResetPassword}
            disabled={isSubmitting}
          >
            <Text style={styles.resetButtonText}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Text>
          </TouchableOpacity>

          <View style={styles.rememberRow}>
            <Text style={styles.rememberText}>
              {t('auth.rememberPassword')}
            </Text>
            <TouchableOpacity onPress={() => navigation.popToTop()}>
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
  resetButton: {
    marginTop: scaleHeight(28),
    minHeight: scaleHeight(50),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: scaleHeight(10),
  },
  resetButtonText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  rememberRow: {
    marginTop: scaleHeight(28),
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

export default CreateNewPasswordScreen;
