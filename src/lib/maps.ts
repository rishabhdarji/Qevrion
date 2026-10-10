/** A link that opens Apple Maps with walking directions from where you are to `address`. */
export function appleMapsWalkingUrl(address: string): string {
  // The older `daddr` / `dirflg` form on purpose: every iOS version the app supports
  // understands it. Apple's newer `/directions?destination=` form needs iOS 18.4.
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=w`;
}
