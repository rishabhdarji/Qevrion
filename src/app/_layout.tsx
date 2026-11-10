import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { Inter_300Light } from '@expo-google-fonts/inter/300Light';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { reloadAppAsync } from 'expo';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { locateVenues } from '@/lib/geocode';
import { useNotificationTap, type Tap } from '@/lib/notifier';
import { syncReminders } from '@/lib/reminderSync';
import { syncCalendars } from '@/lib/sync';
import { colors } from '@/theme';

// Keep the launch screen up until the fonts are ready, so text never flashes in a
// fallback face.
SplashScreen.preventAutoHideAsync();

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const startedIn = timeZone();

/**
 * SPEC F3: tapping a notification opens its event; a digest or a preview opens Home.
 * A tap that started the app waits here until the first screen has been chosen, so the
 * event lands on top of Home and not underneath it.
 */
function useOpenTappedEvent() {
  const router = useRouter();
  const pathname = usePathname();
  const tapped = useRef<Tap | null>(null);
  const path = useRef(pathname);

  const open = useCallback(() => {
    const tap = tapped.current;
    // "/" is the splash, which is about to hand over to Home or the welcome screens.
    if (!tap || path.current === '/') return;
    tapped.current = null;
    // Nothing to open before the welcome screens are done.
    if (path.current === '/onboarding') return;
    if (!tap.eventId) router.dismissTo('/upcoming');
    else if (path.current !== `/event/${tap.eventId}`) {
      router.push({ pathname: '/event/[id]', params: { id: tap.eventId } });
    }
  }, [router]);

  useEffect(() => {
    path.current = pathname;
    open();
  }, [pathname, open]);

  useNotificationTap(
    useCallback(
      (tap: Tap) => {
        tapped.current = tap;
        // SPEC section 8, rule 3: a tap is a moment to roll the window forward.
        syncReminders();
        open();
      },
      [open],
    ),
  );
}

export default function RootLayout() {
  useOpenTappedEvent();

  // The keys are the font family names used in src/theme.ts.
  const [loaded, error] = useFonts({
    InstrumentSerif_400Regular,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    // SPEC F2: the chosen calendars are read again every time the app opens, and
    // addresses still waiting are looked up. Nothing is said if that fails; Home's
    // pull-to-refresh is where a failure is shown. Reminders are brought up to date
    // too (SPEC section 8): opening the app is what rolls the window of 60 forward.
    const refresh = () => {
      syncCalendars().catch(() => {});
      locateVenues();
      syncReminders();
    };
    refresh();
    // ponytail: every time on screen was worked out in the zone the app started in.
    // If the phone has changed zone since, start again rather than show stale times.
    // It drops the open screen; the upgrade is to keep the zone in state.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (timeZone() !== startedIn) reloadAppAsync();
      else refresh();
    });
    return () => subscription.remove();
  }, []);

  // If a font fails to load the app still opens, in the system font.
  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          // Screens buried in the stack stop re-rendering until they are shown again.
          freezeOnBlur: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="event/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="route-key" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reminders" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reminder-times" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="walk/[id]"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
      </Stack>
    </>
  );
}
