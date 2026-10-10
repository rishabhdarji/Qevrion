import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { SampleBadge } from '@/components/SampleBadge';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatGrid } from '@/components/StatGrid';
import { Txt } from '@/components/Txt';
import { useEvent } from '@/data/events';
import { formatTime } from '@/lib/dates';
import { colors, radius, size, space } from '@/theme';

// Where the floor lines meet, in the 390 x 844 drawing box.
const HORIZON = { x: 195, y: 300 };
const FLOOR_LINES = [-200, -60, 60, 140, 250, 330, 450, 590];

// AR Walk shell.
// ponytail: no camera, GPS or compass yet. Round 7 puts the live camera behind this
// and turns the arrow with the phone's heading.
export default function ArWalk() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);

  return (
    <View style={styles.root}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        accessibilityRole="image"
        accessibilityLabel="Arrow pointing ahead"
      >
        <Defs>
          <LinearGradient id="walkBackdrop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.glow} />
            <Stop offset="0.45" stopColor={colors.surface} />
            <Stop offset="1" stopColor={colors.background} />
          </LinearGradient>
        </Defs>
        <Rect width={390} height={844} fill="url(#walkBackdrop)" />
        {/* Lines running to a horizon stand in for the ground the camera will show. */}
        {FLOOR_LINES.map((x) => (
          <Path
            key={x}
            d={`M${HORIZON.x} ${HORIZON.y}L${x} 844`}
            stroke={colors.textPrimary}
            strokeOpacity={0.06}
            strokeWidth={1.5}
          />
        ))}
        {/* Three chevrons shrinking toward the horizon read as an arrow on the ground. */}
        <G
          transform="translate(0 -50)"
          fill="none"
          stroke={colors.accent}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M161 477L195 449L229 477" strokeWidth={11} strokeOpacity={0.3} />
          <Path d="M145 542L195 500L245 542" strokeWidth={16} strokeOpacity={0.6} />
          <Path d="M125 630L195 570L265 630" strokeWidth={22} />
        </G>
      </Svg>

      <View style={[styles.instruction, { marginTop: insets.top + space[3] }]}>
        <View style={styles.instructionTop}>
          <Txt variant="label" color="textSecondary">
            In 120 ft
          </Txt>
          <SampleBadge />
        </View>
        <Txt variant="title" accessibilityRole="header">
          Turn left onto Alder Row
        </Txt>
      </View>

      <View style={styles.middle}>
        <Txt variant="caption" color="textSecondary" style={styles.notice}>
          Preview. The camera view arrives in a later build.
        </Txt>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
        <StatGrid
          items={[
            { label: 'Distance left', value: '0.6 mi' },
            { label: 'Arrive', value: event ? formatTime(event.startsAt - 10 * 60_000) : 'Soon' },
          ]}
        />
        <SecondaryButton label="End" color="destructive" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  instruction: {
    marginHorizontal: size.screenPadding,
    padding: space[5],
    gap: space[2],
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  instructionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  middle: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: space[4],
  },
  notice: {
    textAlign: 'center',
    paddingHorizontal: space[8],
  },
  sheet: {
    paddingTop: space[6],
    paddingHorizontal: size.screenPadding,
    gap: space[5],
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    backgroundColor: colors.surface,
  },
});
