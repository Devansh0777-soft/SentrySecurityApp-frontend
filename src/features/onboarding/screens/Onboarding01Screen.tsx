import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LanguageSelector from '../../../components/common/LanguageSelector';
import { colors } from '../../../styles/colors';
import { scaleWidth, scaleHeight, scaleFont } from '../../../styles/dimensions';
import useOnboardingTextStyles from '../useOnboardingTextStyles';
import type {
  OnboardingStackParamList,
  RootStackParamList,
} from '../../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Onboarding01'>;

const Onboarding01Screen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Script-safe text metrics: widens the line box for Hindi/Punjabi so
  // Devanagari/Gurmukhi diacritics are never clipped. Identical for English.
  const textStyles = useOnboardingTextStyles();

  const skipOnboarding = () => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.replace('AuthFlow');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Illustration — exact Figma position: left 12, top 89, 381x370 */}
      <Image
        source={require('../../../assets/images/onboarding-01-guard.png')}
        style={styles.illustration}
        resizeMode="contain"
      />

      {/* Positioned against the top safe-area inset so the button sits in the
          upper-right corner below the status bar/notch on every device. */}
      <View style={[styles.langWrap, { top: insets.top + scaleHeight(8) }]}>
        <LanguageSelector />
      </View>

      {/* Heading — left 22, top 483, width 376, Inter ExtraBold 42 */}
      <View style={styles.copyBlock}>
        <Text style={textStyles.heading}>{t('onboarding.step1.title')}</Text>
        {/* Subtitle — left 22, width 341, Inter Regular 20 */}
        <Text style={[styles.subtitle, textStyles.subtitle]}>
          {t('onboarding.step1.subtitle')}
        </Text>
      </View>

      {/* Pagination dots — group starts left 141, top 711 */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      {/* Skip — left 22, top 795 */}
      <TouchableOpacity style={styles.skipWrapper} onPress={skipOnboarding}>
        <Text style={textStyles.skipText}>{t('common.skip', 'Skip')}</Text>
      </TouchableOpacity>

      {/* Next button — left 242, top 785, 140x50 */}
      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => navigation.navigate('Onboarding02')}
      >
        <Text style={textStyles.actionText}>{t('common.next')}</Text>
        <Feather
          name="arrow-right"
          size={scaleFont(27)}
          color={colors.white}
          style={styles.nextIcon}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  langWrap: {
    position: 'absolute',
    right: scaleWidth(16),
    zIndex: 10,
    elevation: 10,
  },
  illustration: {
    position: 'absolute',
    left: scaleWidth(12),
    top: scaleHeight(89),
    width: scaleWidth(381),
    height: scaleHeight(370),
  },
  // Heading + subtitle flow inside this block instead of using two hard-coded
  // absolute `top` offsets. Translated text that wraps to an extra line now
  // pushes the subtitle down instead of overlapping the pagination dots.
  copyBlock: {
    position: 'absolute',
    left: scaleWidth(22),
    top: scaleHeight(483),
    width: scaleWidth(376),
  },
  heading: {
    fontSize: scaleFont(42),
    fontWeight: '800',
    color: colors.primary,
    lineHeight: scaleFont(48),
  },
  subtitle: {
    width: scaleWidth(341),
    fontSize: scaleFont(20),
    color: '#000000',
    lineHeight: scaleFont(26),
  },
  dotsRow: {
    position: 'absolute',
    left: scaleWidth(141),
    top: scaleHeight(711),
    flexDirection: 'row',
    gap: scaleWidth(15),
  },
  dot: {
    width: scaleWidth(30),
    height: scaleHeight(6),
    borderRadius: 100,
    backgroundColor: colors.dotInactive,
  },
  dotActive: {
    backgroundColor: colors.gold,
  },
  skipWrapper: {
    position: 'absolute',
    left: scaleWidth(22),
    top: scaleHeight(795),
    // Comfortable touch target that also fits the taller Indic line box.
    minHeight: scaleHeight(44),
    justifyContent: 'center',
    paddingRight: scaleWidth(8),
  },
  nextButton: {
    position: 'absolute',
    left: scaleWidth(242),
    top: scaleHeight(785),
    width: scaleWidth(140),
    // minHeight (not a fixed height) so the taller Indic line box always fits
    // inside the button instead of being clipped.
    minHeight: scaleHeight(50),
    paddingHorizontal: scaleWidth(12),
    borderRadius: 15,
    backgroundColor: colors.primary,
    // Centre the label/arrow rather than pinning them to fixed `top` offsets,
    // which clipped translated labels.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(8),
  },
  nextIcon: {
    transform: [{ scaleX: 1.2 }],
  },
});

export default Onboarding01Screen;
