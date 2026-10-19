import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RouteMap } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { StatGrid } from '@/components/StatGrid';
import { Txt } from '@/components/Txt';
import { getSettings } from '@/data/db';
import { useEvent } from '@/data/events';
import { useWalkingRoute } from '@/data/routes';
import { useNow } from '@/lib/countdown';
import { formatTime } from '@/lib/dates';
import { locateVenues } from '@/lib/geocode';
import { isPlace } from '@/lib/geo';
import { usePosition, useLocationAccess, type LocationAccess } from '@/lib/location';
import { appleMapsWalkingUrl, googleMapsWalkingUrl } from '@/lib/maps';
import { walkSummary } from '@/lib/walkSummary';
import type { QevrionEvent } from '@/types';
import { colors, radius, space } from '@/theme';

/** Why there is no map, when there is none. */
function whyNoMap(event: QevrionEvent): { title: string; body: string } {
  if (event.isSample) {
    return {
      title: 'A sample event',
      body: 'Its address is invented, so it is not on the map. Add or import a real event to see a route.',
    };
  }
  if (event.geocodeStatus === 'notFound') {
    return {
      title: 'Not found on the map',
      body: 'Apple Maps could not find this address, so there is no route. The buttons below may still find it.',
    };
  }
  return {
    title: 'Finding the address',
    body: 'Apple Maps is looking this address up. It needs a connection; the map appears here once it is found.',
  };
}

/** The card that asks for location, just before it is needed, after saying why. */
function LocationCard({ access, ask }: { access: LocationAccess; ask: () => void }) {
  if (access === 'checking' || access === 'granted') return null;
  const [title, body, action, onPress] =
    access === 'ask'
      ? [
          'Walk from where you are',
          'To draw the route and work out the time, Qevrion needs your location while the app is open. Never in the background.',
          'Use my location',
          ask,
        ]
      : access === 'denied'
        ? [
            'Location is off for Qevrion',
            'Without it the map shows only the venue. To turn it on, open Settings and choose Location, While Using the App. In Expo Go this setting is under Expo Go.',
            'Open Settings',
            () => Linking.openSettings(),
          ]
        : [
            'Location Services are off',
            'They are off for the whole iPhone. Turn them on in Settings, Privacy & Security, Location Services.',
            null,
            null,
          ];
  return (
    <Card style={styles.locationCard}>
      <View style={styles.locationTitle}>
        <Icon name="pin" size={18} color={colors.accent} />
        <Txt variant="button">{title}</Txt>
      </View>
      <Txt variant="bodySmall" color="textSecondary">
        {body}
      </Txt>
      {action && onPress ? <SecondaryButton label={action} onPress={onPress} /> : null}
    </Card>
  );
}

// Navigate: the map with your position, the venue and the walking route, the numbers
// that matter, and the two ways to hand the walk to a maps app.
export default function Navigate() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const { access, ask } = useLocationAccess();
  const position = usePosition(access === 'granted');
  const now = useNow(30_000);

  const venue = useMemo(
    () => (event && isPlace(event) && event.geocodeStatus === 'located' ? { lat: event.lat, lng: event.lng } : null),
    [event],
  );
  const answer = useWalkingRoute(position, venue);

  // An address still waiting is looked up now, in case the app has not had the chance.
  useEffect(() => {
    if (event?.geocodeStatus === 'pending') locateVenues();
  }, [event?.geocodeStatus]);

  if (!event) {
    return (
      <Screen glow>
        <ScreenHeader />
        <EmptyState title="Event not found" body="Go back and pick an event to navigate to." />
      </Screen>
    );
  }

  const units = getSettings().units;
  const summary =
    position && venue && answer
      ? walkSummary(answer, position, venue, event.startsAt, now, units)
      : null;
  const openIn = (app: string, url: string) =>
    Linking.openURL(url).catch(() => Alert.alert(`Could not open ${app}`));
  const noMap = venue ? null : whyNoMap(event);

  return (
    <Screen
      glow
      footer={
        <PrimaryButton
          // ponytail: "Preview" until Round 5 makes AR Walk real, then "Start AR Walk".
          label="Preview AR Walk"
          onPress={() => router.push({ pathname: '/walk/[id]', params: { id: event.id } })}
        />
      }
    >
      <ScreenHeader />
      <SectionLabel>Walking route</SectionLabel>
      <Txt variant="heading" accessibilityRole="header" style={styles.title}>
        {event.locationText}
      </Txt>
      <Txt color="textSecondary">
        {event.title} · {formatTime(event.startsAt)}
      </Txt>

      <View style={styles.map}>
        {venue ? (
          <RouteMap
            venue={venue}
            me={position}
            line={answer?.kind === 'route' ? answer.route.line : null}
            accessibilityLabel={summary?.mapLabel ?? 'Map showing the venue'}
          />
        ) : (
          <View style={styles.noMap} accessible>
            <Icon name="pin" size={24} color={colors.textTertiary} />
            <Txt variant="button" style={styles.center}>
              {noMap!.title}
            </Txt>
            <Txt variant="bodySmall" color="textSecondary" style={styles.center}>
              {noMap!.body}
            </Txt>
          </View>
        )}
      </View>

      {venue ? <LocationCard access={access} ask={ask} /> : null}

      {venue && access === 'granted' && !summary ? (
        <View style={styles.waiting} accessible accessibilityLabel="Finding where you are and the route">
          <ActivityIndicator color={colors.textSecondary} />
          <Txt variant="caption" color="textSecondary">
            {position ? 'Finding the walking route…' : 'Finding where you are…'}
          </Txt>
        </View>
      ) : null}

      {summary ? (
        <>
          <Txt
            variant="caption"
            color="textTertiary"
            style={styles.note}
            accessibilityLiveRegion="polite"
          >
            {summary.note}
          </Txt>
          {summary.offerKey ? (
            <Txt
              variant="caption"
              color="accent"
              accessibilityRole="link"
              style={styles.keyLink}
              onPress={() => router.push('/route-key')}
            >
              Add a free route key in Settings
            </Txt>
          ) : null}
          <StatGrid items={summary.stats} />
        </>
      ) : null}

      {/* Always here, whatever the map could or could not show. */}
      <View style={styles.maps}>
        <SecondaryButton
          label="Open in Apple Maps"
          accessibilityHint="Opens walking directions in Apple Maps"
          onPress={() => openIn('Apple Maps', appleMapsWalkingUrl(event.locationText))}
        />
        <SecondaryButton
          label="Open in Google Maps"
          accessibilityHint="Opens walking directions in Google Maps, or on its website if the app is not installed"
          onPress={() => openIn('Google Maps', googleMapsWalkingUrl(event.locationText))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: space[2],
    marginBottom: space[1],
  },
  maps: {
    marginTop: space[6],
    gap: space[3],
  },
  map: {
    // Wider than tall, so the stats stay in view above the pinned button.
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginTop: space[6],
    marginBottom: space[3],
  },
  noMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    padding: space[6],
  },
  center: {
    textAlign: 'center',
  },
  locationCard: {
    gap: space[3],
    marginBottom: space[3],
  },
  locationTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[3],
  },
  note: {
    marginBottom: space[2],
  },
  keyLink: {
    alignSelf: 'flex-start',
    // A tap target of at least 44 pt, for a one-line link.
    paddingVertical: space[3],
    marginTop: -space[2],
    marginBottom: space[2],
  },
});
