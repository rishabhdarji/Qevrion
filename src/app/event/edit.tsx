import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { EventCover } from '@/components/EventCover';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
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
  type DraftErrors,
  type EventDraft,
} from '@/lib/eventDraft';
import { SOURCE_NAME, type Suggestion } from '@/lib/suggest';
import { useAddressSuggestions } from '@/lib/useAddressSuggestions';
import { colors, covers, radius, size, space, type } from '@/theme';

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
        // "done" is the key that puts the keyboard away and uncovers the save button.
        returnKeyType={multiline ? undefined : 'done'}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        accessibilityHint={error}
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

type WhereProps = {
  value: string;
  /** The suggestion picked last, if the field still holds it. */
  picked: boolean;
  onChange: (text: string) => void;
  onPick: (suggestion: Suggestion) => void;
};

// "Where", with a short list of matching addresses under it while typing. Tapping one
// fills in the full address and keeps where it is, so it need not be looked up later.
function WhereField({ value, picked, onChange, onPick }: WhereProps) {
  // Only after a letter is typed: opening an event to edit it sends nothing.
  const [typing, setTyping] = useState(false);
  const { list, source, status } = useAddressSuggestions(value, typing);
  const credit = `Suggestions from ${SOURCE_NAME[source]}. What you type here is sent there to find addresses.`;
  const message =
    status === 'offline'
      ? 'No suggestions without a connection. Type the address in full; it is found on the map later.'
      : status === 'failed'
        ? 'Suggestions are not available right now. Type the address in full.'
        : status === 'done' && list.length === 0
          ? 'No matching addresses. Type it in full; it is found on the map when saved.'
          : null;

  return (
    <View style={styles.field}>
      <SectionLabel>Where</SectionLabel>
      <TextInput
        value={value}
        onChangeText={(text) => {
          setTyping(true);
          onChange(text);
        }}
        // A moment's grace, so a tap on a suggestion still lands as the field lets go.
        onBlur={() => setTimeout(() => setTyping(false), 250)}
        placeholder="Venue or address"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Where"
        accessibilityHint="Matching addresses are listed below as you type"
        returnKeyType="done"
        autoCorrect={false}
        textContentType="fullStreetAddress"
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        maxFontSizeMultiplier={1.4}
        style={styles.input}
      />
      {picked ? (
        <View style={styles.picked}>
          <Icon name="check" size={14} color={colors.accent} />
          <Txt variant="caption" color="accent">
            On the map
          </Txt>
        </View>
      ) : null}
      {typing && status !== 'idle' ? (
        <View style={styles.suggestions}>
          {list.map((item, index) => (
            <Pressable
              key={`${item.full}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={item.full}
              accessibilityHint="Fills in this address"
              style={({ pressed }) => [styles.suggestion, index > 0 && styles.suggestionDivider, pressed && styles.pressed]}
              onPress={() => {
                setTyping(false);
                onPick(item);
                AccessibilityInfo.announceForAccessibility(`Address chosen: ${item.full}`);
              }}
            >
              <Txt variant="bodySmall" numberOfLines={1}>
                {item.title}
              </Txt>
              {item.detail ? (
                <Txt variant="caption" color="textSecondary" numberOfLines={2}>
                  {item.detail}
                </Txt>
              ) : null}
            </Pressable>
          ))}
          {status === 'looking' && list.length === 0 ? (
            <Txt variant="caption" color="textSecondary" style={styles.suggestNote}>
              Looking…
            </Txt>
          ) : null}
          {message ? (
            <Txt variant="caption" color="textSecondary" style={styles.suggestNote}>
              {message}
            </Txt>
          ) : null}
          <Txt variant="caption" color="textTertiary" style={[styles.suggestNote, styles.credit]}>
            {credit}
          </Txt>
        </View>
      ) : null}
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
  const firstOf = (found: DraftErrors) => found.title ?? found.start ?? found.end;
  const set = (patch: Partial<EventDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = () => {
    if (done.current) return;
    const problem = firstOf(validateDraft(draft));
    if (problem) {
      setChecked(true);
      AccessibilityInfo.announceForAccessibility(problem);
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

  // The iPhone's own picker: it hands over the one photo chosen and asks for no
  // permission. The photo is only copied into the app when the event is saved.
  const pickPhoto = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (picked.canceled) return;
      set({ photo: picked.assets[0].uri });
      AccessibilityInfo.announceForAccessibility('Photo added');
    } catch {
      Alert.alert('Could not open your photos', 'Please try again.');
    }
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
      footer={
        <>
          {/* The form is taller than the screen, so the problem is repeated here, where
              the button that found it is. */}
          {firstOf(errors) ? (
            <Txt variant="caption" color="destructive" style={styles.footerProblem}>
              {firstOf(errors)}
            </Txt>
          ) : null}
          <PrimaryButton label={id ? 'Save changes' : 'Add event'} onPress={save} />
        </>
      }
    >
      <ScreenHeader leading="close" title={id ? 'Edit event' : 'New event'} />

      {/* A sync writes over what the calendar owns (src/lib/importPlan.ts), so a
          change made here to one of those would not last. */}
      {event?.source === 'calendar' ? (
        <Txt variant="caption" color="textSecondary" style={styles.fromCalendar}>
          Title, time, place, host and link come from your iPhone Calendar and are refreshed on
          each sync. Your notes and photo stay yours.
        </Txt>
      ) : null}
      {event?.source === 'ics' ? (
        <Txt variant="caption" color="textSecondary" style={styles.fromCalendar}>
          Title, time, place, host and link come from the calendar file and are refreshed if you
          import it again. Your notes and photo stay yours.
        </Txt>
      ) : null}

      {/* With no photo yet, a tap anywhere on the banner opens the picker, not only on
          the small button. VoiceOver still lands on the button alone. */}
      <Pressable
        accessible={false}
        style={styles.banner}
        onPress={draft.photo ? undefined : pickPhoto}
      >
        <EventCover colors={event?.cover ?? covers.slate} photo={draft.photo} />
        <View style={styles.bannerActions}>
          {draft.photo ? (
            <>
              <Pill label="Change" icon="photo" accessibilityLabel="Change photo" onPress={pickPhoto} />
              <Pill
                label="Remove"
                icon="close"
                accessibilityLabel="Remove photo"
                onPress={() => {
                  set({ photo: null });
                  AccessibilityInfo.announceForAccessibility('Photo removed');
                }}
              />
            </>
          ) : (
            <Pill label="Add a photo" icon="photo" onPress={pickPhoto} />
          )}
        </View>
      </Pressable>

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

      <WhereField
        value={draft.locationText}
        picked={!!draft.place && draft.place.full === draft.locationText.trim()}
        onChange={(locationText) => set({ locationText })}
        onPick={({ full, lat, lng }) => set({ locationText: full, place: { full, lat, lng } })}
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
  footerProblem: {
    textAlign: 'center',
  },
  fromCalendar: {
    marginBottom: space[4],
  },
  banner: {
    // Wide and short, like the header it becomes on the event's own screen.
    height: 168,
    justifyContent: 'flex-end',
    marginBottom: space[5],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  bannerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  picker: {
    alignSelf: 'flex-start',
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: size.tap,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: 2,
  },
  suggestionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  suggestNote: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  credit: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
