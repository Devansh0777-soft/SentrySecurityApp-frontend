import React from 'react';
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from 'react-native-vector-icons/Feather';

import LanguageSelector from '../../../components/common/LanguageSelector';
import type {
  AuthStackParamList,
  RootStackParamList,
} from '../../../navigation/types';
import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';

type Props = NativeStackScreenProps<AuthStackParamList, 'AccountCreated'>;

const DOTS = [
  { left: 99, top: 207, color: '#35C759' },
  { left: 83, top: 240, color: '#FFB800' },
  { left: 96, top: 280, color: '#0B1F3A' },
  { left: 84, top: 316, color: '#FFB800' },
  { left: 96, top: 349, color: '#35C759' },
  { left: 87, top: 385, color: '#0B1F3A' },
  { left: 107, top: 415, color: '#FFB800' },
  { left: 288, top: 207, color: '#FFB800' },
  { left: 308, top: 237, color: '#0B1F3A' },
  { left: 300, top: 273, color: '#35C759' },
  { left: 308, top: 306, color: '#FFB800' },
  { left: 300, top: 341, color: '#0B1F3A' },
  { left: 311, top: 382, color: '#FFB800' },
  { left: 296, top: 415, color: '#35C759' },
];

const AccountCreatedScreen: React.FC<Props> = ({ navigation, route }) => {
  const returnToSuperAdmin = route.params?.returnToSuperAdmin === true;
  const complete = () => {
    if (returnToSuperAdmin) {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.reset({
          index: 0,
          routes: [{ name: 'SuperAdminFlow' }],
        });
      return;
    }
    navigation.popToTop();
  };
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.topBar}>
        <View style={styles.topBarPlaceholder} />
        <LanguageSelector />
      </View>

      <View style={styles.hero}>
        {DOTS.map((dot, index) => (
          <View
            key={index}
            style={[
              styles.confettiDot,
              {
                left: scaleWidth(dot.left),
                top: scaleHeight(dot.top),
                backgroundColor: dot.color,
              },
            ]}
          />
        ))}

        <Image
          source={require('../../../assets/images/login-shield-logo.png')}
          style={styles.successShield}
          resizeMode="contain"
        />
        <View style={styles.successBadge}>
          <Feather name="check" size={scaleFont(34)} color={colors.white} />
        </View>
      </View>

      <Text style={styles.heading}>Account Created{`\n`}Successfully!</Text>
      <Text style={styles.subtitle}>
        {route.params?.approvalPending
          ? 'Your agency account is awaiting Super Admin approval. You can log in once approved.'
          : 'Your account has been created.\nYou can now login and explore\nthe app.'}
      </Text>

      <TouchableOpacity style={styles.loginButton} onPress={complete}>
        <Text style={styles.loginButtonText}>
          {returnToSuperAdmin ? 'Back to Super Admin' : 'Go to Login'}
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scaleWidth(19),
    paddingBottom: scaleHeight(32),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: scaleHeight(44),
    paddingTop: scaleHeight(4),
    marginBottom: scaleHeight(4),
  },
  topBarPlaceholder: { width: scaleWidth(44), height: scaleHeight(44) },
  hero: {
    alignSelf: 'center',
    width: scaleWidth(302),
    height: scaleHeight(302),
    marginTop: scaleHeight(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiDot: {
    position: 'absolute',
    width: scaleWidth(8),
    height: scaleHeight(8),
    borderRadius: 100,
  },
  successShield: {
    width: scaleWidth(202),
    height: scaleHeight(202),
  },
  successBadge: {
    position: 'absolute',
    right: scaleWidth(8),
    top: scaleHeight(4),
    width: scaleWidth(59),
    height: scaleHeight(59),
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#35C759',
  },
  heading: {
    marginTop: scaleHeight(16),
    paddingHorizontal: scaleWidth(4),
    textAlign: 'center',
    fontSize: scaleFont(32),
    lineHeight: scaleFont(39),
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    marginTop: scaleHeight(8),
    paddingHorizontal: scaleWidth(4),
    textAlign: 'center',
    fontSize: scaleFont(20),
    lineHeight: scaleFont(29),
    color: colors.primary,
  },
  loginButton: {
    marginTop: scaleHeight(40),
    minHeight: scaleHeight(50),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: scaleHeight(10),
  },
  loginButtonText: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
});

export default AccountCreatedScreen;
