import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { formatDay } from '@/lib/dates';
import { tap } from '@/lib/haptics';
import {
  onScheduleChanged,
  readSchedule,
  sendTestNotification,
  testTarget,
  useReminderState,
  type ScheduleSnapshot,
} from '@/lib/reminderSync';
import { MAX_SCHEDULED } from '@/lib/reminders';

import { Card, ListRow } from './Card';
import { Txt } from './Txt';

const TEST_SECONDS = 10;
const SHOWN = 10;

const KIND: Record<string, string> = {
  reminder: 'Reminder',
  digest: 'Morning digest',
  weekly: 'Sunday preview',
  test: 'Test',
};

const timeWithSeconds = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

const NO_CHEVRON = <View />;

// Settings, Developer: what iOS is holding for the app right now, read from iOS itself
// and not from the app's own record, so it shows the truth. The count must never pass
// 60 (SPEC section 8). The test button is how to see a notification arrive with the
// app closed and open its event when tapped.
export function ReminderDebug() {
  const { access } = useReminderState();
  const [snapshot, setSnapshot] = useState<ScheduleSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const read = useCallback(() => {
    readSchedule()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  // Read whenever the screen is in front, and after every run of the scheduler.
  useFocusEffect(read);
  useEffect(() => onScheduleChanged(read), [read]);

  const total = snapshot?.held.length ?? 0;
  const target = testTarget();

  const sendTest = async () => {
    tap();
    const sent = await sendTestNotification(TEST_SECONDS);
    setMessage(
      sent
        ? `Sent. It arrives in ${TEST_SECONDS} seconds: close the app now to see it come in from outside.`
        : 'Notifications are off, so nothing was sent. Turn them on under Reminders above.',
    );
    read();
  };

  return (
    <Card padded={false}>
      <ListRow
        title="Scheduled right now"
        subtitle={
          access !== 'granted' && total === 0
            ? 'Notifications are off, so nothing is scheduled.'
            : `${snapshot?.planned ?? 0} still to come in all. iOS is given the nearest ${MAX_SCHEDULED}.`
        }
        right={
          <Txt variant="bodySmall" color={total > MAX_SCHEDULED ? 'destructive' : 'textSecondary'}>
            {snapshot ? `${total} of ${MAX_SCHEDULED}` : '…'}
          </Txt>
        }
      />
      {snapshot?.held.slice(0, SHOWN).map((item) => (
        <ListRow
          key={item.osNotificationId}
          title={item.title || 'Untitled'}
          subtitle={[
            item.fireAt === null
              ? 'Time not known'
              : `${formatDay(item.fireAt)} · ${timeWithSeconds.format(item.fireAt)}`,
            item.kind ? (KIND[item.kind] ?? item.kind) : 'Not from Qevrion',
          ].join(' · ')}
          divider
        />
      ))}
      {total > SHOWN ? (
        <ListRow title={`and ${total - SHOWN} more`} titleColor="textSecondary" divider />
      ) : null}
      <ListRow
        title={`Send test notification in ${TEST_SECONDS} seconds`}
        titleColor="accent"
        right={NO_CHEVRON}
        subtitle={
          message ??
          (target
            ? `Tapping it opens "${target.title}".`
            : 'With no event to open, tapping it opens Home. Add an event first to test the tap.')
        }
        divider
        onPress={sendTest}
      />
    </Card>
  );
}
