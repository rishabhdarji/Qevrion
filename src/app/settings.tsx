import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Switch, View } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { QevrionMark } from '@/components/QevrionMark';
import { ReminderDebug } from '@/components/ReminderDebug';
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
import { hasRecording, recordingUri } from '@/data/walkRecording';
import { confirmDestructive } from '@/lib/confirm';
import { tap } from '@/lib/haptics';
import { syncReminders, useReminderState } from '@/lib/reminderSync';
import { formatMinutes, offsetsSummary, timeToday } from '@/lib/reminders';
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

type TimeProps = { label: string; minutes: number; onChange: (minutes: number) => void };

// A time of day, held as minutes after midnight, picked with the iPhone's own picker.
function TimeOfDay({ label, minutes, onChange }: TimeProps) {
  // The desktop preview has no time picker, so it only shows the value.
  if (Platform.OS === 'web') return <Value>{formatMinutes(minutes)}</Value>;
  return (
    <DateTimePicker
      value={timeToday(minutes)}
      mode="time"
      display="compact"
      minuteInterval={5}
      themeVariant="dark"
      accentColor={colors.accent}
      accessibilityLabel={label}
      onValueChange={(_, date) => onChange(date.getHours() * 60 + date.getMinutes())}
    />
  );
}

type ToggleProps = { label: string; value: boolean; onChange: (value: boolean) => void };

function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
      ios_backgroundColor={colors.surfaceRaised}
    />
  );
}

const ACCESS = {
  checking: undefined,
  granted: 'On',
  ask: 'Off. Tap to turn on',
  denied: 'Off in the iPhone\'s Settings',
} as const;

// Settings: import sources, reminders, navigation, data and the developer tools.
export default function Settings() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';
  const events = useEvents();
  const samples = events.filter((event) => event.isSample).length;
  // Settings are not watched like events are, so the count is read again each time
  // this screen is back in front, as it is when the import closes.
  const [calendars, setCalendars] = useState(chosenCount);
  const [units, setUnits] = useState(() => getSettings().units);
  const [simulateWalk, setSimulateWalk] = useState(() => getSettings().simulateWalk);
  const [recordWalks, setRecordWalks] = useState(() => getSettings().recordWalks);
  // A walk may have been recorded since this screen was last in front.
  const [walkKept, setWalkKept] = useState(hasRecording);
  // The key is read from the keychain, which answers a moment later.
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const { access } = useReminderState();
  const [reminders, setReminders] = useState(getSettings);
  // Saved at once, and the reminders rescheduled to match (SPEC section 8, rule 3).
  const setReminder = (patch: Partial<typeof reminders>) => {
    updateSettings(patch);
    setReminders((current) => ({ ...current, ...patch }));
    syncReminders();
  };
  useFocusEffect(
    useCallback(() => {
      // The default reminders are changed on a screen of their own.
      setReminders(getSettings());
      setCalendars(chosenCount());
      setWalkKept(hasRecording());
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
        <ListRow
          title="Notifications"
          subtitle="Reminders arrive as notifications"
          status={ACCESS[access]}
          onPress={() => router.push('/reminders')}
        />
        <ListRow
          title="Default reminders"
          subtitle={offsetsSummary(reminders.defaultOffsets)}
          divider
          onPress={() => router.push('/reminder-times')}
        />
        <ListRow
          title="Morning digest"
          subtitle="On days with events"
          divider
          right={
            <Toggle
              label="Morning digest"
              value={reminders.digestEnabled}
              onChange={(digestEnabled) => setReminder({ digestEnabled })}
            />
          }
        />
        {reminders.digestEnabled ? (
          <ListRow
            title="Digest time"
            divider
            right={
              <TimeOfDay
                label="Morning digest time"
                minutes={reminders.digestTime}
                onChange={(digestTime) => setReminder({ digestTime })}
              />
            }
          />
        ) : null}
        <ListRow
          title="Sunday preview"
          subtitle="The week ahead"
          divider
          right={
            <Toggle
              label="Sunday preview"
              value={reminders.weeklyPreviewEnabled}
              onChange={(weeklyPreviewEnabled) => setReminder({ weeklyPreviewEnabled })}
            />
          }
        />
        {reminders.weeklyPreviewEnabled ? (
          <ListRow
            title="Preview time"
            divider
            right={
              <TimeOfDay
                label="Sunday preview time"
                minutes={reminders.weeklyPreviewTime}
                onChange={(weeklyPreviewTime) => setReminder({ weeklyPreviewTime })}
              />
            }
          />
        ) : null}
      </Card>
      <Txt variant="caption" color="textTertiary" style={styles.note}>
        Open Qevrion every few days so later reminders get scheduled. The iPhone holds only a
        few dozen at a time, so Qevrion schedules the nearest 60 and adds the next ones each
        time it opens. The morning digest is a good moment to open it.
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
              'Every event, saved route, recorded walk and setting, the route key included, is removed from this phone, and Qevrion starts again from the welcome screens. This cannot be undone.',
              'Delete everything',
              () => {
                deleteAllData();
                setCalendars(0);
                setUnits('mi');
                setHasKey(false);
                setSimulateWalk(false);
                setRecordWalks(false);
                setWalkKept(false);
                setReminders(getSettings());
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
          title="Simulate AR Walk"
          subtitle="Replays a walk, so AR Walk can be tried at a desk. Tap to switch."
          divider
          right={<Value>{simulateWalk ? 'On' : 'Off'}</Value>}
          onPress={() => {
            tap();
            updateSettings({ simulateWalk: !simulateWalk });
            setSimulateWalk(!simulateWalk);
          }}
        />
        <ListRow
          title="Record AR walks"
          subtitle="Keeps your last real walk on this phone, to replay and tune. Tap to switch."
          divider
          right={<Value>{recordWalks ? 'On' : 'Off'}</Value>}
          onPress={() => {
            tap();
            updateSettings({ recordWalks: !recordWalks });
            setRecordWalks(!recordWalks);
          }}
        />
        {walkKept ? (
          <ListRow
            title="Share the recorded walk"
            titleColor="accent"
            right={NO_CHEVRON}
            subtitle="It shows where you walked. It leaves the phone only if you share it."
            divider
            onPress={() =>
              Share.share({ url: recordingUri(), title: 'Qevrion walk recording' }).catch(() =>
                Alert.alert('Could not share the recording'),
              )
            }
          />
        ) : null}
        <ListRow
          title="Component gallery"
          subtitle="Every building block on one page"
          divider
          onPress={() => router.push('/gallery')}
        />
      </Card>

      <SectionLabel style={styles.groupLabel}>Reminders debug</SectionLabel>
      <ReminderDebug />

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
