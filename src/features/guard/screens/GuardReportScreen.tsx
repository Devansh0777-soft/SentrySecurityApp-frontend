import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';

import ScalePressable from '../../../components/common/ScalePressable';
import AgencyProfileMenu from '../../dashboard/components/AgencyProfileMenu';
import GuardTopNavigation from '../components/GuardTopNavigation';
import GuardBottomNavigation, {
  type GuardTab,
} from '../components/GuardBottomNavigation';
import {
  guardService,
  MAX_REPORT_PHOTOS,
  type DutyPhoto,
  type GuardDutyDetails,
  type GuardReport,
} from '../../../services/guardService';
import {
  captureGuardEvidencePhoto,
  pickGuardEvidencePhotos,
  type GuardPhotoPickResult,
} from '../utils/guardPhotoPicker';
import type { GuardStackParamList } from '../../../navigation/types';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';

const severities: Array<{ key: GuardReport['severity']; labelKey: string }> = [
  { key: 'low', labelKey: 'guard.report.severityLow' },
  { key: 'medium', labelKey: 'guard.report.severityMedium' },
  { key: 'high', labelKey: 'guard.report.severityHigh' },
];

const GuardReportScreen = () => {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<GuardStackParamList>>();
  const [guard, setGuard] = useState<GuardDutyDetails | null>(null);
  const [severity, setSeverity] = useState<GuardReport['severity']>('low');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [photos, setPhotos] = useState<DutyPhoto[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<{
    message: string;
    openSettings?: boolean;
  } | null>(null);

  useEffect(() => {
    guardService
      .getDutyDetails()
      .then(setGuard)
      .catch(() => undefined);
  }, []);

  const remainingSlots = MAX_REPORT_PHOTOS - photos.length;
  const attachmentsFull = remainingSlots <= 0;

  const applyPickResult = useCallback(
    (result: GuardPhotoPickResult) => {
      if (result.status === 'success') {
        setPhotoNotice(null);
        setPhotos(current =>
          [...current, ...result.photos].slice(0, MAX_REPORT_PHOTOS),
        );
        return;
      }
      // Cancelling the camera or gallery is not an error state.
      if (result.status === 'cancelled') return;

      if (result.status === 'permission') {
        setPhotoNotice({
          message: t('guard.report.cameraPermissionBody'),
          openSettings: true,
        });
        return;
      }
      if (result.status === 'unavailable') {
        setPhotoNotice({ message: t('guard.report.cameraUnavailableHint') });
        return;
      }
      setPhotoNotice({
        message: result.message || t('guard.report.photoPickerFailed'),
      });
    },
    [t],
  );

  const attachFromCamera = async () => {
    if (pickerBusy || attachmentsFull) return;
    // The sheet closes first so the system camera is never covered by it.
    setPickerOpen(false);
    setPickerBusy(true);
    try {
      applyPickResult(
        await captureGuardEvidencePhoto(
          {
            title: t('guard.report.cameraPermissionTitle'),
            message: t('guard.report.cameraPermissionBody'),
            buttonPositive: t('guard.report.grantCamera'),
            buttonNegative: t('guard.common.close'),
          },
          t('guard.report.captureFailed'),
        ),
      );
    } finally {
      setPickerBusy(false);
    }
  };

  const attachFromGallery = async () => {
    if (pickerBusy || attachmentsFull) return;
    setPickerOpen(false);
    setPickerBusy(true);
    try {
      applyPickResult(
        await pickGuardEvidencePhotos(
          remainingSlots,
          t('guard.report.photoPickerFailed'),
        ),
      );
    } finally {
      setPickerBusy(false);
    }
  };

  const removePhoto = (index: number) =>
    setPhotos(current => current.filter((_, position) => position !== index));

  const submit = async () => {
    if (!notes.trim()) {
      Alert.alert(
        t('guard.report.describeTitle'),
        t('guard.report.describeBody'),
      );
      return;
    }
    try {
      setSubmitting(true);
      await guardService.submitReport({
        severity,
        notes: notes.trim(),
        photos,
      });
      setNotes('');
      setSeverity('low');
      setPhotos([]);
      setPhotoNotice(null);
      Alert.alert(
        t('guard.report.submittedTitle'),
        t('guard.report.submittedBody'),
      );
    } catch (error) {
      Alert.alert(
        t('guard.report.submitFailed'),
        error instanceof Error ? error.message : t('guard.common.tryAgain'),
      );
    } finally {
      setSubmitting(false);
    }
  };
  const handleTab = (tab: GuardTab) => {
    setProfileMenuOpen(false);
    if (tab === 'duty') navigation.navigate('GuardDuty');
    else if (tab === 'patrol') navigation.navigate('GuardPatrol');
    else if (tab === 'profile') navigation.navigate('GuardProfile');
    else if (tab === 'schedule') navigation.navigate('GuardSchedule');
  };
  const submitDisabled = submitting || pickerBusy || !notes.trim();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <GuardTopNavigation
        profileMenuOpen={profileMenuOpen}
        onProfilePress={() => setProfileMenuOpen(open => !open)}
        avatarInitials={(guard?.full_name || 'U')
          .trim()
          .charAt(0)
          .toUpperCase()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>{t('guard.report.severity')}</Text>
          <View style={styles.severityRow}>
            {severities.map(option => {
              const active = severity === option.key;
              return (
                <ScalePressable
                  key={option.key}
                  style={[
                    styles.severityOption,
                    active && styles.severityActive,
                  ]}
                  onPress={() => setSeverity(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.severityText,
                      active && styles.severityTextActive,
                    ]}
                  >
                    {t(option.labelKey)}
                  </Text>
                </ScalePressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t('guard.report.whatHappened')}</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={styles.notes}
            placeholder={t('guard.report.notesPlaceholder')}
            placeholderTextColor={colors.textGray}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t('guard.report.incidentDetails')}
          />

          <Text style={styles.label}>{t('guard.report.attachments')}</Text>
          <ScalePressable
            style={[
              styles.attach,
              (pickerBusy || attachmentsFull || submitting) &&
                styles.attachDisabled,
            ]}
            onPress={() => setPickerOpen(true)}
            disabled={pickerBusy || attachmentsFull || submitting}
            accessibilityRole="button"
            accessibilityState={{
              disabled: pickerBusy || attachmentsFull || submitting,
            }}
            accessibilityLabel={t('guard.report.attachPhoto')}
          >
            <Feather
              name="camera"
              size={scaleFont(22)}
              color={colors.textGray}
            />
            <Text style={styles.attachText}>
              {pickerBusy
                ? t('guard.report.opening')
                : t('guard.report.attachPhoto')}
            </Text>
          </ScalePressable>
          <Text style={styles.attachHint}>
            {attachmentsFull
              ? t('guard.report.photoLimitReached', {
                  count: MAX_REPORT_PHOTOS,
                })
              : t('guard.report.attachmentsHint', {
                  count: MAX_REPORT_PHOTOS,
                })}
          </Text>

          {photos.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  <ScalePressable
                    style={styles.photoRemove}
                    onPress={() => removePhoto(index)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('guard.report.removePhoto', {
                      index: index + 1,
                    })}
                  >
                    <Feather
                      name="x"
                      size={scaleFont(14)}
                      color={colors.white}
                    />
                  </ScalePressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {photoNotice ? (
            <View style={styles.notice}>
              <Feather
                name="alert-circle"
                size={scaleFont(16)}
                color={colors.status.danger}
              />
              <Text style={styles.noticeText}>{photoNotice.message}</Text>
              {photoNotice.openSettings ? (
                <ScalePressable
                  style={styles.noticeAction}
                  onPress={() => Linking.openSettings()}
                  accessibilityRole="button"
                  accessibilityLabel={t('guard.report.openSettings')}
                >
                  <Text style={styles.noticeActionText}>
                    {t('guard.report.openSettings')}
                  </Text>
                </ScalePressable>
              ) : null}
            </View>
          ) : null}

          <ScalePressable
            style={[styles.submit, submitDisabled && styles.submitDisabled]}
            onPress={submit}
            disabled={submitDisabled}
            accessibilityLabel={t('guard.report.submitReport')}
          >
            <Text style={styles.submitText}>
              {submitting
                ? t('guard.report.submitting')
                : t('guard.report.submitReport')}
            </Text>
          </ScalePressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <GuardBottomNavigation activeTab="report" onTabPress={handleTab} />
      {profileMenuOpen ? (
        <ScalePressable
          style={styles.backdrop}
          onPress={() => setProfileMenuOpen(false)}
          accessibilityLabel={t('guard.common.closeProfileMenu')}
        >
          <View />
        </ScalePressable>
      ) : null}
      {profileMenuOpen ? (
        <AgencyProfileMenu
          identity={{
            name: guard?.full_name || t('guard.common.guardFallback'),
            company: guard?.guard_code
              ? t('guard.common.badgeId', { id: guard.guard_code })
              : '',
            initials: (guard?.full_name || 'U').trim().charAt(0).toUpperCase(),
          }}
          onMyProfile={() => {
            setProfileMenuOpen(false);
            navigation.navigate('GuardProfile');
          }}
          onLogout={() => setProfileMenuOpen(false)}
        />
      ) : null}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <ScalePressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
            accessibilityLabel={t('guard.report.cancel')}
          >
            <View />
          </ScalePressable>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {t('guard.report.addPhotoTitle')}
            </Text>
            <ScalePressable
              style={styles.sheetRow}
              onPress={attachFromCamera}
              accessibilityRole="button"
              accessibilityLabel={t('guard.report.takePhoto')}
            >
              <View style={styles.sheetIcon}>
                <Feather
                  name="camera"
                  size={scaleFont(18)}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.sheetRowText}>
                {t('guard.report.takePhoto')}
              </Text>
              <Feather
                name="chevron-right"
                size={scaleFont(18)}
                color={colors.textGray}
              />
            </ScalePressable>
            <ScalePressable
              style={styles.sheetRow}
              onPress={attachFromGallery}
              accessibilityRole="button"
              accessibilityLabel={t('guard.report.chooseFromGallery')}
            >
              <View style={styles.sheetIcon}>
                <Feather
                  name="image"
                  size={scaleFont(18)}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.sheetRowText}>
                {t('guard.report.chooseFromGallery')}
              </Text>
              <Feather
                name="chevron-right"
                size={scaleFont(18)}
                color={colors.textGray}
              />
            </ScalePressable>
            <ScalePressable
              style={styles.sheetCancel}
              onPress={() => setPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('guard.report.cancel')}
            >
              <Text style={styles.sheetCancelText}>
                {t('guard.report.cancel')}
              </Text>
            </ScalePressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.light.background,
    position: 'relative',
  },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
    lineHeight: scaleFont(typography.sizes.md + 4),
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  severityOption: {
    flex: 1,
    minHeight: scaleHeight(46),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: scaleWidth(10),
    backgroundColor: colors.white,
  },
  severityActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  severityText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.medium,
  },
  severityTextActive: {
    color: colors.white,
    fontWeight: typography.weights.semiBold,
  },
  notes: {
    minHeight: scaleHeight(140),
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: scaleWidth(10),
    backgroundColor: colors.white,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
    lineHeight: scaleFont(typography.sizes.lg + 4),
  },
  attach: {
    minHeight: scaleHeight(48),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: scaleWidth(10),
    backgroundColor: colors.light.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  attachText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    lineHeight: scaleFont(typography.sizes.lg + 2),
  },
  attachDisabled: { opacity: 0.5 },
  attachHint: {
    marginTop: spacing.xs,
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: scaleFont(typography.sizes.md + 2),
  },
  photoRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  photoItem: {
    height: scaleWidth(84),
    width: scaleWidth(84),
  },
  photoThumb: {
    height: '100%',
    width: '100%',
    borderRadius: scaleWidth(10),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  photoRemove: {
    position: 'absolute',
    top: -spacing.xs,
    right: -spacing.xs,
    height: scaleWidth(24),
    width: scaleWidth(24),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },
  notice: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: scaleWidth(10),
    borderWidth: 1,
    borderColor: colors.status.danger,
    backgroundColor: colors.white,
  },
  noticeText: {
    flex: 1,
    color: colors.status.danger,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: scaleFont(typography.sizes.md + 2),
  },
  noticeAction: {
    minHeight: scaleHeight(34),
    paddingHorizontal: spacing.md,
    borderRadius: scaleWidth(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  noticeActionText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.semiBold,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 31, 58, 0.56)',
  },
  sheet: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    backgroundColor: colors.white,
  },
  sheetTitle: {
    marginBottom: spacing.xs,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  sheetRow: {
    minHeight: scaleHeight(56),
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: scaleWidth(10),
    backgroundColor: colors.light.background,
  },
  sheetIcon: {
    height: scaleWidth(36),
    width: scaleWidth(36),
    borderRadius: scaleWidth(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  sheetRowText: {
    flex: 1,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.medium,
  },
  sheetCancel: {
    minHeight: scaleHeight(48),
    marginTop: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
  },
  submit: {
    minHeight: scaleHeight(48),
    borderRadius: scaleWidth(10),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    lineHeight: scaleFont(typography.sizes.lg + 2),
  },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 10 },
});

export default GuardReportScreen;
