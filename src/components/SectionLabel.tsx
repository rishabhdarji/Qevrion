import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Txt } from './Txt';

type Props = {
  children: string;
  /** Shown at the right, for example how many events are in the group. */
  count?: number;
  style?: StyleProp<ViewStyle>;
};

// Small uppercase label above a group. VoiceOver reads it as a heading.
export function SectionLabel({ children, count, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <Txt variant="label" color="textTertiary" accessibilityRole="header" style={styles.text}>
        {children}
      </Txt>
      {count === undefined ? null : (
        <Txt variant="label" color="textTertiary" accessibilityLabel={`${count} in this group`}>
          {count}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  text: {
    flexShrink: 1,
  },
});
