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
import { useTranslation } from 'react-i18next';
import Feather from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LanguageSelector from '../../../components/common/LanguageSelector';
import type {
  OnboardingStackParamList,
  RootStackParamList,
} from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleWidth, scaleHeight, scaleFont } from '../../../styles/dimensions';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Onboarding03'>;

const Onboarding03Screen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const finishOnboarding = () => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.replace('AuthFlow');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Image
        source={require('../../../assets/images/onboarding-03-alert.png')}
        style={styles.illustration}
        resizeMode="cover"
      />

      <View style={[styles.langWrap, { top: insets.top + scaleHeight(8) }]}>
        <LanguageSelector />
      </View>

      <Text style={styles.heading}>{t('onboarding.step3.title')}</Text>

      <Text style={styles.subtitle}>{t('onboarding.step3.subtitle')}</Text>

      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <TouchableOpacity style={styles.skipWrapper} onPress={finishOnboarding}>
        <Text style={styles.skipText}>{t('common.skip', 'Skip')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.getStartedButton}
        onPress={finishOnboarding}
      >
        <Text style={styles.getStartedText}>{t('common.getStarted')}</Text>
        <Feather
          name="arrow-right"
          size={scaleFont(27)}
          color={colors.white}
          style={styles.getStartedIcon}
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
    left: scaleWidth(22),
    top: scaleHeight(100),
    width: scaleWidth(372),
    height: scaleHeight(364),
  },
  heading: {
    position: 'absolute',
    left: scaleWidth(22),
    top: scaleHeight(483),
    width: scaleWidth(380),
    fontSize: scaleFont(42),
    fontWeight: '800',
    color: colors.primary,
    lineHeight: scaleFont(48),
  },
  subtitle: {
    position: 'absolute',
    left: scaleWidth(22),
    top: scaleHeight(603),
    width: scaleWidth(355),
    fontSize: scaleFont(20),
    fontWeight: '400',
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
  },
  skipText: {
    fontSize: scaleFont(24),
    fontWeight: '600',
    color: '#000000',
  },
  getStartedButton: {
    position: 'absolute',
    left: scaleWidth(191),
    top: scaleHeight(785),
    width: scaleWidth(191),
    height: scaleHeight(50),
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  getStartedText: {
    position: 'absolute',
    left: scaleWidth(13),
    top: scaleHeight(10),
    fontSize: scaleFont(24),
    fontWeight: '600',
    color: colors.white,
    lineHeight: scaleFont(29),
  },
  getStartedIcon: {
    position: 'absolute',
    left: scaleWidth(147),
    top: scaleHeight(11),
    transform: [{ scaleX: 1.2 }],
  },
});

export default Onboarding03Screen;
