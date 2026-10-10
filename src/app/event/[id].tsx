import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ListRow } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { EventCover } from '@/components/EventCover';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SampleBadge } from '@/components/SampleBadge';
import { Screen } from '@/components/Screen';
import { IconButton, ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { useEvent } from '@/data/events';
import { formatDay, formatTime } from '@/lib/dates';
import { colors, radius, size, space } from '@/theme';

const CHECKLIST = ['Reply to the host', 'Sort out a lift home', 'Pick up something to bring'];

// Event detail. Laid out in Round 1; notes, checklist, weather and key details
// become real in Round 5.
export default function EventDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);

  if (!event) {
    return (
      <Screen glow>
        <ScreenHeader />
        <EmptyState title="Event not found" body="It may have been removed. Go back and pick another." />
      </Screen>
    );
  }

  const navigate = () => router.push({ pathname: '/navigate/[id]', params: { id: event.id } });

  return (
    <Screen scroll="bleed" footer={<PrimaryButton label="Navigate" onPress={navigate} />}>
      <View style={[styles.cover, { paddingTop: insets.top + space[2] }]}>
        <EventCover colors={event.cover} />
        <View style={styles.coverBar}>
          <View style={styles.floating}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
          </View>
          <Pill
            label="Edit"
            icon="edit"
            onPress={() => router.push({ pathname: '/event/edit', params: { id: event.id } })}
          />
        </View>
        <View style={styles.coverText}>
          {event.isSample ? <SampleBadge /> : null}
          <Txt variant="display" maxFontSizeMultiplier={1.3} numberOfLines={3} accessibilityRole="header">
            {event.title}
          </Txt>
        </View>
      </View>

      <View style={styles.body}>
        {event.hasConflict ? (
          <View style={styles.warning} accessible accessibilityRole="alert">
            <Icon name="warning" size={18} color={colors.destructive} />
            <Txt variant="bodySmall" style={styles.warningText}>
              Overlaps with another event that evening.
            </Txt>
          </View>
        ) : null}

        <Card padded={false}>
          <ListRow
            icon="calendar"
            title={formatDay(event.startsAt)}
            subtitle={`${formatTime(event.startsAt)} to ${formatTime(event.endsAt)}`}
          />
          <ListRow
            icon="pin"
            title={event.locationText}
            subtitle="Walking route"
            divider
            onPress={navigate}
          />
          <ListRow icon="person" title={event.host} subtitle="Host" divider />
        </Card>

        {event.keyDetails.length > 0 ? (
          <>
            <SectionLabel style={styles.label}>Key details</SectionLabel>
            <View style={styles.chips}>
              {event.keyDetails.map((detail) => (
                <Chip key={detail} label={detail} />
              ))}
            </View>
          </>
        ) : null}

        <SectionLabel style={styles.label}>About</SectionLabel>
        <Txt color="textSecondary">{event.description}</Txt>

        {event.isPartiful ? (
          <View style={styles.partiful}>
            <SecondaryButton label="Open in Partiful" />
          </View>
        ) : null}

        <SectionLabel style={styles.label}>My notes</SectionLabel>
        <Card>
          <Txt color="textTertiary">Notes you write here stay on this phone.</Txt>
        </Card>

        <SectionLabel style={styles.label}>Prep checklist</SectionLabel>
        <Card padded={false}>
          {CHECKLIST.map((item, index) => (
            <ListRow key={item} title={item} divider={index > 0} right={<View style={styles.checkbox} />} />
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {
    minHeight: 280,
    justifyContent: 'space-between',
    gap: space[10],
    paddingHorizontal: size.screenPadding,
    paddingBottom: space[5],
    backgroundColor: colors.surface,
  },
  coverBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floating: {
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  coverText: {
    gap: space[2],
  },
  body: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space[5],
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[4],
    padding: space[3],
    borderRadius: radius.inner,
    backgroundColor: colors.destructiveTint,
  },
  warningText: {
    flex: 1,
  },
  label: {
    marginTop: space[8],
    marginBottom: space[3],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  partiful: {
    marginTop: space[5],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.decoration,
  },
});
