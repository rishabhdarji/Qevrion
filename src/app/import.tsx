import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SampleBadge } from '@/components/SampleBadge';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatGrid } from '@/components/StatGrid';
import { StepBars } from '@/components/StepBars';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/theme';

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

const CALENDARS = ['Personal', 'Partiful', 'Work'];

const STEPS = ['source', 'calendars', 'result'] as const;
type Step = (typeof STEPS)[number];

// Import: source picker, calendar picker, result summary.
// ponytail: all three steps show sample data. Round 3 reads the real calendar and files.
export default function Import() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState(0);
  const [chosen, setChosen] = useState<string[]>(['Personal', 'Partiful']);
  const [onlyPartiful, setOnlyPartiful] = useState(false);

  const toggle = (name: string) =>
    setChosen((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );

  const footer = {
    source: <PrimaryButton label="Continue" onPress={() => setStep('calendars')} />,
    calendars: <PrimaryButton label="Import events" onPress={() => setStep('result')} />,
    result: <PrimaryButton label="Done" onPress={() => router.back()} />,
  }[step];

  return (
    <Screen glow sheet footer={footer}>
      <ScreenHeader leading="close" title="Import" />
      <StepBars count={STEPS.length} current={STEPS.indexOf(step)} />

      {step === 'source' ? (
        <>
          <Txt color="textSecondary" style={styles.groupLabel}>
            Where are your events?
          </Txt>
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

      {step === 'calendars' ? (
        <>
          <View style={styles.labelRow}>
            <Txt color="textSecondary">Calendars to read</Txt>
            <SampleBadge />
          </View>
          <Card padded={false}>
            {CALENDARS.map((name, index) => {
              const selected = chosen.includes(name);
              return (
                <ListRow
                  key={name}
                  title={name}
                  status={selected ? 'Included' : undefined}
                  subtitle={selected ? undefined : 'Not included'}
                  divider={index > 0}
                  right={selected ? <Icon name="check" size={18} color={colors.accent} /> : <View />}
                  onPress={() => toggle(name)}
                />
              );
            })}
          </Card>

          <Txt color="textSecondary" style={styles.groupLabel}>
            What to bring in
          </Txt>
          <Card padded={false}>
            <ListRow title="Date range" subtitle="30 days back to 12 months ahead" />
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
                />
              }
            />
          </Card>
        </>
      ) : null}

      {step === 'result' ? (
        <>
          <Txt variant="heading" accessibilityRole="header">
            All set.
          </Txt>
          <View style={styles.labelRow}>
            <Txt color="textSecondary">Here is what changed.</Txt>
            <SampleBadge />
          </View>
          <Card>
            <StatGrid
              items={[
                { label: 'Added', value: '8' },
                { label: 'Updated', value: '2' },
                { label: 'Skipped', value: '1' },
                { label: 'Calendars read', value: String(chosen.length) },
              ]}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    marginTop: space[6],
    marginBottom: space[3],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    marginTop: space[2],
    marginBottom: space[3],
  },
  stack: {
    gap: space[3],
  },
});
