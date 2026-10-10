import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatCountdown, useNow } from '@/lib/countdown';
import { formatWhen } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';
import type { QevrionEvent } from '@/types';

import { EventCover } from './EventCover';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { SampleBadge } from './SampleBadge';
import { Txt } from './Txt';

const HOUR = 3_600_000;

// Owns the one-second tick, so nothing else on the screen re-renders with it.
function Countdown({ startsAt }: { startsAt: number }) {
  const left = startsAt - useNow(1000);
  return (
    <View style={styles.countdown}>
      {/* Inside the last hour the clock gives way to an accent dot. */}
      {left < HOUR ? <View style={styles.soonDot} /> : <Icon name="clock" size={14} />}
      <Txt variant="bodySmall" maxFontSizeMultiplier={1.3} style={styles.countdownText}>
        {formatCountdown(left)}
      </Txt>
    </View>
  );
}

type Props = {
  event: QevrionEvent;
  onPress?: (event: QevrionEvent) => void;
};

// The next event, large: countdown at the top, serif title over the cover's scrim.
export function EventHeroCard({ event, onPress }: Props) {
  const { height } = useWindowDimensions();
  // About a third of the screen, so a small phone still shows the first row below it.
  // It grows if large text needs more room.
  const minHeight = Math.min(Math.max(height * 0.36, 240), 340);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Next event${event.isSample ? ', sample' : ''}: ${event.title}, ${formatWhen(event.startsAt)}, ${event.locationText}`}
      accessibilityHint="Opens the event"
      pressedScale={0.985}
      style={[styles.card, { minHeight }]}
      onPress={onPress ? () => onPress(event) : undefined}
    >
      <EventCover colors={event.cover} />
      <View style={styles.top}>
        <Countdown startsAt={event.startsAt} />
        {event.isSample ? <SampleBadge /> : null}
      </View>
      <View style={styles.bottom}>
        <Txt variant="display" maxFontSizeMultiplier={1.3} numberOfLines={2}>
          {event.title}
        </Txt>
        <Txt variant="bodySmall" numberOfLines={2}>
          {formatWhen(event.startsAt)} · {event.locationText}
        </Txt>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    padding: space[5],
    gap: space[8],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  countdown: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  soonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  countdownText: {
    fontFamily: fonts.medium,
    // Digits keep their width, so the line does not shuffle as it ticks.
    fontVariant: ['tabular-nums'],
  },
  bottom: {
    gap: space[2],
  },
});
