import type { TextStyle } from 'react-native';

// The single source for every colour, size and type style (SPEC section 6, with the
// overrides recorded in docs/DESIGN_NOTES.md). Dark only in v0.0.1; a light theme
// would swap `colors` here and nothing else.

export const colors = {
  background: '#0E0E10',
  surface: '#1A1B20',
  surfaceRaised: '#24262C',
  hairline: 'rgba(255,255,255,0.08)',

  textPrimary: '#F2EFEA',
  textSecondary: '#A3A3AB',
  // Readable tertiary text (4.5:1 on background and surface).
  textTertiary: '#85858D',
  // The spec's original tertiary. Fails contrast, so decoration only.
  decoration: '#6B6B73',

  primaryButton: '#F4ECE8',
  primaryButtonText: '#111111',
  secondaryButtonBorder: 'rgba(255,255,255,0.25)',

  accent: '#4FB3E8',
  success: '#7ED321',
  destructive: '#F0564A',
  glow: '#2B4256',

  sampleBadge: '#15293B',
  sampleBadgeText: '#8CC8F0',

  // Behind controls that float over a cover, so they stay readable on any colour.
  overlay: 'rgba(14,14,16,0.55)',
  destructiveTint: 'rgba(240,86,74,0.12)',

  // The drawn map on Navigate until the real map arrives in Round 6.
  mapLand: '#1A2740',
  mapBlock: '#27375A',
  mapPark: '#17403F',
  markerRing: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;

// Cover washes for events without their own image: top colour, bottom colour. Both
// ends are dark enough for off-white text to pass 4.5:1.
export const covers = {
  plum: ['#4A2C4E', '#15202F'],
  teal: ['#1F4A4A', '#101820'],
  ember: ['#5A3024', '#1A1418'],
  moss: ['#33492C', '#12181A'],
  indigo: ['#2C3566', '#12141F'],
  slate: ['#2B4256', '#111418'],
  rose: ['#5A2A3C', '#17131A'],
  ochre: ['#57431F', '#17140F'],
} as const satisfies Record<string, readonly [string, string]>;

// Chosen by the owner on a sample screen: cards 28, small elements 17, buttons as pills.
export const radius = {
  card: 28,
  inner: 17,
  pill: 999,
} as const;

// 4-pt grid.
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const size = {
  screenPadding: 20,
  button: 56,
  pill: 40,
  chip: 36,
  search: 48,
  row: 64,
  thumb: 48,
  // Smallest tap target (SPEC 6, Accessibility).
  tap: 44,
  tabBar: 64,
} as const;

// Keys match the names the fonts are registered under in src/app/_layout.tsx.
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 40 },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 28 },
  // List rows: 24 pt truncates most titles on a small phone.
  rowTitle: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 24 },
  wordmark: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32 },
  heading: { fontFamily: fonts.light, fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tab: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof type;

// Critically damped: settles without overshoot (SPEC 6: gentle springs, nothing bouncy).
export const spring = { damping: 120, stiffness: 900, mass: 4 } as const;

// Also critically damped but about twice as fast, so a quick tap is still felt.
export const pressSpring = { damping: 60, stiffness: 900, mass: 1 } as const;
