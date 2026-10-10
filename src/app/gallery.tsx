import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ListRow } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { EventHeroCard } from '@/components/EventHeroCard';
import { EventRow } from '@/components/EventRow';
import { Pill } from '@/components/Pill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QevrionMark } from '@/components/QevrionMark';
import { SampleBadge } from '@/components/SampleBadge';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { StatGrid } from '@/components/StatGrid';
import { Txt } from '@/components/Txt';
import { useEvents } from '@/data/events';
import { colors, radius, space, type, type ColorName, type TypeName } from '@/theme';

const SWATCHES: ColorName[] = [
  'background',
  'surface',
  'surfaceRaised',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'primaryButton',
  'accent',
  'success',
  'destructive',
  'glow',
];

const TYPE_SAMPLES: Partial<Record<TypeName, string>> = {
  display: 'Rooftop Supper Club',
  heading: 'Every event, one place',
  title: 'Gallery Night',
  body: 'Body text for descriptions and rows.',
  bodySmall: 'Smaller text for secondary lines.',
  caption: 'Captions and fine print.',
  label: 'Section label',
};

// Opened once, when the gallery mounts, so the hero below visibly counts down to "Now".
const openedAt = Date.now();

// Every building block on one page, reached from Settings, for reviewing the look.
export default function Gallery() {
  const [chip, setChip] = useState('All');
  const [selected, setSelected] = useState(0);
  const upcoming = useEvents().filter((event) => event.endsAt > openedAt);
  // Stress cases: a start close enough to watch tick down to "Now", and a long title.
  const soon = { ...upcoming[0], id: 'gallery-soon', startsAt: openedAt + 90_000 };
  const longTitle = {
    ...upcoming[3],
    id: 'gallery-long',
    title: 'A very long event title that has to be cut short on a small phone',
  };

  return (
    <Screen glow>
      <ScreenHeader title="Component gallery" />

      <SectionLabel style={styles.first}>Mark</SectionLabel>
      <View style={styles.row}>
        <QevrionMark size={96} />
        <QevrionMark size={48} />
        <QevrionMark size={26} />
        <QevrionMark size={18} />
      </View>

      <SectionLabel style={styles.label}>Type</SectionLabel>
      <View style={styles.stack}>
        {(Object.keys(TYPE_SAMPLES) as TypeName[]).map((name) => (
          <View key={name}>
            <Txt variant="caption" color="textTertiary">
              {name} · {type[name].fontSize} pt
            </Txt>
            <Txt variant={name}>{TYPE_SAMPLES[name]}</Txt>
          </View>
        ))}
      </View>

      <SectionLabel style={styles.label}>Colours</SectionLabel>
      <View style={styles.swatches}>
        {SWATCHES.map((name) => (
          <View key={name} style={styles.swatch}>
            <View style={[styles.swatchColor, { backgroundColor: colors[name] }]} />
            <Txt variant="caption" color="textSecondary" numberOfLines={1}>
              {name}
            </Txt>
            <Txt variant="caption" color="textTertiary" numberOfLines={1}>
              {colors[name]}
            </Txt>
          </View>
        ))}
      </View>

      <SectionLabel style={styles.label}>Corners</SectionLabel>
      <View style={styles.row}>
        {(['card', 'inner', 'pill'] as const).map((name) => (
          <View key={name} style={[styles.corner, { borderRadius: radius[name] }]}>
            <Txt variant="caption" color="textSecondary">
              {name}
            </Txt>
          </View>
        ))}
      </View>

      <SectionLabel style={styles.label}>Buttons</SectionLabel>
      <View style={styles.stack}>
        <PrimaryButton label="Primary button" />
        <SecondaryButton label="Secondary button" />
        <SecondaryButton label="Destructive" color="destructive" />
      </View>

      <SectionLabel style={styles.label}>Pills</SectionLabel>
      <View style={styles.row}>
        <Pill label="Import" icon="import" />
        <Pill label="New" icon="plus" tone="light" />
      </View>

      <SectionLabel style={styles.label}>Chips</SectionLabel>
      <View style={styles.wrap}>
        {['All', 'Today', 'This week', 'Partiful'].map((name) => (
          <Chip key={name} label={name} selected={chip === name} onPress={() => setChip(name)} />
        ))}
        <Chip label="Plain tag" />
      </View>

      <SectionLabel style={styles.label}>Sample badge</SectionLabel>
      <SampleBadge />

      <SectionLabel style={styles.label}>Event hero card (starts in 90 seconds)</SectionLabel>
      <EventHeroCard event={soon} />

      <SectionLabel style={styles.label}>Event rows</SectionLabel>
      {[...upcoming.slice(1, 3), longTitle].map((event, index) => (
        <View key={event.id} style={index > 0 && styles.divider}>
          <EventRow event={event} muted={index === 1} />
        </View>
      ))}

      <SectionLabel style={styles.label}>Cards</SectionLabel>
      <View style={styles.stack}>
        {['Selected card', 'Plain card'].map((title, index) => (
          <Card
            key={title}
            padded={false}
            selected={selected === index}
            accessibilityLabel={title}
            onPress={() => setSelected(index)}
          >
            <ListRow icon="calendar" title={title} subtitle="Grey subtitle" status="Accent status" />
          </Card>
        ))}
        <Card padded={false}>
          <ListRow title="First row" subtitle="Rows share one card" onPress={() => {}} />
          <ListRow title="Second row" divider right={<Txt color="textSecondary">Value</Txt>} />
        </Card>
      </View>

      <SectionLabel style={styles.label}>Stat grid</SectionLabel>
      <StatGrid
        items={[
          { label: 'Distance', value: '0.8 mi' },
          { label: 'Walking time', value: '17 min' },
          { label: 'Leave by', value: '6:10 PM' },
          { label: 'Event starts', value: '6:30 PM' },
        ]}
      />

      <SectionLabel style={styles.label}>Empty state</SectionLabel>
      <Card padded={false}>
        <EmptyState
          title="Nothing matches"
          body="An invitation to do something, with one clear action."
          actionLabel="Show all events"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  first: {
    marginBottom: space[3],
  },
  label: {
    marginTop: space[8],
    marginBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  stack: {
    gap: space[3],
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  corner: {
    flex: 1,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  swatch: {
    width: 96,
    gap: space[1],
  },
  swatchColor: {
    height: 48,
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
