import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';

import type { LocationAccess } from '@/lib/location';
import { colors, space } from '@/theme';

import { Card } from './Card';
import { Icon } from './Icon';
import { SecondaryButton } from './SecondaryButton';
import { Txt } from './Txt';

type Props = {
  access: LocationAccess;
  ask: () => void;
  /** What the screen needs location for, which differs by screen. */
  title?: string;
  reason?: string;
  /** What is lost while it is off. */
  without?: string;
};

/** The card that asks for location, just before it is needed, after saying why. */
export function LocationCard({
  access,
  ask,
  title = 'Walk from where you are',
  reason = 'To draw the route and work out the time, Qevrion needs your location while the app is open. Never in the background.',
  without = 'Without it the map shows only the venue.',
}: Props) {
  if (access === 'checking' || access === 'granted') return null;
  const [heading, body, action, onPress] =
    access === 'ask'
      ? [title, reason, 'Use my location', ask]
      : access === 'denied'
        ? [
            'Location is off for Qevrion',
            `${without} To turn it on, open Settings and choose Location, While Using the App. In Expo Go this setting is under Expo Go.`,
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
    <Card style={styles.card}>
      <View style={styles.title}>
        <Icon name="pin" size={18} color={colors.accent} />
        <Txt variant="button">{heading}</Txt>
      </View>
      <Txt variant="bodySmall" color="textSecondary">
        {body}
      </Txt>
      {action && onPress ? <SecondaryButton label={action} onPress={onPress} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space[3],
    marginBottom: space[3],
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});
