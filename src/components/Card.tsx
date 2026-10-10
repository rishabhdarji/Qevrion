import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, size, space, type ColorName } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type CardProps = {
  children: ReactNode;
  /** Bright outline and a lighter fill, for the chosen option in a list. */
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Set to false when the card holds `ListRow`s, which bring their own padding. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  selected = false,
  onPress,
  accessibilityLabel,
  padded = true,
  style,
}: CardProps) {
  const cardStyle = [styles.card, padded && styles.padded, selected && styles.selected, style];

  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={cardStyle}
      onPress={onPress}
    >
      {children}
    </PressableScale>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Short state under the title, in the accent colour. */
  status?: string;
  icon?: IconName;
  titleColor?: ColorName;
  /** Shown on the right, for example a value, a switch or a check mark. */
  right?: ReactNode;
  /** Draws a hairline above the row. Use on every row but the first. */
  divider?: boolean;
  onPress?: () => void;
};

// A row inside a `Card padded={false}`: title, grey subtitle, accent status.
export function ListRow({
  title,
  subtitle,
  status,
  icon,
  titleColor = 'textPrimary',
  right,
  divider = false,
  onPress,
}: ListRowProps) {
  const content = (
    <>
      {icon ? <Icon name={icon} size={20} color={colors.textSecondary} /> : null}
      <View style={styles.rowText}>
        <Txt color={titleColor}>{title}</Txt>
        {subtitle ? (
          <Txt variant="bodySmall" color="textSecondary">
            {subtitle}
          </Txt>
        ) : null}
        {status ? (
          <Txt variant="bodySmall" color="accent">
            {status}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <Icon name="forward" size={14} color={colors.decoration} /> : null}
    </>
  );

  const rowStyle = [styles.row, divider && styles.divider];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, status].filter(Boolean).join(', ')}
      style={rowStyle}
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  padded: {
    padding: space[5],
  },
  selected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.textPrimary,
  },
  row: {
    minHeight: size.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    // A full point: a hairline at 8% white all but disappears on a 3x screen.
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
