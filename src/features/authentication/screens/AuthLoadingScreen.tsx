import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { colors } from '../../../styles/colors';
import { scaleWidth, scaleHeight } from '../../../styles/dimensions';

/**
 * Shown while the initial session restoration runs. It reuses the splash logo
 * so there is no jarring transition, and importantly it prevents the login
 * screen (or onboarding) from flashing before the persisted session is read.
 */
const AuthLoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Image
        source={require('../../../assets/images/sentry-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator
        style={styles.spinner}
        size="large"
        color={colors.primary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: scaleWidth(360),
    height: scaleHeight(360),
  },
  spinner: {
    marginTop: scaleHeight(24),
  },
});

export default AuthLoadingScreen;
