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
          <Txt variant="label" color="textSecondary">
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
