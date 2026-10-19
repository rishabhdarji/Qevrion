import type { ReactNode } from 'react';
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
  /** More buttons, under the first one. */
  children?: ReactNode;
};

export function EmptyState({ title, body, actionLabel, onAction, children }: Props) {
  return (
    <View style={styles.root}>
      <QevrionMark size={40} color={colors.decoration} />
      <Txt variant="title" style={styles.center}>
        {title}
      </Txt>
      <Txt variant="bodySmall" color="textSecondary" style={styles.center}>
        {body}
      </Txt>
      {actionLabel || children ? (
        <View style={styles.action}>
          {actionLabel ? <SecondaryButton label={actionLabel} onPress={onAction} /> : null}
          {children}
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
    gap: space[3],
    marginTop: space[4],
  },
});
