import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';

import { Icon } from './Icon';
import { Txt } from './Txt';

type Props = {
  /** What still works, and what comes back once online. */
  body: string;
};

// Shown while the phone is offline, and gone the moment it is back. VoiceOver hears it
// when it appears.
export function OfflineBanner({ body }: Props) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`You're offline. ${body}`);
  }, [body]);

  return (
    <View style={styles.banner} accessible accessibilityRole="alert">
      <Icon name="offline" size={18} color={colors.warning} />
      <View style={styles.text}>
        <Txt variant="button">You&apos;re offline</Txt>
        <Txt variant="caption" color="textSecondary">
          {body}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'flex-start',
    padding: space[4],
    marginTop: space[4],
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningTint,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
