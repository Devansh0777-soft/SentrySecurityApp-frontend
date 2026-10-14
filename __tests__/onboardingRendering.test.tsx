import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import ReactTestRenderer from 'react-test-renderer';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../src/localization';
import Onboarding01Screen from '../src/features/onboarding/screens/Onboarding01Screen';
import Onboarding02Screen from '../src/features/onboarding/screens/Onboarding02Screen';
import Onboarding03Screen from '../src/features/onboarding/screens/Onboarding03Screen';

const SCREENS = {
  Onboarding01: Onboarding01Screen,
  Onboarding02: Onboarding02Screen,
  Onboarding03: Onboarding03Screen,
};

const LOCALES = ['en', 'hi', 'pa'] as const;

// Matches the Figma base frame so scaled styles resolve predictably, and gives
// the screens real safe-area insets (SafeAreaProvider renders no children
// without metrics).
const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Minimal navigation stub: the screens only ever navigate forward or replace
// the parent stack, and nothing here is expected to press a button.
const navigation: any = {
  navigate: jest.fn(),
  replace: jest.fn(),
  getParent: () => ({ replace: jest.fn() }),
};

/** Flattens a style prop (array / nested array / object) into one object. */
const flatten = (style: unknown): Record<string, any> => {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, any>>(
      (acc, s) => ({ ...acc, ...flatten(s) }),
      {},
    );
  }
  return style as Record<string, any>;
};

/**
 * Renders a screen for `locale` and returns its test instance, then tears it
 * down. Kept in one helper so every assertion runs against a real render tree.
 */
const renderScreen = async (
  Screen: React.ComponentType<any>,
  locale: string,
): Promise<ReactTestRenderer.ReactTestRenderer> => {
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage(locale);
  });

  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      // The screens call useSafeAreaInsets(), so they need the provider the
      // real app mounts at the root.
      <SafeAreaProvider initialMetrics={INITIAL_METRICS as any}>
        <Screen navigation={navigation} />
      </SafeAreaProvider>,
    );
  });
  return tree!;
};

describe('onboarding text rendering across locales', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  it.each(Object.keys(SCREENS))('%s renders in every locale', async name => {
    const Screen = SCREENS[name as keyof typeof SCREENS];

    for (const locale of LOCALES) {
      const tree = await renderScreen(Screen, locale);
      const heading = i18n
        .getFixedT(locale)(`onboarding.step${name.slice(-1)}.title`);

      // Assert the translated heading really is in the tree.
      const found = tree.root
        .findAllByType(Text)
        .some(node =>
          String(node.props.children ?? '').includes(heading.split('\n')[0]),
        );
      expect(found).toBe(true);

      await ReactTestRenderer.act(() => tree.unmount());
    }
  });

  it.each(Object.keys(SCREENS))(
    '%s applies script-safe line heights in Hindi and Punjabi',
    async name => {
      const Screen = SCREENS[name as keyof typeof SCREENS];

      for (const locale of LOCALES) {
        const tree = await renderScreen(Screen, locale);

        const textNodes: ReactTestInstance[] = tree.root.findAllByType(Text);
        expect(textNodes.length).toBeGreaterThan(0);

        let checked = 0;
        for (const node of textNodes) {
          const style = flatten(node.props.style);
          const { fontSize, lineHeight } = style;

          // Only assert on nodes that actually set both metrics.
          if (typeof fontSize !== 'number' || typeof lineHeight !== 'number') {
            continue;
          }
          checked += 1;

          // Android must not add Latin-derived font padding on top of the box.
          expect(style.includeFontPadding).toBe(false);

          if (locale === 'en') {
            continue; // English keeps the approved Figma metrics.
          }

          // The core regression guard. A line box at or below the font size
          // clips Devanagari/Gurmukhi diacritics, and the ratio must clear the
          // scripts' natural ascent + descent (~1.35em). Hard-coded rather than
          // derived from INDIC_LINE_HEIGHT_RATIO so this assertion stays
          // independent of the value it protects.
          expect(lineHeight).toBeGreaterThan(fontSize);
          expect(lineHeight / fontSize).toBeGreaterThanOrEqual(1.35);
        }

        // Every onboarding screen has heading/subtitle/labels to check.
        expect(checked).toBeGreaterThan(0);

        await ReactTestRenderer.act(() => tree.unmount());
      }
    },
  );

  it.each(Object.keys(SCREENS))(
    '%s does not clip action buttons with fixed heights',
    async name => {
      const Screen = SCREENS[name as keyof typeof SCREENS];

      for (const locale of LOCALES) {
        const tree = await renderScreen(Screen, locale);

        // The primary action button must use minHeight, not a fixed height,
        // so a taller Indic line box always fits.
        const views: ReactTestInstance[] = tree.root.findAllByType(View);
        const actionButton = views.find(v => {
          const s = flatten(v.props.style);
          return s.backgroundColor === '#0B1F3A' && s.borderRadius === 15;
        });

        expect(actionButton).toBeDefined();
        const style = flatten(actionButton!.props.style);
        expect(style.height).toBeUndefined();
        expect(style.minHeight).toBeGreaterThan(0);

        await ReactTestRenderer.act(() => tree.unmount());
      }
    },
  );
});
