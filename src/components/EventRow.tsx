import { StyleSheet, View } from 'react-native';

import { formatDay, formatEventTime, formatMonthShort } from '@/lib/dates';
import { colors, radius, size, space } from '@/theme';
import type { QevrionEvent } from '@/types';

import { PressableScale } from './PressableScale';
import { SampleBadge } from './SampleBadge';
import { Txt } from './Txt';

type Props = {
  event: QevrionEvent;
  /** Quieter tile and title, for events that are over. */
  muted?: boolean;
  onPress?: (event: QevrionEvent) => void;
};

/** Where a hairline between rows should start so it lines up with the text. */
export const EVENT_ROW_TEXT_INSET = size.thumb + space[3];

// One event in a list: a date tile in the cover colour, serif title, time and venue.
// Plain views only, so a long list stays cheap to draw.
export function EventRow({ event, muted = false, onPress }: Props) {
  // A hand-typed event may have no venue.
  const detail = [formatEventTime(event), event.locationText].filter(Boolean);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${[event.title, formatDay(event.startsAt), ...detail].join(', ')}${event.isSample ? ', sample data' : ''}`}
      pressedScale={0.985}
      style={styles.row}
      onPress={onPress ? () => onPress(event) : undefined}
    >
      <View style={[styles.tile, { backgroundColor: event.cover[0] }, muted && styles.mutedTile]}>
        <Txt variant="rowTitle" maxFontSizeMultiplier={1.2}>
          {new Date(event.startsAt).getDate()}
        </Txt>
        <Txt variant="badge" maxFontSizeMultiplier={1.2}>
          {formatMonthShort(event.startsAt)}
        </Txt>
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Txt
            variant="rowTitle"
            color={muted ? 'textSecondary' : 'textPrimary'}
            numberOfLines={1}
            style={styles.title}
          >
            {event.title}
          </Txt>
          {event.isSample ? <SampleBadge /> : null}
        </View>
        <Txt variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {detail.join(' · ')}
        </Txt>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  tile: {
    width: size.thumb,
    minHeight: size.thumb,
    borderRadius: radius.inner,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[1],
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  mutedTile: {
    // Quieter, but the date on it is still the only place the date shows.
    opacity: 0.75,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    flex: 1,
  },
});
