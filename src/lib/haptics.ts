import * as Haptics from 'expo-haptics';

// Haptics are silent in Low Power Mode, on web and on devices without a Taptic
// Engine. They must never throw into a press handler.

/** Light impact, for primary actions. */
export function tap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection tick, for chips, tabs and picking a card. */
export function tick(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** Two firm taps: a turn is close (AR Walk). */
export function turnSoon(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 160);
}

/** The success pattern: you have arrived (AR Walk). */
export function arrived(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
