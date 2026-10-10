import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

import { QevrionMark } from './QevrionMark';
import { SecondaryButton } from './SecondaryButton';
import { Txt } from './Txt';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.root}>
      <QevrionMark size={40} color={colors.decoration} />
      <Txt variant="title" style={styles.center}>
        {title}
      </Txt>
      <Txt variant="bodySmall" color="textSecondary" style={styles.center}>
        {body}
      </Txt>
      {actionLabel ? (
        <View style={styles.action}>
          <SecondaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[10],
    paddingHorizontal: space[6],
  },
  center: {
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: space[4],
  },
});
