import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { QevrionMark } from '@/components/QevrionMark';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/theme';

const REPO_URL = 'https://github.com/rishabhdarji/Qevrion';

function Value({ children }: { children: string }) {
  return (
    <Txt variant="bodySmall" color="textSecondary">
      {children}
    </Txt>
  );
}

// Settings. Rows are laid out in Round 1; each group becomes real in the round that
// builds its feature (import 3, reminders 4, route key 6).
export default function Settings() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen glow>
      <ScreenHeader title="Settings" />

      <Txt color="textSecondary" style={styles.groupLabel}>
        Import sources
      </Txt>
      <Card padded={false}>
        <ListRow
          title="iPhone Calendar"
          status="Not connected"
          onPress={() => router.push('/import')}
        />
        <ListRow title="Calendar file" subtitle="Bring in an .ics file" divider onPress={() => router.push('/import')} />
      </Card>

      <Txt color="textSecondary" style={styles.groupLabel}>
        Reminders
      </Txt>
      <Card padded={false}>
        <ListRow title="Default reminders" subtitle="1 day, 2 hours and 30 minutes before" />
        <ListRow title="Morning digest" subtitle="On days with events" divider right={<Value>8:00 AM</Value>} />
        <ListRow title="Sunday preview" subtitle="The week ahead" divider right={<Value>6:00 PM</Value>} />
      </Card>
      <Txt variant="caption" color="textTertiary" style={styles.note}>
        Open Qevrion every few days so later reminders get scheduled.
      </Txt>

      <Txt color="textSecondary" style={styles.groupLabel}>
        Navigation
      </Txt>
      <Card padded={false}>
        <ListRow title="Walking routes key" subtitle="openrouteservice" status="Not set" />
        <ListRow title="Units" divider right={<Value>Miles</Value>} />
      </Card>

      <Txt color="textSecondary" style={styles.groupLabel}>
        Data
      </Txt>
      <Card padded={false}>
        <ListRow title="Delete all data" titleColor="destructive" />
      </Card>

      <Txt color="textSecondary" style={styles.groupLabel}>
        About
      </Txt>
      <Card padded={false}>
        <ListRow title="Version" right={<Value>{version}</Value>} />
        <ListRow
          title="Source code"
          subtitle="Open source under the MIT licence"
          divider
          onPress={() => Linking.openURL(REPO_URL)}
        />
      </Card>

      <Txt color="textSecondary" style={styles.groupLabel}>
        Developer
      </Txt>
      <Card padded={false}>
        <ListRow
          title="Component gallery"
          subtitle="Every building block on one page"
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
    marginTop: space[6],
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
