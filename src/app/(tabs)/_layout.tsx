import { useRouter } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fade } from '@/components/Fade';
import { IconButton } from '@/components/ScreenHeader';
import { Txt } from '@/components/Txt';
import { tick } from '@/lib/haptics';
import { colors, radius, size, space, type } from '@/theme';

function TabLabel({
  label,
  isFocused,
  onPress,
  ...props
}: TabTriggerSlotProps & { label: string }) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.tab, isFocused && styles.tabActive]}
      onPress={(event) => {
        if (!isFocused) tick();
        onPress?.(event);
      }}
    >
      <Txt
        variant="tab"
        color={isFocused ? 'textPrimary' : 'textTertiary'}
        maxFontSizeMultiplier={1.2}
        style={styles.tabText}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

// Floating bottom bar: two text tabs and settings on the right (SPEC section 5).
export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Sits a little into the home-indicator area, as system tab bars do.
  const bottom = Math.max(insets.bottom - space[2], space[3]);

  return (
    <Tabs style={styles.root}>
      <TabSlot />
      {/* Rows dissolve behind the bar instead of sliding under a hard edge. */}
      <Fade edge="bottom" height={bottom + size.tabBar + space[8]} />
      <TabList style={[styles.bar, { bottom }]}>
        <TabTrigger name="upcoming" href="/upcoming" asChild>
          <TabLabel label="Upcoming" />
        </TabTrigger>
        <TabTrigger name="archive" href="/archive" asChild>
          <TabLabel label="Archive" />
        </TabTrigger>
        <View style={styles.spacer} />
        <View style={styles.settings}>
          <IconButton
            icon="settings"
            label="Settings"
            color={colors.textSecondary}
            onPress={() => router.push('/settings')}
          />
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bar: {
    position: 'absolute',
    left: size.screenPadding,
    right: size.screenPadding,
    height: size.tabBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space[1],
    padding: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tab: {
    height: size.tabBar - space[2] * 2 - 2,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.surfaceRaised,
  },
  tabText: {
    // Letter-spacing trails the last letter; pull it back so the word sits centred.
    marginRight: -type.tab.letterSpacing,
  },
  spacer: {
    flex: 1,
  },
  settings: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
});
