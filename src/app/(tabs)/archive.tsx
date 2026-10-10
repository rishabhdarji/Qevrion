import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { EVENT_ROW_TEXT_INSET, EventRow } from '@/components/EventRow';
import { QevrionMark } from '@/components/QevrionMark';
import { Screen, useScreenPadding } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { useEvents } from '@/data/events';
import { useNow } from '@/lib/countdown';
import { buildArchiveItems, type ListItem } from '@/lib/homeItems';
import { colors, size, space } from '@/theme';
import type { QevrionEvent } from '@/types';

// Past events, newest first, grouped by month.
export default function Archive() {
  const router = useRouter();
  const events = useEvents();
  const padding = useScreenPadding({ bottomSpace: size.tabBar + space[3] });
  const now = useNow(60_000);

  const items = buildArchiveItems(events, now);
  const total = items.filter((item) => item.kind === 'row').length;

  const open = (event: QevrionEvent) =>
    router.push({ pathname: '/event/[id]', params: { id: event.id } });

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if (item.kind === 'label') {
      return (
        <SectionLabel count={item.count} style={[styles.label, index > 0 && styles.labelSpaced]}>
          {item.text}
        </SectionLabel>
      );
    }
    return (
      <>
        {item.kind === 'row' && item.divider ? <View style={styles.divider} /> : null}
        <EventRow event={item.event} muted onPress={open} />
      </>
    );
  };

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="Qevrion">
              <QevrionMark size={24} />
              <Txt variant="wordmark" maxFontSizeMultiplier={1.2}>
                Qevrion
              </Txt>
            </View>
            <Txt variant="heading" accessibilityRole="header">
              Archive
            </Txt>
            <Txt variant="bodySmall" color="textSecondary">
              {total === 1 ? '1 event behind you' : `${total} events behind you`}
            </Txt>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing behind you yet"
            body="Events move here once they are over, so you can look back at them."
          />
        }
        contentContainerStyle={padding}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: space[6],
  },
  wordmark: {
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[4],
  },
  label: {
    marginBottom: space[3],
  },
  labelSpaced: {
    marginTop: space[8],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: EVENT_ROW_TEXT_INSET,
    backgroundColor: colors.hairline,
  },
});
