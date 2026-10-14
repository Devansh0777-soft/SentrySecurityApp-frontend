import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, StatusBar } from 'react-native';
import { colors } from '../../../styles/colors';
import { scaleWidth, scaleHeight } from '../../../styles/dimensions';

/**
 * Cold-start boot splash: the ONLY visual shown at launch.
 *
 * Shows the Sentry Security branding with a yellow progress bar animating
 * 0% → 100% over ~2s while AuthContext restores the session and prefetches
 * the role's dashboard data in parallel. The bar is purely cosmetic pacing —
 * the navigator gate (`AppNavigator`, driven by `isLoading`) keeps this
 * mounted until boot actually finishes, so a slow network holds the splash
 * past 2s rather than flashing an empty dashboard. Unmount is
 * cancellation-safe via the standard Animated cleanup.
 */

const SPLASH_MIN_MS = 2000;

const AuthLoadingScreen: React.FC = () => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progressAnim, {
      toValue: 100,
      duration: SPLASH_MIN_MS,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Image
        source={require('../../../assets/images/sentry-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: progressWidth }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, position: 'relative' },
  logo: {
    position: 'absolute',
    width: scaleWidth(521),
    height: scaleHeight(521),
    top: scaleHeight(146),
    left: scaleWidth(-60),
    opacity: 1,
  },
  progressTrack: {
    position: 'absolute',
    width: scaleWidth(234),
    height: scaleHeight(6),
    top: scaleHeight(780),
    left: scaleWidth(84),
    borderRadius: 100,
    opacity: 1,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 100,
    backgroundColor: colors.gold,
  },
});

export default AuthLoadingScreen;
