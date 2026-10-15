import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { FadeIn, FadeInUp, FadeOut, ZoomIn } from 'react-native-reanimated';

/** Forest-to-teal launch gradient (starts on the native splash color). */
const SPLASH_GRADIENT: [string, string] = ['#0A4A3E', '#0E7565'];
const SPLASH_BASE = '#0A4A3E';
const SPLASH_INK = '#FAF7F2';
/** Exit fade length; the native splash is hidden first, then this fades out. */
const EXIT_DURATION_MS = 450;

export interface AnimatedSplashProps {
  /** Flip to true once the app is ready (or failed) to start the exit. */
  shouldHide: boolean;
  /** Called after the exit fade, once the native splash is hidden. */
  onHidden: () => void;
  testID?: string;
}

/**
 * Animated launch screen: solid forest (matching the native splash so the
 * handoff is seamless), crossfading into a forest-to-teal gradient with the
 * brand mark rising in, the Gochao wordmark, and a loading indicator for
 * slow starts. Calls `onHidden` exactly once after fading out.
 */
export function AnimatedSplash({ shouldHide, onHidden, testID = 'splash-screen' }: AnimatedSplashProps) {
  // One-shot exit guard: hide the native splash, then let the shell
  // unmount this view (its `exiting` fade plays on unmount).
  const exitStartedRef = useRef(false);

  useEffect(() => {
    if (!shouldHide || exitStartedRef.current) {
      return;
    }
    exitStartedRef.current = true;
    const timer = setTimeout(() => {
      // Reveal this view first (native drops away underneath it); the shell
      // unmounts it right after, playing the fade below.
      SplashScreen.hideAsync().then(onHidden, onHidden);
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shouldHide, onHidden]);

  return (
    <Animated.View
      exiting={FadeOut.duration(EXIT_DURATION_MS)}
      style={styles.fill}
      testID={testID}
    >
      {/* Solid base matches the native splash background exactly. */}
      <View style={styles.base} />
      <Animated.View entering={FadeIn.duration(700)} style={styles.fill}>
        <LinearGradient
          colors={SPLASH_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      <View style={styles.center}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Animated.View entering={ZoomIn.duration(650).delay(100)}>
            <Image
              source={require('../../assets/images/splash-mark.png')}
              style={styles.mark}
              testID="splash-mark"
            />
          </Animated.View>
        </Animated.View>
        <Animated.View entering={FadeInUp.duration(600).delay(300)}>
          <Text style={styles.wordmark} testID="splash-name">
            GOCHAO
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(500).delay(600)} style={styles.spinner}>
          <ActivityIndicator size="small" color={SPLASH_INK} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: SPLASH_BASE,
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  mark: {
    width: 148,
    height: 148,
  },
  wordmark: {
    color: SPLASH_INK,
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: 10,
    includeFontPadding: false,
  },
  spinner: {
    height: 24,
  },
});
