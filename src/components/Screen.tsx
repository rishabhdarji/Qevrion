import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, size, space } from '@/theme';

import { Fade } from './Fade';

type Options = {
  /** iOS sheets start below the status bar, so they skip the top safe-area inset. */
  sheet?: boolean;
  /** Extra room at the bottom, for example under the floating tab bar. */
  bottomSpace?: number;
  /** True when a footer is pinned below, which then owns the bottom safe area. */
  hasFooter?: boolean;
};

/** Content padding for a screen. Screens that bring their own list pass it on. */
export function useScreenPadding({ sheet = false, bottomSpace = 0, hasFooter = false }: Options = {}) {
  const insets = useSafeAreaInsets();
  const top = sheet && Platform.OS === 'ios' ? 0 : insets.top;
  return {
    paddingTop: top + (sheet ? space[4] : space[2]),
    paddingHorizontal: size.screenPadding,
    paddingBottom: (hasFooter ? space[8] : insets.bottom + space[6]) + bottomSpace,
  };
}

type Props = Pick<Options, 'sheet' | 'bottomSpace'> & {
  children: ReactNode;
  /** Soft slate glow behind the header. On for header-led screens, off on Home. */
  glow?: boolean;
  /**
   * `false` when the child is its own list (give it `useScreenPadding`).
   * `'bleed'` scrolls with no padding, for content that runs edge to edge from the top.
   */
  scroll?: boolean | 'bleed';
  /** Pinned under the content, above the home indicator. For the main action. */
  footer?: ReactNode;
};

const GLOW_HEIGHT = 320;

function TopGlow() {
  return (
    <Svg style={styles.glow} width="100%" height={GLOW_HEIGHT} pointerEvents="none">
      <Defs>
        {/* Four stops, so the falloff does not band on an OLED screen. */}
        <RadialGradient id="topGlow" cx="50%" cy="0%" r="80%">
          <Stop offset="0" stopColor={colors.glow} stopOpacity={0.6} />
          <Stop offset="0.4" stopColor={colors.glow} stopOpacity={0.3} />
          <Stop offset="0.75" stopColor={colors.glow} stopOpacity={0.08} />
          <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#topGlow)" />
    </Svg>
  );
}

export function Screen({
  children,
  glow = false,
  scroll = true,
  sheet = false,
  footer,
  bottomSpace = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const padding = useScreenPadding({ sheet, bottomSpace, hasFooter: !!footer });
  const statusBar = sheet && Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={styles.root}>
      {glow ? <TopGlow /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={
            scroll === 'bleed' ? { paddingBottom: padding.paddingBottom } : padding
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
      {/* Without a glow, text would otherwise run straight into the clock. */}
      {scroll !== 'bleed' && !glow && statusBar > 0 ? (
        <Fade edge="top" height={statusBar + space[3]} />
      ) : null}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space[4] }]}>
          <View style={styles.footerFade}>
            <Fade edge="bottom" height={space[8]} />
          </View>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  footer: {
    paddingHorizontal: size.screenPadding,
    gap: space[3],
    backgroundColor: colors.background,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -space[8],
    height: space[8],
  },
});
