/** A link that opens Apple Maps with walking directions from where you are to `address`. */
export function appleMapsWalkingUrl(address: string): string {
  // The older `daddr` / `dirflg` form on purpose: every iOS version the app supports
  // understands it. Apple's newer `/directions?destination=` form needs iOS 18.4.
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=w`;
}
/**
 * A link that opens Google Maps with walking directions to `address`: the app if it
 * is installed, otherwise the website. A plain link, so no Google key or SDK.
 */
export function googleMapsWalkingUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=walking`;
}
