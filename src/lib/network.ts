import { useNetworkState } from 'expo-network';

/**
 * Whether the phone can reach the internet, updated the moment Wi-Fi or mobile data
 * is turned off or on. False only when the phone says so; while it has not said yet,
 * the app carries on as if online, so nothing flashes up on opening.
 */
export function useOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
