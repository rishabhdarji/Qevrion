import { isRunningInExpoGo } from 'expo';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Txt } from '@/components/Txt';
import { getSettings } from '@/data/db';
import { askForReminders, markRemindersAsked, useReminderState } from '@/lib/reminderSync';
import { formatMinutes, offsetsSummary } from '@/lib/reminders';
import { space } from '@/theme';

// Inside Expo Go the permission, the name on the notification and the Settings entry
// are all Expo Go's, which would otherwise look like a mistake.
const EXPO_GO = isRunningInExpoGo();

// The screen that asks for notifications, just before they are needed: it says what
// will arrive, then its button puts the iPhone's own question. Saying no changes
// nothing else; Home then carries a quiet line that leads back here.
export default function Reminders() {
  const router = useRouter();
  const { access } = useReminderState();
  const settings = getSettings();

  // Seen once is asked: after this Home says reminders are off instead of opening
  // this screen again by itself.
  useEffect(markRemindersAsked, []);

  const close = () => router.back();

  const [title, body, action, onPress] =
    access === 'granted'
      ? [
          'Reminders are on.',
          'Change when they arrive in Settings, or for one event on its own screen.',
          'Done',
          close,
        ]
      : access === 'denied'
        ? [
            'Reminders are off.',
            `Notifications are turned off for ${EXPO_GO ? 'Expo Go, which Qevrion runs inside' : 'Qevrion'}. To turn them on, open Settings, choose Notifications, and allow them.`,
            'Open Settings',
            () => Linking.openSettings().catch(() => {}),
          ]
        : [
            'A nudge at\nthe right time.',
            'Qevrion can remind you before each event. The iPhone will ask once whether to allow notifications.',
            'Turn on reminders',
            () => askForReminders().finally(close),
          ];

  return (
    <Screen
      glow
      sheet
      footer={
        <>
          <PrimaryButton label={action} onPress={onPress} />
          {access === 'granted' ? null : <SecondaryButton label="Not now" onPress={close} />}
        </>
      }
    >
      <ScreenHeader leading="close" />
      <Txt variant="heading" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {title}
      </Txt>
      <Txt color="textSecondary" style={styles.body}>
        {body}
      </Txt>

      <Card padded={false}>
        <ListRow icon="bell" title="Before each event" subtitle={offsetsSummary(settings.defaultOffsets)} />
        <ListRow
          icon="clock"
          title="Morning digest"
          subtitle={
            settings.digestEnabled
              ? `${formatMinutes(settings.digestTime)}, on days with events`
              : 'Turned off in Settings'
          }
          divider
        />
        <ListRow
          icon="calendar"
          title="Sunday preview"
          subtitle={
            settings.weeklyPreviewEnabled
              ? `${formatMinutes(settings.weeklyPreviewTime)}, the week ahead`
              : 'Turned off in Settings'
          }
          divider
        />
      </Card>

      <Txt variant="caption" color="textTertiary" style={styles.note}>
        Reminders are made on this phone. Nothing is sent anywhere, and the app works the same
        without them.
        {EXPO_GO ? ' While Qevrion runs inside Expo Go, they arrive under Expo Go’s name.' : ''}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: space[3],
    marginBottom: space[6],
  },
  note: {
    marginTop: space[3],
    marginHorizontal: space[2],
  },
});
