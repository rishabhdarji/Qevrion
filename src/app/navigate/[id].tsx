import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SampleBadge } from '@/components/SampleBadge';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { StatGrid } from '@/components/StatGrid';
import { Txt } from '@/components/Txt';
import { useEvent } from '@/data/events';
import { formatTime } from '@/lib/dates';
import { colors, radius, space } from '@/theme';

const WALK_MINUTES = 17;
const ROUTE = 'M92 86L138 112H266L286 128V226H256L250 262';
const MINUTE = 60_000;

// ponytail: a drawing, not a map. Round 6 replaces it with Apple Maps, the phone's
// position and a real walking route.
function DrawnMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 340 300" preserveAspectRatio="xMidYMid slice">
      <Rect width={340} height={300} fill={colors.mapLand} />
      <Path d="M-20 250L120 -20h46L26 320z" fill={colors.mapPark} />
      <Rect x={150} y={26} width={104} height={74} rx={8} fill={colors.mapBlock} />
      <Rect x={270} y={20} width={90} height={96} rx={8} fill={colors.mapBlock} />
      <Rect x={130} y={122} width={150} height={92} rx={8} fill={colors.mapBlock} />
      <Rect x={296} y={136} width={70} height={110} rx={8} fill={colors.mapBlock} />
      <Rect x={112} y={236} width={128} height={80} rx={8} fill={colors.mapBlock} />
      {[10, 4.5].map((strokeWidth) => (
        <Path
          key={strokeWidth}
          d={ROUTE}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={strokeWidth > 5 ? 0.2 : 1}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <Circle cx={92} cy={86} r={7} fill={colors.success} stroke={colors.markerRing} strokeWidth={3} />
      <Circle cx={250} cy={262} r={7} fill={colors.destructive} stroke={colors.markerRing} strokeWidth={3} />
    </Svg>
  );
}

// Navigate: map card, stats, and the two ways to set off.
export default function Navigate() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);

  if (!event) {
    return (
      <Screen glow>
        <ScreenHeader />
        <EmptyState title="Event not found" body="Go back and pick an event to navigate to." />
      </Screen>
    );
  }

  const leaveBy = event.startsAt - (WALK_MINUTES + 5) * MINUTE;

  return (
    <Screen
      glow
      footer={
        <>
          <PrimaryButton label="Start AR Walk" onPress={() => router.push({ pathname: '/walk/[id]', params: { id: event.id } })} />
          <SecondaryButton label="Open in Apple Maps" />
        </>
      }
    >
      <ScreenHeader />
      <SectionLabel>Walking route</SectionLabel>
      <Txt variant="heading" accessibilityRole="header" style={styles.title}>
        {event.locationText}
      </Txt>
      <Txt color="textSecondary">
        {event.title} · {formatTime(event.startsAt)}
      </Txt>

      <View
        // Square where there is room; wider on a short phone so the stats stay in view.
        style={[styles.map, { aspectRatio: height < 700 ? 4 / 3 : 1 }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Sample map showing a walking route from your position to the venue"
      >
        <DrawnMap />
        <View style={styles.badge}>
          <SampleBadge />
        </View>
      </View>

      <StatGrid
        items={[
          { label: 'Distance', value: '0.8 mi' },
          { label: 'Walking time', value: `${WALK_MINUTES} min` },
          { label: 'Leave by', value: formatTime(leaveBy) },
          { label: 'Event starts', value: formatTime(event.startsAt) },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: space[2],
    marginBottom: space[1],
  },
  map: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.mapLand,
    marginTop: space[6],
    marginBottom: space[6],
  },
  badge: {
    position: 'absolute',
    left: space[4],
    bottom: space[4],
  },
});
