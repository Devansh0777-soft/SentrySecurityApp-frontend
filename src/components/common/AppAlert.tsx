import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScalePressable from './ScalePressable';
import { appAlert, type AppAlertRequest } from '../../services/alertService';
import { colors } from '../../styles/colors';
import { scaleFont } from '../../styles/dimensions';
import { spacing } from '../../styles/spacing';
import { scriptSafeText, typography } from '../../styles/typography';

type TypeVisual = {
  icon: string;
  tint: string;
  surface: string;
};

const TYPE_VISUALS: Record<AppAlertRequest['type'], TypeVisual> = {
  success: {
    icon: 'check-circle',
    tint: colors.status.success,
    surface: '#E8F5EC',
  },
  error: {
    icon: 'x-circle',
    tint: colors.status.danger,
    surface: '#FDECEC',
  },
  warning: {
    icon: 'alert-triangle',
    tint: colors.status.warning,
    surface: '#FEF3E0',
  },
  info: {
    icon: 'info',
    tint: colors.status.info,
    surface: '#E8F0FE',
  },
};

/**
 * Global alert dialog rendered above the entire app.
 *
 * Driven by the centralized `alertService`, so every success message, error,
 * confirmation, and validation notice across the app shares one consistent,
 * design-system-aligned presentation.
 */
const AppAlert: React.FC = () => {
  const [request, setRequest] = useState<AppAlertRequest | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const insets = useSafeAreaInsets();
  // Guards against double taps firing a button action twice.
  const handledIdRef = useRef<number | null>(null);

  useEffect(() => appAlert.subscribe(setRequest), []);

  useEffect(() => {
    if (request) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fade.setValue(0);
      cardScale.setValue(0.96);
    }
  }, [request, fade, cardScale]);

  const dismissable = request?.cancelable ?? true;

  const handleDismiss = useCallback(() => {
    appAlert.dismiss();
  }, []);

  // Android hardware back dismisses cancelable alerts.
  useEffect(() => {
    if (!request || !dismissable) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [request, dismissable, handleDismiss]);

  const handleButtonPress = useCallback(
    (button: AppAlertRequest['buttons'][number]) => {
      if (request && handledIdRef.current === request.id) {
        return;
      }
      if (request) {
        handledIdRef.current = request.id;
      }
      appAlert.handleButtonPress(button);
    },
    [request],
  );

  const visual = useMemo(
    () => (request ? TYPE_VISUALS[request.type] : null),
    [request],
  );

  const buttons = request?.buttons ?? [];
  const stacked = buttons.length > 2;

  const renderButton = (
    button: AppAlertRequest['buttons'][number],
    index: number,
  ) => {
    const isDanger = button.variant === 'danger';
    const isPrimary = button.variant === 'primary';

    return (
      <ScalePressable
        key={`${request?.id ?? 0}-${button.text}-${index}`}
        accessibilityRole="button"
        accessibilityLabel={button.text}
        style={[
          styles.button,
          stacked ? styles.buttonStacked : styles.buttonRowItem,
          isPrimary && styles.buttonPrimary,
          isDanger && styles.buttonDanger,
          !isPrimary && !isDanger && styles.buttonNeutral,
        ]}
        onPress={() => handleButtonPress(button)}
      >
        <Text
          style={[
            styles.buttonLabel,
            isPrimary || isDanger ? styles.buttonLabelLight : null,
          ]}
          numberOfLines={2}
        >
          {button.text}
        </Text>
      </ScalePressable>
    );
  };

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.backdrop, { opacity: fade }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close alert"
              style={styles.flex}
              onPress={dismissable ? handleDismiss : undefined}
            />
          </Animated.View>
          <View style={styles.center} pointerEvents="box-none">
            <Animated.View
              accessibilityViewIsModal
              accessibilityRole="alert"
              style={[
                styles.card,
                {
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                  transform: [{ scale: cardScale }],
                  opacity: fade,
                },
              ]}
            >
              {visual ? (
                <View
                  style={[
                    styles.iconSurface,
                    { backgroundColor: visual.surface },
                  ]}
                >
                  <Feather
                    name={visual.icon}
                    size={scaleFont(typography.sizes.xxxl)}
                    color={visual.tint}
                  />
                </View>
              ) : null}
              <Text
                style={styles.title}
                accessibilityRole="header"
                maxFontSizeMultiplier={1.6}
              >
                {request?.title ?? ''}
              </Text>
              {request?.message ? (
                <ScrollView
                  style={styles.messageScroll}
                  contentContainerStyle={styles.messageContent}
                >
                  <Text style={styles.message} maxFontSizeMultiplier={1.8}>
                    {request.message}
                  </Text>
                </ScrollView>
              ) : null}
              <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
                {buttons.map(renderButton)}
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default AppAlert;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11,31,58,0.56)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  iconSurface: {
    width: scaleFont(72),
    height: scaleFont(72),
    borderRadius: scaleFont(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.lg),
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
    ...scriptSafeText,
  },
  messageScroll: {
    maxHeight: scaleFont(160),
    alignSelf: 'stretch',
  },
  messageContent: {
    paddingBottom: spacing.xs,
  },
  message: {
    color: colors.textGray,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.sm),
    fontWeight: typography.weights.regular,
    lineHeight: scaleFont(typography.sizes.sm) * 1.5,
    textAlign: 'center',
    ...scriptSafeText,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  buttonColumn: {
    flexDirection: 'column-reverse',
  },
  buttonRowItem: { flex: 1 },
  buttonStacked: {
    minHeight: spacing.xxxl,
    justifyContent: 'center',
  },
  button: {
    minHeight: spacing.xxxl,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.status.danger,
  },
  buttonNeutral: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonLabel: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: scaleFont(typography.sizes.md),
    fontWeight: typography.weights.semiBold,
    textAlign: 'center',
    ...scriptSafeText,
  },
  buttonLabelLight: {
    color: colors.white,
  },
});
