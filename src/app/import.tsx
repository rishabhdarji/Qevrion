import * as Calendar from 'expo-calendar/legacy';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { StatGrid } from '@/components/StatGrid';
import { StepBars } from '@/components/StepBars';
import { Txt } from '@/components/Txt';
import { getSettings, updateSettings } from '@/data/db';
import { isPartifulEvent, toImported } from '@/lib/calendarImport';
import { importFile, syncCalendars, syncWindow } from '@/lib/sync';
import { colors, space } from '@/theme';
import type { ImportResult } from '@/types';

const SOURCES: { title: string; subtitle: string; status: string; icon: IconName }[] = [
  {
    title: 'iPhone Calendar',
    subtitle: 'Includes events Partiful adds there',
    status: 'Recommended',
    icon: 'calendar',
  },
  {
    title: 'Calendar file',
    subtitle: 'Pick an .ics file from Files',
    status: 'Available',
    icon: 'document',
  },
];

// Inside Expo Go the system's boxes and settings belong to Expo Go, not to Qevrion.
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type Stage =
  | { step: 'source' }
  /** Calendar access is not on. `denied`: iOS will not ask again; only Settings can turn it on. */
  | { step: 'access'; denied: boolean }
  | { step: 'calendars'; error?: string }
  | { step: 'fileError'; message: string }
  | { step: 'web' }
  | { step: 'working' }
  | { step: 'result'; result: ImportResult; repeating: number };

/** Which of the three bars each stage lights. */
const BAR: Record<Stage['step'], number> = {
  source: 0,
  access: 1,
  calendars: 1,
  fileError: 1,
  web: 1,
  working: 2,
  result: 2,
};

type CalendarRow = { id: string; title: string; account: string; events: number; partiful: number };

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
const onDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** The phone's calendars, each with how many events a sync would find in it. One read for all. */
async function readCalendarList(): Promise<CalendarRow[]> {
  const listed = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const rows = new Map(
    listed.map((calendar): [string, CalendarRow] => [
      calendar.id,
      {
        id: calendar.id,
        title: calendar.title || 'Untitled calendar',
        account: calendar.source?.name ?? '',
        events: 0,
        partiful: 0,
      },
    ]),
  );
  if (rows.size === 0) return [];
  const { from, to } = syncWindow();
  for (const event of await Calendar.getEventsAsync([...rows.keys()], new Date(from), new Date(to))) {
    const row = rows.get(event.calendarId);
    // Counted the way a sync brings them in, so a cancelled event is not.
    if (!row || !toImported(event)) continue;
    row.events++;
    if (isPartifulEvent(event)) row.partiful++;
  }
  return [...rows.values()];
}

// Import: where the events are, which calendars, then what changed.
export default function Import() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: 'source' });
  const [source, setSource] = useState(0);
  // Null while the list is being read.
  const [calendars, setCalendars] = useState<CalendarRow[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [onlyPartiful, setOnlyPartiful] = useState(() => getSettings().onlyPartifulLinks);
  // Set while the file picker opens, so a second tap cannot open another.
  const picking = useRef(false);
  const { from, to } = syncWindow();

  const showCalendars = () => {
    setCalendars(null);
    setStage({ step: 'calendars' });
  };

  // Reads the list each time the calendar step is entered afresh.
  useEffect(() => {
    if (stage.step !== 'calendars' || stage.error) return;
    let current = true;
    readCalendarList().then(
      (rows) => {
        if (!current) return;
        const ids = rows.map((row) => row.id);
        const saved = getSettings().importCalendarIds.filter((id) => ids.includes(id));
        // The first time, the calendars that hold Partiful events come ticked.
        setChosen(saved.length > 0 ? saved : rows.filter((row) => row.partiful > 0).map((row) => row.id));
        setCalendars(rows);
      },
      (error: unknown) => current && setStage({ step: 'calendars', error: messageOf(error) }),
    );
    return () => {
      current = false;
    };
  }, [stage]);

  // After a no, access can only be turned on in Settings. Coming back from there is
  // checked here, so the list opens without another tap.
  const denied = stage.step === 'access' && stage.denied;
  useEffect(() => {
    if (!denied) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Calendar.getCalendarPermissionsAsync()
        .then((access) => {
          if (!access.granted) return;
          setCalendars(null);
          setStage({ step: 'calendars' });
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, [denied]);

  const finish = (result: ImportResult, repeating: number) => {
    setStage({ step: 'result', result, repeating });
    AccessibilityInfo.announceForAccessibility(
      `Import finished. ${result.added} added, ${result.updated} updated.`,
    );
  };

  const openCalendar = async () => {
    try {
      // Only looks. The system box comes later, from "Allow calendar access", once
      // this screen has said why.
      const access = await Calendar.getCalendarPermissionsAsync();
      if (access.granted) showCalendars();
      else setStage({ step: 'access', denied: !access.canAskAgain });
    } catch (error) {
      setStage({ step: 'calendars', error: messageOf(error) });
    }
  };

  const allowAccess = async () => {
    try {
      const access = await Calendar.requestCalendarPermissionsAsync();
      // iOS asks only once. Any answer but yes, "add events only" included, leaves
      // Settings as the only way, so the button that asked is not offered again.
      if (access.granted) showCalendars();
      else setStage({ step: 'access', denied: true });
    } catch (error) {
      setStage({ step: 'calendars', error: messageOf(error) });
    }
  };

  const pickFile = async () => {
    if (picking.current) return;
    picking.current = true;
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      // ponytail: any file can be picked, because whether iOS lets an .ics file be
      // tapped under "text/calendar" is not checked yet; the reader refuses anything
      // that is not a calendar. Narrow the type once that is tried on a phone.
      picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    } catch {
      setStage({ step: 'fileError', message: 'The file picker could not be opened. Please try again.' });
      return;
    } finally {
      picking.current = false;
    }
    const file = picked.canceled ? undefined : picked.assets[0];
    if (!file) return setStage({ step: 'source' });
    setStage({ step: 'working' });
    try {
      const { repeating, ...result } = await importFile(file.uri);
      finish(result, repeating);
    } catch (error) {
      setStage({ step: 'fileError', message: messageOf(error) });
    }
  };

  const importCalendars = async () => {
    updateSettings({ importCalendarIds: chosen, onlyPartifulLinks: onlyPartiful });
    setStage({ step: 'working' });
    try {
      const result = await syncCalendars({ force: true });
      // Nothing could be read: access, or the calendars, went while choosing. Going
      // back over the steps shows what is there now.
      if (!result) return openCalendar();
      finish(result, 0);
    } catch (error) {
      setStage({ step: 'calendars', error: messageOf(error) });
    }
  };

  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const back = () => setStage({ step: 'source' });

  const footer = (() => {
    switch (stage.step) {
      case 'source':
        return (
          <PrimaryButton
            label="Continue"
            onPress={() => {
              if (Platform.OS === 'web') setStage({ step: 'web' });
              else if (source === 0) openCalendar();
              else pickFile();
            }}
          />
        );
      case 'access':
        return (
          <>
            {stage.denied ? (
              <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings().catch(() => {})} />
            ) : (
              <PrimaryButton label="Allow calendar access" onPress={allowAccess} />
            )}
            <SecondaryButton label="Not now" onPress={back} />
          </>
        );
      case 'calendars':
        if (stage.error) return <PrimaryButton label="Try again" onPress={openCalendar} />;
        if (!calendars) return undefined;
        if (calendars.length === 0) return <SecondaryButton label="Back" onPress={back} />;
        return (
          <>
            {chosen.length === 0 ? (
              <Txt variant="caption" color="textSecondary" style={styles.centered}>
                Tick at least one calendar to import.
              </Txt>
            ) : null}
            <PrimaryButton
              label="Import events"
              disabled={chosen.length === 0}
              onPress={importCalendars}
            />
          </>
        );
      case 'fileError':
        return <PrimaryButton label="Choose another file" onPress={pickFile} />;
      case 'web':
        return <SecondaryButton label="Back" onPress={back} />;
      case 'working':
        return undefined;
      case 'result':
        return <PrimaryButton label="Done" onPress={() => router.back()} />;
    }
  })();

  return (
    <Screen glow sheet footer={footer}>
      <ScreenHeader leading="close" title="Import" />
      <StepBars count={3} current={BAR[stage.step]} />

      {stage.step === 'source' ? (
        <>
          <SectionLabel style={styles.groupLabel}>Where are your events?</SectionLabel>
          <View style={styles.stack}>
            {SOURCES.map((item, index) => (
              <Card
                key={item.title}
                padded={false}
                selected={source === index}
                accessibilityLabel={`${item.title}, ${item.subtitle}, ${item.status}`}
                onPress={() => setSource(index)}
              >
                <ListRow icon={item.icon} title={item.title} subtitle={item.subtitle} status={item.status} />
              </Card>
            ))}
            <Card padded={false}>
              <ListRow
                icon="plus"
                title="Add one by hand"
                titleColor="accent"
                onPress={() => router.replace('/event/edit')}
              />
            </Card>
          </View>
        </>
      ) : null}

      {stage.step === 'access' && !stage.denied ? (
        <View style={styles.block}>
          <Txt variant="heading" accessibilityRole="header">
            Read your calendar
          </Txt>
          <Txt color="textSecondary">
            Qevrion reads your iPhone calendar to bring your events in, and reads it again each
            time you open the app. Nothing leaves your phone.
          </Txt>
          {IN_EXPO_GO ? (
            <Txt variant="bodySmall" color="textTertiary">
              The box that asks will say “Expo”, because Qevrion runs inside Expo Go for now.
            </Txt>
          ) : null}
        </View>
      ) : null}

      {stage.step === 'access' && stage.denied ? (
        <View style={styles.block}>
          <Txt variant="heading" accessibilityRole="header">
            Calendar access is off
          </Txt>
          <Txt color="textSecondary">
            To turn it on, tap Open Settings, then Calendars, and choose Full Access. Then come
            back here.
          </Txt>
          {IN_EXPO_GO ? (
            <Txt variant="bodySmall" color="textTertiary">
              Settings opens on Expo Go’s page, because Qevrion runs inside Expo Go for now. In the
              Settings app it is under Expo Go, then Calendars.
            </Txt>
          ) : null}
        </View>
      ) : null}

      {stage.step === 'calendars' && stage.error ? (
        <View style={styles.block}>
          <Txt variant="title" accessibilityRole="header">
            Could not read your calendars
          </Txt>
          <Txt color="textSecondary">{stage.error}</Txt>
        </View>
      ) : null}

      {stage.step === 'calendars' && !stage.error && !calendars ? (
        <View style={[styles.block, styles.waiting]}>
          <ActivityIndicator color={colors.textSecondary} />
          <Txt color="textSecondary">Reading your calendars…</Txt>
        </View>
      ) : null}

      {stage.step === 'calendars' && !stage.error && calendars?.length === 0 ? (
        <View style={styles.block}>
          <Txt variant="title" accessibilityRole="header">
            No calendars found
          </Txt>
          <Txt color="textSecondary">
            This iPhone has no calendars to read. You can still bring events in from a calendar
            file, or add them by hand.
          </Txt>
        </View>
      ) : null}

      {stage.step === 'calendars' && !stage.error && calendars && calendars.length > 0 ? (
        <>
          <SectionLabel style={styles.groupLabel}>Calendars to read</SectionLabel>
          <Card padded={false}>
            {calendars.map((calendar, index) => {
              const selected = chosen.includes(calendar.id);
              return (
                <ListRow
                  key={calendar.id}
                  title={calendar.title}
                  subtitle={[calendar.account, count(calendar.events, 'event')].filter(Boolean).join(' · ')}
                  status={calendar.partiful > 0 ? `${calendar.partiful} from Partiful` : undefined}
                  divider={index > 0}
                  selected={selected}
                  right={selected ? <Icon name="check" size={18} color={colors.accent} /> : <View />}
                  onPress={() => toggle(calendar.id)}
                />
              );
            })}
          </Card>

          <SectionLabel style={styles.groupLabel}>What to bring in</SectionLabel>
          <Card padded={false}>
            <ListRow
              title="Date range"
              subtitle={`30 days back to 12 months ahead: ${onDate(from)} to ${onDate(to)}`}
            />
            <ListRow
              title="Only Partiful events"
              subtitle="Events with a partiful.com link"
              divider
              right={
                <Switch
                  value={onlyPartiful}
                  onValueChange={setOnlyPartiful}
                  accessibilityLabel="Only events with a partiful.com link"
                  trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
                  ios_backgroundColor={colors.surfaceRaised}
                />
              }
            />
          </Card>
          <Txt variant="caption" color="textTertiary" style={styles.note}>
            Your choice is kept. These calendars are read again each time you open Qevrion, or
            pull down on Home.
          </Txt>
        </>
      ) : null}

      {stage.step === 'fileError' ? (
        <View style={styles.block}>
          <Txt variant="title" accessibilityRole="header">
            This file could not be imported
          </Txt>
          <Txt color="textSecondary">{stage.message}</Txt>
        </View>
      ) : null}

      {stage.step === 'web' ? (
        <View style={styles.block}>
          <Txt variant="title" accessibilityRole="header">
            Import works on the iPhone
          </Txt>
          <Txt color="textSecondary">
            Reading your calendar and calendar files needs the app on your iPhone. This preview in
            a browser can only add events by hand.
          </Txt>
        </View>
      ) : null}

      {stage.step === 'working' ? (
        <View style={[styles.block, styles.waiting]}>
          <ActivityIndicator color={colors.textSecondary} />
          <Txt color="textSecondary">Importing…</Txt>
        </View>
      ) : null}

      {stage.step === 'result' ? <Result result={stage.result} repeating={stage.repeating} /> : null}
    </Screen>
  );
}

function Result({ result, repeating }: { result: ImportResult; repeating: number }) {
  const { added, updated, unchanged, skipped } = result;
  return (
    <>
      <Txt variant="heading" accessibilityRole="header" style={styles.groupLabel}>
        All set.
      </Txt>
      <Txt color="textSecondary" style={styles.lead}>
        Here is what changed.
      </Txt>
      <Card>
        <StatGrid
          items={[
            { label: 'Added', value: String(added) },
            { label: 'Updated', value: String(updated) },
            { label: 'Unchanged', value: String(unchanged) },
            { label: 'Skipped', value: String(skipped) },
          ]}
        />
      </Card>
      <View style={styles.notes}>
        {added + updated + unchanged + skipped + repeating === 0 ? (
          <Txt variant="bodySmall" color="textSecondary">
            Nothing was found to bring in.
          </Txt>
        ) : null}
        {skipped > 0 ? (
          <Txt variant="bodySmall" color="textSecondary">
            Skipped events were cancelled, left out by the Partiful switch, deleted here by you
            before, or could not be read.
          </Txt>
        ) : null}
        {repeating > 0 ? (
          <Txt variant="bodySmall" color="textSecondary">
            {`${count(repeating, 'repeating event')} in this file ${repeating === 1 ? 'was' : 'were'} left out. Repeating events can be brought in through the iPhone Calendar.`}
          </Txt>
        ) : null}
        {added + updated > 0 ? (
          <Txt variant="bodySmall" color="textSecondary">
            Places are being found on the map in the background.
          </Txt>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    marginTop: space[6],
    marginBottom: space[3],
  },
  lead: {
    marginBottom: space[4],
  },
  stack: {
    gap: space[3],
  },
  block: {
    marginTop: space[6],
    gap: space[3],
  },
  waiting: {
    alignItems: 'center',
    paddingVertical: space[8],
  },
  centered: {
    textAlign: 'center',
  },
  note: {
    marginTop: space[3],
    marginHorizontal: space[2],
  },
  notes: {
    marginTop: space[4],
    gap: space[3],
  },
});
