import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StepBars } from '@/components/StepBars';
import { Txt } from '@/components/Txt';
import { colors, covers, radius, size, space } from '@/theme';

const PAGES = [
  {
    title: 'Every event,\nin one calm place.',
    body: 'Everything you have said yes to, what is next, and the way to the door.',
    primary: 'Continue',
  },
  {
    title: 'Bring in\nyour events.',
    body: 'From your iPhone calendar, including what Partiful adds there, or an .ics file. Nothing leaves your phone.',
    primary: 'Import events',
  },
  {
    title: 'A nudge at\nthe right time.',
    body: 'A day, two hours and thirty minutes before. Change it any time.',
    primary: 'Turn on reminders',
  },
] as const;

// Artwork is drawn in a 390 x 400 box and scaled to whatever room the page has, so it
// shrinks on a small phone instead of crowding the text.
const ART_BOX = '0 0 390 400';
const ink = colors.textPrimary;

/** Page 1: the mark, large, with an accent dot at its centre: you are here. */
function ArtGather() {
  return (
    <G>
      <Circle cx={185} cy={190} r={176} fill="none" stroke={ink} strokeOpacity={0.05} strokeWidth={1.5} />
      <Circle cx={185} cy={190} r={140} fill="none" stroke={ink} strokeOpacity={0.08} strokeWidth={1.5} />
      <Path
        d="M227 280.8A100 100 0 1 1 275.8 232"
        fill="none"
        stroke={ink}
        strokeOpacity={0.9}
        strokeWidth={26}
      />
      <Path d="M218 223L333 338" stroke={ink} strokeOpacity={0.9} strokeWidth={26} strokeLinecap="round" />
      <Circle cx={185} cy={190} r={8} fill={colors.accent} />
      <Circle cx={185} cy={190} r={20} fill="none" stroke={colors.accent} strokeOpacity={0.4} strokeWidth={1.5} />
    </G>
  );
}

/** Page 2: three event cards fanning into one stack, with a plus for "add". */
function ArtImport() {
  const card = (rotate: number, y: number, fill: string, opacity: number) => (
    <G transform={`rotate(${rotate} 195 ${y + 80})`} opacity={opacity}>
      <Rect x={75} y={y} width={240} height={160} rx={radius.card} fill={fill} stroke={ink} strokeOpacity={0.14} />
      <Rect x={99} y={y + 26} width={120} height={12} rx={6} fill={ink} fillOpacity={0.55} />
      <Rect x={99} y={y + 50} width={72} height={8} rx={4} fill={ink} fillOpacity={0.25} />
      <Rect x={99} y={y + 116} width={84} height={22} rx={11} fill={ink} fillOpacity={0.12} />
    </G>
  );
  return (
    <G>
      {card(-10, 66, covers.moss[0], 0.5)}
      {card(7, 102, covers.indigo[0], 0.75)}
      {card(-2, 146, covers.plum[0], 1)}
      <Circle cx={315} cy={146} r={17} fill={colors.accent} />
      <Path d="M307 146h16M315 138v16" stroke={colors.background} strokeWidth={2.5} strokeLinecap="round" />
    </G>
  );
}

/** Page 3: a timeline of three moments, the last one ringing out. */
function ArtRemind() {
  return (
    <G>
      <Path d="M40 200H300" stroke={ink} strokeOpacity={0.14} strokeWidth={1.5} />
      <Circle cx={70} cy={200} r={5} fill={ink} fillOpacity={0.3} />
      <Circle cx={170} cy={200} r={6} fill={ink} fillOpacity={0.6} />
      {[112, 80, 48].map((r, index) => (
        <Circle
          key={r}
          cx={290}
          cy={200}
          r={r}
          fill="none"
          stroke={ink}
          strokeOpacity={0.06 + index * 0.07}
          strokeWidth={1.5}
        />
      ))}
      <Circle cx={290} cy={200} r={22} fill={colors.primaryButton} />
      <Circle cx={290} cy={200} r={8} fill={colors.accent} />
    </G>
  );
}

const ART = [ArtGather, ArtImport, ArtRemind];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [footerHeight, setFooterHeight] = useState(220);

  // ponytail: nothing is asked for or imported here yet. The real calendar import is
  // Round 3 and the notification permission is Round 6; until then both buttons move on.
  const finish = () => router.replace('/upcoming');
  const goTo = (index: number) => {
    if (index >= PAGES.length) return finish();
    // The scroll position is the one source of truth for the page: `onScroll` below
    // updates it for swipes and for this animated jump alike.
    scroller.current?.scrollTo({ x: index * width, animated: true });
  };

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="onboardingWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.glow} stopOpacity={0.6} />
            <Stop offset="0.62" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#onboardingWash)" />
      </Svg>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {PAGES.map((item, index) => {
          const Art = ART[index];
          return (
            <View
              key={item.title}
              style={[styles.page, { width, paddingTop: insets.top + space[4], paddingBottom: footerHeight }]}
            >
              <View style={styles.art}>
                <Svg width="100%" height="100%" viewBox={ART_BOX} pointerEvents="none">
                  <Art />
                </Svg>
              </View>
              <Txt variant="heading" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
                {item.title}
              </Txt>
              <Txt color="textSecondary" style={styles.body}>
                {item.body}
              </Txt>
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + space[4] }]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.steps}>
          <StepBars count={PAGES.length} current={page} />
        </View>
        <PrimaryButton label={PAGES[page].primary} onPress={() => goTo(page + 1)} />
        <SecondaryButton
          label="Not now"
          // On the first page "Not now" skips the tour; after that it skips the step.
          onPress={() => (page === 0 ? finish() : goTo(page + 1))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    flex: 1,
    paddingHorizontal: size.screenPadding,
  },
  art: {
    flex: 1,
    minHeight: 120,
    marginBottom: space[4],
  },
  body: {
    marginTop: space[3],
    marginBottom: space[6],
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: size.screenPadding,
    gap: space[3],
  },
  steps: {
    marginBottom: space[3],
  },
});
