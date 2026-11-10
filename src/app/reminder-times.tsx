import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { getSettings, updateSettings } from '@/data/db';
import { setReminderOffsets, useEvent } from '@/data/events';
import { syncReminders } from '@/lib/reminderSync';
import { cleanOffsets, OFFSET_CHOICES, offsetLabel, offsetsSummary } from '@/lib/reminders';
import { colors, size, space } from '@/theme';

const chipLabel = (minutes: number) => (minutes === 0 ? 'At the start' : offsetLabel(minutes));

// How long before an event its reminders come. With no `id` these are the defaults for
// every event; with `?id=` they are that one event's own, or the defaults again. Each
// tap is saved at once and the reminders rescheduled.
export default function ReminderTimes() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const event = useEvent(id);
  const [defaults, setDefaults] = useState(() => getSettings().defaultOffsets);

  const own = event ? event.reminderOffsets : null;
  const usingDefaults = !!event && own === null;
  const chosen = cleanOffsets(event ? (own ?? defaults) : defaults);

  const save = (offsets: number[] | null) => {
    if (event) {
      // The scheduler hears of this by itself, as it does of every change to an event.
      setReminderOffsets(event.id, offsets);
    } else if (offsets) {
      updateSettings({ defaultOffsets: offsets });
      setDefaults(offsets);
      syncReminders();
    }
  };

  const toggle = (minutes: number) =>
    save(cleanOffsets(chosen.includes(minutes) ? chosen.filter((m) => m !== minutes) : [...chosen, minutes]));

  return (
    <Screen glow sheet>
      <ScreenHeader leading="close" title={event ? 'Reminders' : 'Default reminders'} />

      {event ? (
        <>
          <Txt variant="caption" color="textSecondary" style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Txt>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Txt>Use my defaults</Txt>
              <Txt variant="bodySmall" color="textSecondary">
                {offsetsSummary(defaults)}
              </Txt>
            </View>
            <Switch
              value={usingDefaults}
              // Turning it off starts from the defaults, so nothing changes until a tap.
              onValueChange={(on) => save(on ? null : cleanOffsets(defaults))}
              accessibilityLabel="Use my default reminders for this event"
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
              ios_backgroundColor={colors.surfaceRaised}
            />
          </View>
        </>
      ) : null}

      {usingDefaults ? null : (
        <>
          <SectionLabel style={styles.label}>Remind me</SectionLabel>
          <View style={styles.chips}>
            {OFFSET_CHOICES.map((minutes) => (
              <Chip
                key={minutes}
                label={chipLabel(minutes)}
                selected={chosen.includes(minutes)}
                onPress={() => toggle(minutes)}
              />
            ))}
          </View>
          <Txt style={styles.summary} accessibilityLiveRegion="polite">
            {offsetsSummary(chosen)}
          </Txt>
          {chosen.length === 0 ? (
            <Txt variant="caption" color="textSecondary">
              No reminders before {event ? 'this event' : 'events'}. The morning digest still
              counts {event ? 'it' : 'them'}.
            </Txt>
          ) : null}
        </>
      )}

      <Txt variant="caption" color="textTertiary" style={styles.note}>
        {event?.allDay
          ? 'This event lasts all day, so only reminders of a day or more apply. They are counted from 9:00 AM on its first day.'
          : event
            ? 'These stay with this event, even when your calendar updates it.'
            : 'Used by every event that has no reminders of its own. For an all-day event only reminders of a day or more apply, counted from 9:00 AM.'}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eventTitle: {
    marginBottom: space[4],
  },
  switchRow: {
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginBottom: space[5],
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  label: {
    marginBottom: space[3],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  summary: {
    marginTop: space[5],
    marginBottom: space[2],
  },
  note: {
    marginTop: space[5],
  },
});
