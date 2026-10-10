import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { useEvent } from '@/data/events';
import { formatWhen } from '@/lib/dates';
import { colors, radius, size, space, type } from '@/theme';

type FieldProps = {
  label: string;
  value?: string;
  placeholder: string;
  multiline?: boolean;
};

function Field({ label, value, placeholder, multiline = false }: FieldProps) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      <TextInput
        defaultValue={value}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        multiline={multiline}
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        maxFontSizeMultiplier={1.4}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

// Add or edit an event. With `?id=` it opens filled in.
// ponytail: fields are not validated or saved; Round 2 adds both with the database.
export default function EditEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const event = useEvent(id);

  return (
    <Screen
      glow
      sheet
      footer={
        <>
          <PrimaryButton label={event ? 'Save changes' : 'Add event'} onPress={() => router.back()} />
          <Txt variant="caption" color="textTertiary" style={styles.note}>
            Preview only. Saving arrives with the next build.
          </Txt>
        </>
      }
    >
      <ScreenHeader leading="close" title={event ? 'Edit event' : 'New event'} />
      <Field label="Title" value={event?.title} placeholder="Rooftop dinner" />
      <Field
        label="Starts"
        value={event ? formatWhen(event.startsAt) : undefined}
        placeholder="Sat, Oct 17 · 7:00 PM"
      />
      <Field
        label="Ends"
        value={event ? formatWhen(event.endsAt) : undefined}
        placeholder="Sat, Oct 17 · 10:00 PM"
      />
      <Field label="Where" value={event?.locationText} placeholder="Venue or address" />
      <Field label="Host" value={event?.host} placeholder="Who is hosting" />
      <Field label="Link" value={event?.url ?? undefined} placeholder="https://" />
      <Field label="Notes" placeholder="Anything you want to remember" multiline />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space[2],
    marginBottom: space[5],
  },
  input: {
    ...type.body,
    // A set line height clips the caret on iOS.
    lineHeight: undefined,
    minHeight: size.button,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.inner,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  note: {
    textAlign: 'center',
  },
});
