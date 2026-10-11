import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { QevrionMark } from '@/components/QevrionMark';
import { getSettings } from '@/data/db';
import { colors } from '@/theme';

const HOLD_MS = 900;

// Once onboarding has been seen, the app opens straight on Home.
export default function Index() {
  return getSettings().onboardingDone ? <Redirect href="/upcoming" /> : <Splash />;
}

// Splash: the mark alone on near-black, then on to onboarding.
function Splash() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  useEffect(() => {
    const id = setTimeout(() => router.replace('/onboarding'), HOLD_MS);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(520)}>
        <QevrionMark size={Math.min(Math.max(width * 0.26, 88), 132)} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
