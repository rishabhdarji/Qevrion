import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

type Props = {
  title: string;
  /** What still works, and what to do about it. */
  body: string;
  icon?: IconName;
  /** On a dark backing, for use over the camera, where a tint alone cannot be read. */
  solid?: boolean;
};

// An amber "heads up", not an error: offline, or GPS and compass not to be trusted.
// VoiceOver hears it when it appears.
export function NoticeBanner({ title, body, icon = 'warning', solid = false }: Props) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
  }, [title, body]);

  return (
    <View style={[styles.banner, solid && styles.solid]} accessible accessibilityRole="alert">
      <Icon name={icon} size={18} color={colors.warning} />
      <View style={styles.text}>
        <Txt variant="button">{title}</Txt>
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
  solid: {
    marginTop: 0,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
