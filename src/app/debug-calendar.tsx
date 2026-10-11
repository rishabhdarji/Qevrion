import * as Calendar from 'expo-calendar/legacy';
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { space } from '@/theme';

type Loaded = { calendar: Calendar.Calendar; events: Calendar.Event[] };

// Every call goes through here, so a failure is never lost: its full text goes to the
// screen, because the exact message is what this screen is here to find out.
async function attempt<T>(
  name: string,
  call: () => Promise<T>,
  onError: (text: string) => void,
  onResult?: (result: T) => void,
) {
  try {
    onResult?.(await call());
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    onError(`${name} failed.\n${String(error)}${code ? `\ncode: ${String(code)}` : ''}`);
  }
}

const mentions = (events: Calendar.Event[], field: 'url' | 'notes' | 'location') =>
  events.filter((event) => event[field]?.toLowerCase().includes('partiful.com')).length;

// Temporary: shows the raw fields the iPhone calendar returns, so the importer is built
// on what is really there. Reached from Settings, removed at the end of Round 3.
export default function DebugCalendar() {
  const [access, setAccess] = useState<Calendar.PermissionResponse | null>(null);
  const [calendars, setCalendars] = useState<Calendar.Calendar[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const granted = access?.granted ?? false;

  // Reading the current state never shows the system box.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    attempt(
      'getCalendarPermissionsAsync',
      Calendar.getCalendarPermissionsAsync,
      setError,
      setAccess,
    );
  }, []);

  useEffect(() => {
    if (!granted) return;
    attempt(
      'getCalendarsAsync',
      // Without the entity type this call also wants access to Reminders.
      () => Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT),
      setError,
      setCalendars,
    );
  }, [granted]);

  const loadEvents = (calendar: Calendar.Calendar) => {
    const from = new Date();
    const to = new Date(from);
    to.setFullYear(to.getFullYear() + 1);
    setLoaded(null);
    setError(null);
    attempt(
      'getEventsAsync',
      () => Calendar.getEventsAsync([calendar.id], from, to),
      setError,
      (events) => setLoaded({ calendar, events }),
    );
  };

  const raw = loaded?.events.slice(0, 5).map((event) => JSON.stringify(event, null, 2)) ?? [];
  // Counts only, so the summary is safe to paste anywhere.
  const summary = loaded
    ? [
        `Events found, from now to 12 months ahead: ${loaded.events.length}`,
        `partiful.com in url: ${mentions(loaded.events, 'url')}`,
        `partiful.com in notes: ${mentions(loaded.events, 'notes')}`,
        `partiful.com in location: ${mentions(loaded.events, 'location')}`,
      ].join('\n')
    : null;
  const shareText = [error, summary, ...raw].filter(Boolean).join('\n\n');

  return (
    <Screen glow>
      <ScreenHeader title="Calendar debug" />
      <Txt variant="bodySmall" color="textSecondary">
        This is a temporary debug screen. It will be removed at the end of Round 3.
      </Txt>

      {Platform.OS === 'web' ? (
        <Txt style={styles.block}>The calendar can only be read on the iPhone.</Txt>
      ) : null}

      {access && !granted ? (
        <View style={[styles.stack, styles.block]}>
          {access.canAskAgain ? (
            <>
              <Txt>
                Qevrion reads your calendar to show what your events look like. Nothing leaves this
                phone unless you share it.
              </Txt>
              <Txt variant="bodySmall" color="textSecondary">
                The system box will say “Expo”, because the app runs inside Expo Go for now.
              </Txt>
              <PrimaryButton
                label="Allow calendar access"
                onPress={() =>
                  attempt(
                    'requestCalendarPermissionsAsync',
                    Calendar.requestCalendarPermissionsAsync,
                    setError,
                    setAccess,
                  )
                }
              />
            </>
          ) : (
            <>
              <Txt>Calendar access is off.</Txt>
              <Txt variant="bodySmall" color="textSecondary">
                To turn it on, open Settings, then Expo Go, then Calendars, and choose Full Access.
                Then open this screen again.
              </Txt>
              <PrimaryButton
                label="Open Settings"
                onPress={() =>
                  attempt('Linking.openSettings', () => Linking.openSettings(), setError)
                }
              />
            </>
          )}
        </View>
      ) : null}

      {calendars ? (
        <>
          <SectionLabel count={calendars.length} style={styles.label}>
            Calendars
          </SectionLabel>
          {calendars.length === 0 ? (
            <Txt color="textSecondary">No calendars were found on this phone.</Txt>
          ) : (
            <Card padded={false}>
              {calendars.map((calendar, index) => (
                <ListRow
                  key={calendar.id}
                  title={calendar.title}
                  subtitle={[
                    calendar.source?.name,
                    calendar.type,
                    calendar.allowsModifications ? 'editable' : 'read-only',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  status={loaded?.calendar.id === calendar.id ? 'Shown below' : undefined}
                  divider={index > 0}
                  onPress={() => loadEvents(calendar)}
                />
              ))}
            </Card>
          )}
        </>
      ) : null}

      {loaded ? (
        <>
          <SectionLabel style={styles.label}>Summary</SectionLabel>
          <Txt selectable variant="bodySmall">
            {summary}
          </Txt>

          <SectionLabel count={raw.length} style={styles.label}>
            First events, exactly as returned
          </SectionLabel>
          {raw.length === 0 ? (
            <Txt color="textSecondary">No events were found in this calendar.</Txt>
          ) : (
            <View style={styles.stack}>
              {raw.map((text, index) => (
                <Card key={index}>
                  <Txt selectable variant="caption">
                    {text}
                  </Txt>
                </Card>
              ))}
            </View>
          )}
        </>
      ) : null}

      {error ? (
        <>
          <SectionLabel style={styles.label}>Error</SectionLabel>
          <Txt selectable variant="bodySmall" color="destructive">
            {error}
          </Txt>
        </>
      ) : null}

      {shareText ? (
        <View style={[styles.stack, styles.block]}>
          <SecondaryButton
            label="Share these fields"
            onPress={() =>
              attempt('Share.share', () => Share.share({ message: shareText }), setError)
            }
          />
          <Txt variant="caption" color="textTertiary">
            This is your real calendar data. Remove anything private before pasting it anywhere.
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: space[6],
  },
  label: {
    marginTop: space[8],
    marginBottom: space[3],
  },
  stack: {
    gap: space[3],
  },
});
