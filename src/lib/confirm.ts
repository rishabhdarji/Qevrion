import { Alert, Platform } from 'react-native';

/** Asks before something that cannot be undone, then runs `onConfirm`. */
export function confirmDestructive(
  title: string,
  message: string,
  action: string,
  onConfirm: () => void,
): void {
  // Alert does nothing in the desktop web preview, so that asks the browser instead.
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
