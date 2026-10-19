import { StyleSheet, View } from 'react-native';

import { colors, radius, space, type } from '@/theme';

import { Txt } from './Txt';

// Marks invented data so it is never mistaken for a real event (project rule).
export function SampleBadge() {
  return (
    <View style={styles.badge} accessible accessibilityLabel="Sample data">
      <Txt variant="badge" color="sampleBadgeText" maxFontSizeMultiplier={1.2} style={styles.text}>
        Sample
      </Txt>
    </View>
  );
}

/** An imported event its calendar no longer has. Quieter than Sample: the event's screen says more. */
export function RemovedBadge() {
  return (
    <View style={[styles.badge, styles.removed]} accessible accessibilityLabel="Removed from calendar">
      <Txt variant="badge" color="textSecondary" maxFontSizeMultiplier={1.2} style={styles.text}>
        Removed
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sampleBadge,
    borderRadius: radius.inner,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  removed: {
    backgroundColor: colors.surfaceRaised,
  },
  text: {
    // Letter-spacing adds space after the last letter too; pull it back so the word
    // sits centred.
    marginRight: -type.badge.letterSpacing,
  },
});
