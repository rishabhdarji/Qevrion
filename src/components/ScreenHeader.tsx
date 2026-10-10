import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, size, space } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

type IconButtonProps = {
  icon: IconName;
  /** What VoiceOver reads, for example "Close". */
  label: string;
  onPress?: () => void;
  color?: string;
};

export function IconButton({ icon, label, onPress, color = colors.textPrimary }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

type Props = {
  title?: string;
  /** `back` for pushed screens, `close` for sheets. */
  leading?: 'back' | 'close';
  right?: ReactNode;
};

export function ScreenHeader({ title, leading = 'back', right }: Props) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconButton
        icon={leading}
        label={leading === 'back' ? 'Back' : 'Close'}
        onPress={() => router.back()}
      />
      {title ? (
        <Txt
          accessibilityRole="header"
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </Txt>
      ) : (
        <View style={styles.title} />
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space[4],
    // Lines the icon's glyph up with the screen padding rather than its tap area.
    marginHorizontal: -space[3],
  },
  iconButton: {
    width: size.tap,
    height: size.tap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  right: {
    minWidth: size.tap,
    alignItems: 'flex-end',
    paddingRight: space[3],
  },
});
