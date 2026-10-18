import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { formatEventSpan } from '@/lib/dates';
import { isPartifulLink, webLink } from '@/lib/links';
import { colors, radius, size, space } from '@/theme';

const CHECKLIST = ['Reply to the host', 'Sort out a lift home', 'Pick up something to bring'];

// Event detail. Notes are edited in the form for now; the checklist, weather and key
// details become real in Round 7.
export default function EventDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const live = useEvent(id);
  // Holds on to the event once it is deleted, so this screen does not flash
  // "not found" while it slides away.
  const [event, setEvent] = useState(live);
  if (live && live !== event) setEvent(live);

  if (!event) {
    return (
      <Screen glow>
        <ScreenHeader />
        <EmptyState title="Event not found" body="It may have been removed. Go back and pick another." />
      </Screen>
    );
  }

  const navigate = () => router.push({ pathname: '/navigate/[id]', params: { id: event.id } });
  const edit = () => router.push({ pathname: '/event/edit', params: { id: event.id } });
  // Only plain web links get a button. Once events are imported a link is text from
  // outside, and anything else (a phone number, another app's address, a link dressed
  // up as another) is not opened.
  const url = webLink(event.url);
  const when = formatEventSpan(event);

  return (
    <Screen
      scroll="bleed"
      // There is nowhere to navigate to without an address.
      footer={event.locationText ? <PrimaryButton label="Navigate" onPress={navigate} /> : undefined}
    >
      <View style={[styles.cover, { paddingTop: insets.top + space[2] }]}>
        <EventCover colors={event.cover} photo={event.photo} />
        <View style={styles.coverBar}>
          <View style={styles.floating}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
          </View>
          <Pill label="Edit" icon="edit" onPress={edit} />
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
              Overlaps with another event.
            </Txt>
          </View>
        ) : null}

        <Card padded={false}>
          <ListRow icon="calendar" title={when.days} subtitle={when.times} />
          {event.locationText ? (
            <ListRow
              icon="pin"
              title={event.locationText}
              subtitle="Walking route"
              divider
              onPress={navigate}
            />
          ) : (
            // Says why there is no Navigate button, and is the way to get one.
            <ListRow
              icon="pin"
              title="Add a place"
              subtitle="Needed for the walking route"
              divider
              onPress={edit}
            />
          )}
          {event.host ? <ListRow icon="person" title={event.host} subtitle="Host" divider /> : null}
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

        {event.description ? (
          <>
            <SectionLabel style={styles.label}>About</SectionLabel>
            <Txt color="textSecondary">{event.description}</Txt>
          </>
        ) : null}

        {url ? (
          <View style={styles.partiful}>
            <SecondaryButton
              label={isPartifulLink(url) ? 'Open in Partiful' : 'Open link'}
              accessibilityHint="Opens the event's page"
              onPress={() => Linking.openURL(url).catch(() => {})}
            />
          </View>
        ) : null}

        <SectionLabel style={styles.label}>My notes</SectionLabel>
        <Card>
          {event.notes ? (
            <Txt>{event.notes}</Txt>
          ) : (
            <Txt color="textTertiary">
              Nothing yet. Tap Edit to add notes; they stay on this phone.
            </Txt>
          )}
        </Card>

        {/* ponytail: a picture of the checklist, on sample events only so it is never
            mistaken for your own list. Round 7 stores a real one per event. */}
        {event.isSample ? (
          <>
            <SectionLabel style={styles.label}>Checklist preview</SectionLabel>
            <Card padded={false}>
              {CHECKLIST.map((item, index) => (
                <ListRow
                  key={item}
                  title={item}
                  divider={index > 0}
                  right={<View style={styles.checkbox} />}
                />
              ))}
            </Card>
            <Txt variant="caption" color="textTertiary" style={styles.note}>
              A sample list. Your own checklists arrive in a later build.
            </Txt>
          </>
        ) : null}
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
  note: {
    marginTop: space[3],
    marginHorizontal: space[2],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.decoration,
  },
});
