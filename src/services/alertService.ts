import i18n from '../localization';

/**
 * Centralized in-app alert system.
 *
 * Every alert, confirmation, success message, and error message in the app is
 * presented through this service so that all roles (Agency, Client, Guard,
 * Super Admin) share one consistent, design-system-aligned look.
 *
 * The public API intentionally mirrors React Native's `Alert.alert()` so
 * call sites migrate without changing their success, failure, validation,
 * retry, or confirmation behaviour:
 *
 *   appAlert.alert(title, message?, buttons?, options?)
 *
 * Typed helpers are also available for the common cases:
 *
 *   appAlert.success(title, message?)
 *   appAlert.error(title, message?, buttons?)
 *   appAlert.warning(title, message?)
 *   appAlert.info(title, message?)
 *   appAlert.confirm({ title, message, confirmText, cancelText, onConfirm })
 */

export type AppAlertType = 'success' | 'error' | 'warning' | 'info';

/** Visual variant of an alert button, resolved from its native `style`. */
export type AppAlertButtonVariant = 'primary' | 'secondary' | 'danger';

export type AppAlertButton = {
  text: string;
  /** Same semantics as React Native's AlertButton style. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
  /** Resolved by the service for rendering; callers do not set this. */
  variant?: AppAlertButtonVariant;
};

export type AppAlertOptions = {
  /** Android back press / backdrop tap dismisses without pressing a button. Defaults to true. */
  cancelable?: boolean;
  type?: AppAlertType;
};

export type AppAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  cancelable: boolean;
  type: AppAlertType;
};

export type AppAlertListener = (request: AppAlertRequest | null) => void;

let currentRequest: AppAlertRequest | null = null;
let nextId = 0;
const listeners = new Set<AppAlertListener>();

const emit = () => {
  listeners.forEach(listener => listener(currentRequest));
};

const defaultOkText = (): string => {
  const translated = i18n.t('common.ok');
  return typeof translated === 'string' && translated !== 'common.ok'
    ? translated
    : 'OK';
};

const defaultCancelText = (): string => {
  const translated = i18n.t('common.cancel');
  return typeof translated === 'string' && translated !== 'common.cancel'
    ? translated
    : 'Cancel';
};

const normalizeButtons = (
  buttons?: Array<AppAlertButton | string>,
): AppAlertButton[] => {
  const list: AppAlertButton[] = (buttons ?? [{ text: defaultOkText() }]).map(
    button => (typeof button === 'string' ? { text: button } : { ...button }),
  );
  let primaryAssigned = false;
  return list.map(button => {
    let variant: AppAlertButtonVariant;
    if (button.style === 'destructive') {
      variant = 'danger';
    } else if (button.style === 'cancel') {
      variant = 'secondary';
    } else if (!primaryAssigned) {
      variant = 'primary';
      primaryAssigned = true;
    } else {
      variant = 'secondary';
    }
    return { ...button, variant };
  });
};

const inferType = (
  buttons: AppAlertButton[],
  explicit?: AppAlertType,
): AppAlertType => {
  if (explicit) return explicit;
  return buttons.some(button => button.style === 'destructive')
    ? 'warning'
    : 'info';
};

const showAlert = (
  title: string,
  message?: string,
  buttonsOrOptions?: AppAlertButton[] | AppAlertOptions,
  options?: AppAlertOptions,
): void => {
  const buttons = Array.isArray(buttonsOrOptions)
    ? buttonsOrOptions
    : undefined;
  const resolvedOptions: AppAlertOptions = Array.isArray(buttonsOrOptions)
    ? options ?? {}
    : buttonsOrOptions ?? options ?? {};

  const normalizedButtons = normalizeButtons(buttons);
  const type = inferType(normalizedButtons, resolvedOptions.type);

  // Prevent duplicate alerts from repeated taps or duplicate API responses.
  if (
    currentRequest &&
    currentRequest.title === title &&
    currentRequest.message === message &&
    currentRequest.type === type
  ) {
    return;
  }

  currentRequest = {
    id: ++nextId,
    title,
    message,
    buttons: normalizedButtons,
    cancelable: resolvedOptions.cancelable ?? true,
    type,
  };
  emit();
};

/** Dismisses the visible alert without invoking any button action. */
const dismiss = (): void => {
  if (!currentRequest) return;
  currentRequest = null;
  emit();
};

/**
 * Handles an alert button tap: dismiss first, then run the original action,
 * so navigation and API callbacks keep working exactly as before.
 */
const handleButtonPress = (button: AppAlertButton): void => {
  const { onPress } = button;
  dismiss();
  if (onPress) {
    setTimeout(() => onPress(), 0);
  }
};

const subscribe = (listener: AppAlertListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

type ConfirmConfig = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style the confirm button as a destructive (red) action. */
  destructive?: boolean;
  onConfirm?: () => void;
  type?: AppAlertType;
};

/** Consistent confirmation dialog for destructive / important decisions. */
const confirm = ({
  title,
  message,
  confirmText,
  cancelText,
  destructive,
  onConfirm,
  type,
}: ConfirmConfig): void => {
  showAlert(
    title,
    message,
    [
      { text: cancelText ?? defaultCancelText(), style: 'cancel' },
      {
        text: confirmText ?? defaultOkText(),
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ],
    { type: type ?? (destructive ? 'warning' : 'info') },
  );
};

export const appAlert = {
  /** Alert-compatible entry point: alert(title, message?, buttons?, options?) */
  alert: showAlert,
  success: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: Omit<AppAlertOptions, 'type'>,
  ): void =>
    showAlert(title, message, buttons, { ...options, type: 'success' }),
  error: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: Omit<AppAlertOptions, 'type'>,
  ): void => showAlert(title, message, buttons, { ...options, type: 'error' }),
  warning: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: Omit<AppAlertOptions, 'type'>,
  ): void =>
    showAlert(title, message, buttons, { ...options, type: 'warning' }),
  info: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: Omit<AppAlertOptions, 'type'>,
  ): void => showAlert(title, message, buttons, { ...options, type: 'info' }),
  confirm,
  dismiss,
  handleButtonPress,
  subscribe,
  /** Test/debug helper: returns the currently visible alert, if any. */
  getCurrent: (): AppAlertRequest | null => currentRequest,
};

export default appAlert;
