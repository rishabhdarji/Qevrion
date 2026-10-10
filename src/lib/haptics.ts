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
