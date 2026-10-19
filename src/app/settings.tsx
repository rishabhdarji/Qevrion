import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { QevrionMark } from '@/components/QevrionMark';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { getSettings, updateSettings } from '@/data/db';
import {
  deleteAllData,
  insertSampleEvents,
  removeSampleEvents,
  useEvents,
} from '@/data/events';
import { SAMPLE_COUNT } from '@/data/sampleEvents';
import { getRouteKey } from '@/data/secrets';
import { confirmDestructive } from '@/lib/confirm';
import { tap } from '@/lib/haptics';
import { colors, space } from '@/theme';

const REPO_URL = 'https://github.com/rishabhdarji/Qevrion';

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const chosenCount = () => getSettings().importCalendarIds.length;

// A row that does something on the spot takes no arrow; an arrow promises another screen.
const NO_CHEVRON = <View />;

function Value({ children }: { children: string }) {
  return (
    <Txt variant="bodySmall" color="textSecondary">
      {children}
    </Txt>
  );
}

// Settings. Import sources, Navigation, Data and Developer work; Reminders becomes real
// in Round 6.
export default function Settings() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';
  const events = useEvents();
  const samples = events.filter((event) => event.isSample).length;
  // Settings are not watched like events are, so the count is read again each time
  // this screen is back in front, as it is when the import closes.
  const [calendars, setCalendars] = useState(chosenCount);
  const [units, setUnits] = useState(() => getSettings().units);
  // The key is read from the keychain, which answers a moment later.
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      setCalendars(chosenCount());
      getRouteKey().then((key) => setHasKey(!!key));
    }, []),
  );

  return (
    <Screen glow>
      <ScreenHeader title="Settings" />

      <SectionLabel style={styles.groupLabel}>Import sources</SectionLabel>
      <Card padded={false}>
        <ListRow
          title="iPhone Calendar"
          status={calendars > 0 ? count(calendars, 'calendar') : 'Not connected'}
          onPress={() => router.push('/import')}
        />
        <ListRow
          title="Calendar file"
          subtitle="Bring in an .ics file"
          divider
          onPress={() => router.push({ pathname: '/import', params: { source: 'file' } })}
        />
      </Card>

      <SectionLabel style={styles.groupLabel}>Reminders</SectionLabel>
      <Card padded={false}>
        <ListRow title="Default reminders" subtitle="1 day, 2 hours and 30 minutes before" />
        <ListRow title="Morning digest" subtitle="On days with events" divider right={<Value>8:00 AM</Value>} />
        <ListRow title="Sunday preview" subtitle="The week ahead" divider right={<Value>6:00 PM</Value>} />
      </Card>
      <Txt variant="caption" color="textTertiary" style={styles.note}>
        Open Qevrion every few days so later reminders get scheduled.
      </Txt>

      <SectionLabel style={styles.groupLabel}>Navigation</SectionLabel>
      <Card padded={false}>
        <ListRow
          title="Walking routes key"
          subtitle="openrouteservice, free"
          status={hasKey === null ? undefined : hasKey ? 'Set' : 'Not set'}
          onPress={() => router.push('/route-key')}
        />
        <ListRow
          title="Units"
          subtitle="Tap to switch"
          divider
          right={<Value>{units === 'mi' ? 'Miles' : 'Kilometres'}</Value>}
          onPress={() => {
            tap();
            const next = units === 'mi' ? 'km' : 'mi';
            updateSettings({ units: next });
            setUnits(next);
          }}
        />
      </Card>

      <SectionLabel style={styles.groupLabel}>Data</SectionLabel>
      <Card padded={false}>
        <ListRow
          title="Delete all data"
          titleColor="destructive"
          subtitle={`${count(events.length, 'event')} on this phone`}
          right={NO_CHEVRON}
          onPress={() =>
            confirmDestructive(
              'Delete all data?',
              'Every event, saved route and setting, the route key included, is removed from this phone, and Qevrion starts again from the welcome screens. This cannot be undone.',
              'Delete everything',
              () => {
                deleteAllData();
                setCalendars(0);
                setUnits('mi');
                setHasKey(false);
              },
            )
          }
        />
      </Card>

      <SectionLabel style={styles.groupLabel}>About</SectionLabel>
      <Card padded={false}>
        <ListRow title="Version" right={<Value>{version}</Value>} />
        <ListRow
          title="Source code"
          subtitle="Open source under the MIT licence"
          divider
          onPress={() => Linking.openURL(REPO_URL)}
        />
      </Card>

      <SectionLabel style={styles.groupLabel}>Developer</SectionLabel>
      <Card padded={false}>
        <ListRow
          title={`Insert ${SAMPLE_COUNT} sample events`}
          titleColor="accent"
          right={NO_CHEVRON}
          subtitle={
            samples > 0
              ? `${count(samples, 'sample')} in the app. Tap for a fresh set.`
              : 'Invented events, each labelled Sample'
          }
          onPress={() => {
            tap();
            insertSampleEvents();
          }}
        />
        {samples > 0 ? (
          <ListRow
            title="Remove sample events"
            titleColor="accent"
            right={NO_CHEVRON}
            subtitle="Your own events stay"
            divider
            onPress={() => {
              tap();
              removeSampleEvents();
            }}
          />
        ) : null}
        <ListRow
          title="Compare address suggestions"
          subtitle="Photon and openrouteservice, side by side"
          divider
          onPress={() => router.push('/compare-suggestions')}
        />
        <ListRow
          title="Component gallery"
          subtitle="Every building block on one page"
          divider
          onPress={() => router.push('/gallery')}
        />
      </Card>

      <View style={styles.footer}>
        <QevrionMark size={20} color={colors.decoration} />
        <Txt variant="caption" color="textTertiary">
          Qevrion {version}
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    marginTop: space[8],
    marginBottom: space[3],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    marginTop: space[10],
  },
  note: {
    marginTop: space[3],
    marginHorizontal: space[2],
  },
});
