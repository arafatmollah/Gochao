import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Forest-to-teal launch gradient (starts on the native splash color). */
const SPLASH_GRADIENT: [string, string] = ['#0A4A3E', '#0E7565'];
const SPLASH_BASE = '#0A4A3E';
const SPLASH_INK = '#FAF7F2';
const WORD = 'GOCHAO';
/** Stagger between letters rising in, left to right. */
const LETTER_IN_STAGGER_MS = 70;
/** Pause on the full wordmark before the cascade starts. */
const LETTERS_OUT_AT_MS = 950;
/** Stagger between letters flying out, right to left. */
const LETTER_OUT_STAGGER_MS = 90;
const LETTER_OUT_DURATION_MS = 300;
/** Pixels each exiting letter travels to the right as it fades. */
const LETTER_EXIT_SHIFT = 52;
/** The mark springs in while the last letters leave, revealing the icon. */
const ICON_IN_AT_MS = 1150;
/** Sequence length; the exit waits for both this and app readiness. */
const SEQUENCE_DONE_AT_MS = 1950;
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
 * handoff is seamless), crossfading into a forest-to-teal gradient. The
 * Gochao wordmark rises letter by letter, then each letter flies out to
 * the right starting from the last one — revealing the app icon with a
 * soft spring bounce. Holds the icon (with a loader for slow starts)
 * until the app is ready, then fades out. Calls `onHidden` exactly once.
 *
 * The native splash is dismissed as soon as this overlay has laid out, so
 * the choreography plays on top of the app instead of behind the native
 * launch image (which `preventAutoHideAsync` would otherwise keep up).
 */
export function AnimatedSplash({ shouldHide, onHidden, testID = 'splash-screen' }: AnimatedSplashProps) {
  const [lettersOut, setLettersOut] = useState(false);
  const [iconIn, setIconIn] = useState(false);
  const [sequenceDone, setSequenceDone] = useState(false);

  // Fixed choreography clock; the exit below additionally waits for the app.
  useEffect(() => {
    const outTimer = setTimeout(() => setLettersOut(true), LETTERS_OUT_AT_MS);
    const iconTimer = setTimeout(() => setIconIn(true), ICON_IN_AT_MS);
    const doneTimer = setTimeout(() => setSequenceDone(true), SEQUENCE_DONE_AT_MS);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(iconTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  // One-shot exit guard: once the choreography AND the app are ready, hold
  // a beat (matching the fade) so the shell can unmount this view (its
  // `exiting` fade plays on unmount).
  const exitStartedRef = useRef(false);
  useEffect(() => {
    if (!shouldHide || !sequenceDone || exitStartedRef.current) {
      return;
    }
    exitStartedRef.current = true;
    const timer = setTimeout(onHidden, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shouldHide, sequenceDone, onHidden]);

  // Reveal this overlay by dropping the native splash underneath it as soon
  // as it has laid out; the solid base matches the native splash exactly, so
  // the swap is invisible and the choreography above becomes visible. Native
  // only in practice — on web `hideAsync` is a no-op.
  const nativeSplashHiddenRef = useRef(false);
  const handleLayout = useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }
    nativeSplashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => {
      // Splash control unavailable: the overlay still covers the app.
    });
  }, []);

  return (
    <Animated.View
      exiting={FadeOut.duration(EXIT_DURATION_MS)}
      onLayout={handleLayout}
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
        <View style={styles.stage}>
          <SplashMark visible={iconIn} />
          <View style={styles.wordRow} testID="splash-name">
            {WORD.split('').map((char, index) => (
              <SplashLetter
                key={`${char}-${index}`}
                char={char}
                index={index}
                exiting={lettersOut}
                testID={`splash-letter-${index}`}
              />
            ))}
          </View>
        </View>
        <Animated.View entering={FadeIn.duration(500).delay(600)} style={styles.spinner}>
          <ActivityIndicator size="small" color={SPLASH_INK} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** One wordmark letter: rises in with its siblings, then flies right and fades. */
function SplashLetter({
  char,
  index,
  exiting,
  testID,
}: {
  char: string;
  index: number;
  exiting: boolean;
  testID?: string;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (exiting) {
      progress.value = withDelay(
        (WORD.length - 1 - index) * LETTER_OUT_STAGGER_MS,
        withTiming(1, { duration: LETTER_OUT_DURATION_MS }),
      );
    }
  }, [exiting, index, progress]);
  const exitStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateX: progress.value * LETTER_EXIT_SHIFT }],
  }));

  return (
    <Animated.View entering={FadeInUp.duration(350).delay(index * LETTER_IN_STAGGER_MS)}>
      <Animated.View style={exitStyle}>
        <Text style={styles.letter} testID={testID}>
          {char}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/** The app icon: springs from nothing to full size with a soft bounce. */
function SplashMark({ visible }: { visible: boolean }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 13, stiffness: 170 });
    }
  }, [visible, scale]);
  const springStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.markLayer, springStyle]}>
      <Image
        source={require('../../assets/images/splash-mark.png')}
        style={styles.mark}
        testID="splash-mark"
      />
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
  },
  stage: {
    width: 280,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 148,
    height: 148,
  },
  wordRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  letter: {
    color: SPLASH_INK,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
    includeFontPadding: false,
  },
  spinner: {
    height: 24,
    marginTop: 32,
  },
});
