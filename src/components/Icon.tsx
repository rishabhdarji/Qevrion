import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { colors } from '@/theme';

// SF Symbols on iPhone. The android/web names are Material Symbols, used by the
// desktop preview.
const ICONS = {
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  forward: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  import: { ios: 'square.and.arrow.down', android: 'download', web: 'download' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  document: { ios: 'doc', android: 'description', web: 'description' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  person: { ios: 'person', android: 'person', web: 'person' },
  link: { ios: 'link', android: 'link', web: 'link' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  walk: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  offline: { ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

// Decorative: the control that holds the icon carries the VoiceOver label.
export function Icon({ name, size = 20, color = colors.textPrimary }: Props) {
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
