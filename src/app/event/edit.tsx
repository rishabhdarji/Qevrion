import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { removeEvent, saveEvent, useEvent } from '@/data/events';
import { confirmDestructive } from '@/lib/confirm';
import { formatDay, formatTime } from '@/lib/dates';
import {
  draftToFields,
  eventToDraft,
  moveStart,
  newDraft,
  validateDraft,
  type EventDraft,
} from '@/lib/eventDraft';
import { colors, radius, size, space, type } from '@/theme';

function Problem({ children }: { children?: string }) {
  return children ? (
    <Txt variant="caption" color="destructive" accessibilityRole="alert">
      {children}
    </Txt>
  ) : null;
}

type FieldProps = TextInputProps & { label: string; error?: string };

function Field({ label, error, multiline, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      <TextInput
        {...input}
        multiline={multiline}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        maxFontSizeMultiplier={1.4}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
      />
      <Problem>{error}</Problem>
    </View>
  );
}

type WhenProps = {
  label: string;
  value: number;
  dateOnly: boolean;
  error?: string;
  onChange: (ms: number) => void;
};

// A date and time, picked with the iPhone's own compact picker.
function When({ label, value, dateOnly, error, onChange }: WhenProps) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      {Platform.OS === 'web' ? (
        // The desktop preview has no date picker, so it only shows the value.
        <Txt>{dateOnly ? formatDay(value) : `${formatDay(value)} · ${formatTime(value)}`}</Txt>
      ) : (
        <DateTimePicker
          value={new Date(value)}
          mode={dateOnly ? 'date' : 'datetime'}
          display="compact"
          themeVariant="dark"
          accentColor={colors.accent}
          accessibilityLabel={label}
          style={styles.picker}
          onValueChange={(_, date) => onChange(date.getTime())}
        />
      )}
      <Problem>{error}</Problem>
    </View>
  );
}

// Add an event, or with `?id=` edit that one.
export default function EditEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const event = useEvent(id);
  const [draft, setDraft] = useState<EventDraft>(() =>
    event ? eventToDraft(event) : newDraft(Date.now()),
  );
  // Problems stay quiet until the first try at saving.
  const [checked, setChecked] = useState(false);
  // Set once the event is saved or deleted, so a second tap while the sheet closes
  // cannot add it twice.
  const done = useRef(false);

  const errors = checked ? validateDraft(draft) : {};
  const set = (patch: Partial<EventDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = () => {
    if (done.current) return;
    if (Object.keys(validateDraft(draft)).length > 0) {
      setChecked(true);
      return;
    }
    try {
      saveEvent(draftToFields(draft), id);
    } catch {
      Alert.alert('Could not save', 'The event was not saved. Please try again.');
      return;
    }
    done.current = true;
    router.back();
  };

  const remove = () =>
    confirmDestructive(
      'Delete this event?',
      'It is removed from this phone. This cannot be undone.',
      'Delete',
      () => {
        if (!id || done.current) return;
        done.current = true;
        removeEvent(id);
        // Closes this sheet and the event's own screen underneath it.
        router.dismissAll();
      },
    );

  return (
    <Screen
      glow
      sheet
      footer={<PrimaryButton label={id ? 'Save changes' : 'Add event'} onPress={save} />}
    >
      <ScreenHeader leading="close" title={id ? 'Edit event' : 'New event'} />
      <Field
        label="Title"
        value={draft.title}
        onChangeText={(title) => set({ title })}
        placeholder="Rooftop dinner"
        error={errors.title}
        autoFocus={!id}
      />

      <View style={styles.switchRow}>
        <Txt>All day</Txt>
        <Switch
          value={draft.allDay}
          onValueChange={(allDay) => set({ allDay })}
          accessibilityLabel="All day"
          trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
          ios_backgroundColor={colors.surfaceRaised}
        />
      </View>
      <When
        label={draft.allDay ? 'First day' : 'Starts'}
        value={draft.start}
        dateOnly={draft.allDay}
        error={errors.start}
        onChange={(start) => setDraft((current) => moveStart(current, start))}
      />
      <When
        label={draft.allDay ? 'Last day' : 'Ends'}
        value={draft.end}
        dateOnly={draft.allDay}
        error={errors.end}
        onChange={(end) => set({ end })}
      />

      <Field
        label="Where"
        value={draft.locationText}
        onChangeText={(locationText) => set({ locationText })}
        placeholder="Venue or address"
      />
      <Field
        label="Host"
        value={draft.host}
        onChangeText={(host) => set({ host })}
        placeholder="Who is hosting"
      />
      <Field
        label="Link"
        value={draft.url}
        onChangeText={(url) => set({ url })}
        placeholder="https://"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        label="Notes"
        value={draft.notes}
        onChangeText={(notes) => set({ notes })}
        placeholder="Anything you want to remember"
        multiline
      />

      {id ? <SecondaryButton label="Delete event" color="destructive" onPress={remove} /> : null}
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
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  inputError: {
    borderColor: colors.destructive,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  switchRow: {
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[5],
  },
  picker: {
    alignSelf: 'flex-start',
  },
});
