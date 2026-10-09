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
import type {
  OnboardingStackParamList,
  RootStackParamList,
} from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleWidth, scaleHeight, scaleFont } from '../../../styles/dimensions';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Onboarding02'>;

const Onboarding02Screen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const skipOnboarding = () => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.replace('AuthFlow');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Image
        source={require('../../../assets/images/onboarding-02-dashboard.png')}
        style={styles.illustration}
        resizeMode="contain"
      />

      <View style={[styles.langWrap, { top: insets.top + scaleHeight(8) }]}>
        <LanguageSelector />
      </View>

      <Text style={styles.heading}>{t('onboarding.step2.title')}</Text>

      <Text style={styles.subtitle}>{t('onboarding.step2.subtitle')}</Text>

      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>

      <TouchableOpacity style={styles.skipWrapper} onPress={skipOnboarding}>
        <Text style={styles.skipText}>{t('common.skip', 'Skip')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => navigation.navigate('Onboarding03')}
      >
        <Text style={styles.nextText}>{t('common.next')}</Text>
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
    left: scaleWidth(13),
    top: scaleHeight(91),
    width: scaleWidth(377),
    height: scaleHeight(369),
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
    width: scaleWidth(341),
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
  nextButton: {
    position: 'absolute',
    left: scaleWidth(242),
    top: scaleHeight(785),
    width: scaleWidth(140),
    height: scaleHeight(50),
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  nextText: {
    position: 'absolute',
    left: scaleWidth(23),
    top: scaleHeight(10),
    fontSize: scaleFont(24),
    fontWeight: '600',
    color: colors.white,
    lineHeight: scaleFont(29),
  },
  nextIcon: {
    position: 'absolute',
    left: scaleWidth(84),
    top: scaleHeight(11),
    transform: [{ scaleX: 1.2 }],
  },
});

export default Onboarding02Screen;
