import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import ScalePressable from '../../../components/common/ScalePressable';
import { colors } from '../../../styles/colors';
import { scaleFont } from '../../../styles/dimensions';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { ApiError } from '../../../services/apiClient';
import {
  guardService,
  type DutyPhoto,
  type GuardDutyStatus,
} from '../../../services/guardService';
import GuardSelfieCapture from '../components/GuardSelfieCapture';
import type { GuardStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<GuardStackParamList, 'GuardDutyCapture'>;

const formatLocalTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const GuardDutyCaptureScreen = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { mode } = route.params;
  const isClockIn = mode === 'clock_in';

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // React state updates are asynchronous, so a `busy` check alone cannot stop
  // two taps landing in the same frame from firing two identical requests.
  // A ref flips synchronously with the tap: one user action = one submission.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!done) return undefined;
    const timeout = setTimeout(() => navigation.goBack(), 1500);
    return () => clearTimeout(timeout);
  }, [done, navigation]);

  const confirm = async (photo: DutyPhoto) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      await (isClockIn
        ? guardService.clockIn(photo)
        : guardService.clockOut(photo));
      setDone(true);
    } catch (error) {
      // The transport can fail after the server already applied the change
      // (lost response). Reconcile ONCE with the authoritative duty status —
      // a read-only GET, never a retry of the mutation — so a successful
      // backend operation is not reported as a failure.
      const status: GuardDutyStatus | null = await guardService
        .getDutyStatus()
        .catch(() => null);
      const converged =
        status !== null &&
        (isClockIn
          ? status.status === 'on_duty'
          : status.status === 'off_duty');
      if (converged) {
        setDone(true);
        return;
      }

      let message: string;
      if (error instanceof ApiError && error.code === 'DUTY_COOLING_DOWN') {
        // 24-hour cycle rejection: show the exact next start time computed by
        // the backend, formatted on the device (never a hardcoded reset time).
        const next = status?.next_start_at;
        const time = next ? formatLocalTime(next) : '';
        message = time
          ? t('guard.duty.dutyCycleWait', { time })
          : t('guard.duty.dutyCycleNoTime');
      } else if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
        message = t('guard.common.networkError');
      } else if (error instanceof Error && error.message) {
        // Backend business errors already carry a meaningful message.
        message = error.message;
      } else {
        message = t('guard.common.tryAgain');
      }

      // Exactly one alert per failed user action.
      Alert.alert(
        isClockIn
          ? t('guard.duty.clockInFailed')
          : t('guard.duty.clockOutFailed'),
        message,
      );
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.done} edges={['top', 'bottom']}>
        <View style={styles.doneIcon}>
          <Feather name="check" size={scaleFont(32)} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>
          {isClockIn ? t('guard.duty.dutyStarted') : t('guard.duty.dutyEnded')}
        </Text>
        <Text style={styles.doneBody}>
          {isClockIn
            ? t('guard.duty.dutyStartedBody')
            : t('guard.duty.dutyEndedBody')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>
            {isClockIn
              ? t('guard.duty.captureClockInTitle')
              : t('guard.duty.captureClockOutTitle')}
          </Text>
          <Text style={styles.headerStep}>{t('guard.duty.captureStep')}</Text>
        </View>
        <ScalePressable
          style={styles.close}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('guard.common.close')}
        >
          <Feather name="x" size={scaleFont(22)} color={colors.white} />
        </ScalePressable>
      </View>

      <View style={styles.body}>
        <GuardSelfieCapture mode={mode} busy={busy} onConfirm={confirm} />
        {busy ? (
          <View style={styles.uploading}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.uploadingText}>
              {isClockIn
                ? t('guard.duty.clockingIn')
                : t('guard.duty.clockingOut')}
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    fontSize: scaleFont(typography.sizes.lg),
  },
  headerStep: {
    marginTop: spacing.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.xs),
  },
  close: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  body: { flex: 1 },
  uploading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 20, 0.8)',
    gap: spacing.md,
  },
  uploadingText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semiBold,
    fontSize: scaleFont(typography.sizes.sm),
    letterSpacing: scaleFont(0.6),
  },
  done: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  doneIcon: {
    height: 84,
    width: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.success,
    marginBottom: spacing.lg,
  },
  doneTitle: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    fontSize: scaleFont(typography.sizes.xl),
    textAlign: 'center',
  },
  doneBody: {
    marginTop: spacing.sm,
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    lineHeight: scaleFont(typography.sizes.sm) * 1.5,
    textAlign: 'center',
  },
});

export default GuardDutyCaptureScreen;
