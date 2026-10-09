import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

// Base dimensions = your Figma frame size (check Figma's frame/canvas settings to confirm)
const BASE_WIDTH = 402;
const BASE_HEIGHT = 874;

// Static snapshot kept for StyleSheet.create() usage (evaluated once per
// module load). Prefer the useResponsive() hook below when layout must react
// to rotation, split-screen, or foldable changes.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Scale horizontally (for width, left, fontSize, paddingHorizontal, etc.)
export const scaleWidth = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

// Scale vertically (for height, top, paddingVertical, etc.)
export const scaleHeight = (size: number): number => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

// Moderate scale — softens the effect for font sizes so text doesn't get
// too huge/tiny on extreme screen sizes. factor 0.5 is a common default.
export const scaleFont = (size: number, factor = 0.5): number => {
  return size + (scaleWidth(size) - size) * factor;
};

// Responsive breakpoints (CSS-point widths). Used only to decide layout
// structure (e.g. single vs two column) — never to hardcode sizes.
export const breakpoints = {
  narrow: 360,
  standard: 400,
} as const;

// Width-aware helpers. Because scaleWidth() is a static snapshot (safe inside
// StyleSheet.create), these window-width variants are for render-time logic
// where rotation/split-screen correctness matters.
export const scaleWidthFor = (windowWidth: number, size: number): number =>
  (windowWidth / BASE_WIDTH) * size;

export const scaleHeightFor = (windowHeight: number, size: number): number =>
  (windowHeight / BASE_HEIGHT) * size;

export type ResponsiveInfo = {
  windowWidth: number;
  windowHeight: number;
  /** True on narrow phones (~320–360pt) where two-column layouts must collapse. */
  isNarrow: boolean;
  /** True on large phones/tablets where two-column layouts fit comfortably. */
  isWide: boolean;
};

export const getResponsiveInfo = (
  windowWidth: number,
  windowHeight: number,
): ResponsiveInfo => ({
  windowWidth,
  windowHeight,
  isNarrow: windowWidth <= breakpoints.narrow,
  isWide: windowWidth > breakpoints.standard,
});

/**
 * Subscribes to window-dimension changes (rotation, split-screen, foldables)
 * and returns layout flags. Prefer flexible layouts first; use this only when
 * the layout structure genuinely depends on available width.
 */
export const useResponsive = (): ResponsiveInfo => {
  const { width, height } = useWindowDimensions();
  return getResponsiveInfo(width, height);
};

export const dimensions = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  pixelDensity: PixelRatio.get(),
};
