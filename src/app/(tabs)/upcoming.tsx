import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { EventHeroCard } from '@/components/EventHeroCard';
import { EVENT_ROW_TEXT_INSET, EventRow } from '@/components/EventRow';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { Screen, useScreenPadding } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { useEvents } from '@/data/events';
import { useEventClock } from '@/lib/countdown';
import { buildHomeItems, FILTERS, type Filter, type ListItem } from '@/lib/homeItems';
import { colors, radius, size, space, type } from '@/theme';
import type { QevrionEvent } from '@/types';

const EMPTY: Record<Filter, { title: string; body: string }> = {
  All: {
    title: 'Nothing matches',
    body: 'Try a different word, or clear the search to see everything coming up.',
  },
  Today: { title: 'Nothing today', body: 'Your day is clear. The next event is further ahead.' },
  'This week': { title: 'A quiet week', body: 'Nothing in the next seven days.' },
  'Has conflicts': { title: 'No conflicts', body: 'None of your upcoming events overlap.' },
  Partiful: { title: 'No Partiful events', body: 'Events with a Partiful link show up here.' },
};

type HeaderProps = {
  total: number;
  /** Whether any upcoming events overlap, which puts a red dot on that chip. */
  conflicts: boolean;
  query: string;
  onQuery: (query: string) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
};

function HomeHeader({ total, conflicts, query, onQuery, filter, onFilter }: HeaderProps) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Txt variant="wordmark" accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          Qevrion
        </Txt>
        <View style={styles.actions}>
          <Pill
            label="Import"
            icon="import"
            accessibilityLabel="Import events"
            onPress={() => router.push('/import')}
          />
          <Pill
            label="New"
            icon="plus"
            tone="light"
            accessibilityLabel="New event"
            onPress={() => router.push('/event/edit')}
          />
        </View>
      </View>

      <View style={[styles.search, focused && styles.searchFocused]}>
        <Icon name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            total === 0 ? 'Search events' : `Search ${total} ${total === 1 ? 'event' : 'events'}`
          }
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Search events by title, venue or host"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          keyboardAppearance="dark"
          selectionColor={colors.accent}
          maxFontSizeMultiplier={1.4}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipScroller}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((name) => (
          <Chip
            key={name}
            label={name}
            selected={filter === name}
            dot={
              name === 'Has conflicts' && conflicts && filter !== name ? 'destructive' : undefined
            }
            onPress={() => onFilter(name)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// Home: the next event as a hero, then this week, then later months.
export default function Upcoming() {
  const router = useRouter();
  const events = useEvents();
  const padding = useScreenPadding({ bottomSpace: size.tabBar + space[3] });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  // Moves the hero on the moment an event starts, and a finished one off to Archive.
  const now = useEventClock(events);

  const items = buildHomeItems(events, now, query, filter);
  const upcoming = events.filter((event) => event.endsAt > now);
  const total = upcoming.length;
  const browsing = filter === 'All' && query.trim() === '';

  const open = (event: QevrionEvent) =>
    router.push({ pathname: '/event/[id]', params: { id: event.id } });

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    switch (item.kind) {
      case 'label':
        return (
          <SectionLabel count={item.count} style={[styles.label, index > 0 && styles.labelSpaced]}>
            {item.text}
          </SectionLabel>
        );
      case 'hero':
        return <EventHeroCard event={item.event} onPress={open} />;
      case 'row':
        return (
          <>
            {item.divider ? <View style={styles.divider} /> : null}
            <EventRow event={item.event} onPress={open} />
          </>
        );
    }
  };

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        // An element, not a function: a function here would remount the search field
        // on every keystroke and drop the keyboard.
        ListHeaderComponent={
          <HomeHeader
            total={total}
            conflicts={upcoming.some((event) => event.hasConflict)}
            query={query}
            onQuery={setQuery}
            filter={filter}
            onFilter={setFilter}
          />
        }
        ListEmptyComponent={
          browsing ? (
            <EmptyState
              title="Your calendar is clear"
              body="Add an event and it shows up here, with a countdown to the next one."
              actionLabel="Add an event"
              onAction={() => router.push('/event/edit')}
            />
          ) : (
            <EmptyState
              {...EMPTY[query.trim() ? 'All' : filter]}
              actionLabel="Show all"
              onAction={() => {
                setFilter('All');
                setQuery('');
              }}
            />
          )
        }
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: space[6],
  },
  topRow: {
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[3],
    marginBottom: space[4],
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
  },
  search: {
    minHeight: size.search,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchFocused: {
    borderColor: colors.secondaryButtonBorder,
  },
  searchInput: {
    ...type.body,
    // A set line height clips the caret on iOS.
    lineHeight: undefined,
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: space[2],
  },
  chipScroller: {
    // Let the row of chips run to the screen edges.
    marginHorizontal: -size.screenPadding,
    marginTop: space[3],
    flexGrow: 0,
  },
  chips: {
    gap: space[2],
    paddingHorizontal: size.screenPadding,
  },
  label: {
    marginBottom: space[3],
  },
  labelSpaced: {
    marginTop: space[8],
  },
  divider: {
    height: 1,
    marginLeft: EVENT_ROW_TEXT_INSET,
    backgroundColor: colors.hairline,
  },
});
