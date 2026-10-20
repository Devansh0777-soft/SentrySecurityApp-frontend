import React, { useState } from 'react';
import {
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
import { appAlert } from '../../../services/alertService';

type Props = NativeStackScreenProps<
  GuardStackParamList,
  'GuardEmergencyContact'
>;

const GuardEmergencyContactScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = (): string | null => {
    if (!contactName.trim()) {
      return t('guardProfile.validation.contactNameRequired');
    }
    if (!relationship.trim()) {
      return t('guardProfile.validation.relationshipRequired');
    }
    if (contactPhone.replace(/\D/g, '').length !== 10) {
      return t('guardProfile.validation.contactPhoneInvalid');
    }
    return null;
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      appAlert.alert(t('guardProfile.emergencyContact'), validationError, {
        type: 'error',
      });
      return;
    }
    try {
      setSaving(true);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
      appAlert.alert(
        t('guardProfile.emergencySaved'),
        t('guardProfile.emergencySavedHint'),
        { type: 'success' },
      );
    } finally {
      setSaving(false);
    }
  };

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
          {t('guardProfile.emergencyContact')}
        </Text>
        <View style={s.iconButton} />
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
          <View>
            <Text style={s.fieldLabel}>{t('guardProfile.contactName')}</Text>
            <TextInput
              value={contactName}
              onChangeText={setContactName}
              style={s.fieldBox}
              placeholderTextColor={colors.textGray}
              autoCapitalize="words"
            />
          </View>

          <View>
            <Text style={s.fieldLabel}>{t('guardProfile.relationship')}</Text>
            <TextInput
              value={relationship}
              onChangeText={setRelationship}
              style={s.fieldBox}
              placeholderTextColor={colors.textGray}
              autoCapitalize="words"
            />
          </View>

          <View>
            <Text style={s.fieldLabel}>{t('guardProfile.contactPhone')}</Text>
            <TextInput
              value={contactPhone}
              onChangeText={text =>
                setContactPhone(text.replace(/\D/g, '').slice(0, 10))
              }
              style={s.fieldBox}
              placeholderTextColor={colors.textGray}
              keyboardType="number-pad"
            />
          </View>

          <ScalePressable
            style={[s.button, s.saveButton, saving && s.buttonDisabled]}
            onPress={save}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t('guardProfile.saveChanges')}
          >
            <Text style={s.saveText}>
              {saving
                ? t('guardProfile.saving')
                : t('guardProfile.saveChanges')}
            </Text>
          </ScalePressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
  fieldLabel: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: f(typography.sizes.md),
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
  button: {
    minHeight: h(52),
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: h(4),
  },
  buttonDisabled: { opacity: 0.6 },
  saveButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  saveText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: f(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
});

export default GuardEmergencyContactScreen;
