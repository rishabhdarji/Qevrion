import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { Txt } from './Txt';

type Props = {
  items: { label: string; value: string }[];
};

// Two columns of small uppercase labels over serif values.
export function StatGrid({ items }: Props) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.label}
          style={styles.cell}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          {/* One line, shrunk to fit if it must: a narrow phone at a large text size
              would otherwise break "Unchanged" mid-word. */}
          <Txt
            variant="label"
            color="textSecondary"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {item.label}
          </Txt>
          <Txt variant="title">{item.value}</Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[6],
  },
  cell: {
    width: '50%',
    gap: space[1],
    paddingRight: space[3],
  },
});
