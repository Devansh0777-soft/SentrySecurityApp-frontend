import { colors } from './colors';

export const lightTheme = {
  mode: 'light',

  colors: {
    background: colors.light.background,
    surface: colors.light.surface,
    text: colors.light.text,
    secondaryText: colors.light.secondaryText,
    border: colors.light.border,

    primary: colors.primary,
    gold: colors.gold,

    success: colors.status.success,
    danger: colors.status.danger,
    info: colors.status.info,
    review: colors.status.review,
    warning: colors.status.warning,
  },
} as const;

export const darkTheme = {
  mode: 'dark',

  colors: {
    background: colors.dark.background,
    surface: colors.dark.surface,
    text: colors.dark.text,
    secondaryText: colors.dark.secondaryText,
    border: colors.dark.border,

    primary: colors.primary,
    gold: colors.gold,

    success: colors.status.success,
    danger: colors.status.danger,
    info: colors.status.info,
    review: colors.status.review,
    warning: colors.status.warning,
  },
} as const;
