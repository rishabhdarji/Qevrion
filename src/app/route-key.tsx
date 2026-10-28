import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { getRouteKey, setRouteKey } from '@/data/secrets';
import { confirmDestructive } from '@/lib/confirm';
import { tap } from '@/lib/haptics';
import { checkKey, looksLikeKey } from '@/lib/route';
import { colors, radius, size, space, type } from '@/theme';

// ponytail: the sign-up page could not be opened from the build machine on 19 Oct
// 2026 (its network blocks the site); check it lands on the sign-up form on the iPhone.
const SIGN_UP_URL = 'https://openrouteservice.org/dev/#/signup';

/** The last four characters, so the owner can tell which key is saved without showing it. */
const tail = (key: string) => `ending ${key.slice(-4)}`;

// Settings, Walking routes key: paste the free openrouteservice key, which is checked
// with one short test route and then kept in the iPhone's keychain.
export default function RouteKey() {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; problem: boolean } | null>(null);

  useEffect(() => {
    getRouteKey().then(setSaved);
  }, []);

  const say = (text: string, problem = false) => {
    setMessage({ text, problem });
    AccessibilityInfo.announceForAccessibility(text);
  };

  const save = async () => {
    // Pasting often brings a space or a line break along.
    const key = typed.replace(/\s+/g, '');
    if (!looksLikeKey(key)) {
      say('That does not look like an openrouteservice key. Copy the whole key and paste it again.', true);
      return;
    }
    setBusy(true);
    const checked = await checkKey(key);
    setBusy(false);
    if (checked === 'badKey') {
      say('openrouteservice did not accept this key. Check it was copied in full.', true);
      return;
    }
    try {
      await setRouteKey(key);
    } catch {
      say('The key could not be saved on this iPhone. Please try again.', true);
      return;
    }
    tap();
    setSaved(key);
    setTyped('');
    say(
      checked === 'offline'
        ? 'Saved. It could not be checked without a connection; it will be tried on your next route.'
        : checked === 'quota'
          ? 'Saved. The key works, but it has used up its routes for now.'
          : checked === 'failed'
            ? 'Saved, but openrouteservice gave an unexpected answer, so the key could not be confirmed.'
            : 'Saved, and it works.',
    );
  };

  const remove = () =>
    confirmDestructive(
      'Remove the route key?',
      'Navigate goes back to a straight line and direction. Routes already saved on this phone are kept.',
      'Remove',
      async () => {
        await setRouteKey(null).catch(() => {});
        setSaved(null);
        say('Key removed.');
      },
    );

  return (
    <Screen glow sheet>
      <ScreenHeader leading="close" title="Walking routes key" />

      <Txt color="textSecondary" style={styles.lead}>
        Walking routes come from openrouteservice, which is free for personal use. Without a
        key, Navigate shows a straight line and the direction instead, and the Apple Maps and
        Google Maps buttons still work.
      </Txt>

      <SectionLabel style={styles.label}>Get a free key</SectionLabel>
      <Card style={styles.steps}>
        <Txt variant="bodySmall">1. Sign up at openrouteservice.org with an email address. The Standard plan is free.</Txt>
        <Txt variant="bodySmall">2. Open your dashboard and copy the key it shows.</Txt>
        <Txt variant="bodySmall">3. Paste it below and save.</Txt>
        <Txt variant="caption" color="textSecondary">
          The free plan allows 2,000 walking routes a day and 40 a minute. Qevrion saves each
          route and only asks again when you have moved, so a day uses a handful.
        </Txt>
        <SecondaryButton label="Open openrouteservice.org" onPress={() => Linking.openURL(SIGN_UP_URL)} />
      </Card>

      <SectionLabel style={styles.label}>Your key</SectionLabel>
      <Txt variant="bodySmall" color={saved ? 'accent' : 'textSecondary'} style={styles.status}>
        {saved === undefined ? ' ' : saved ? `Saved, ${tail(saved)}` : 'Not set'}
      </Txt>
      <TextInput
        value={typed}
        onChangeText={(text) => {
          setTyped(text);
          setMessage(null);
        }}
        placeholder={saved ? 'Paste a new key to replace it' : 'Paste your key here'}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="openrouteservice key"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        secureTextEntry
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        returnKeyType="done"
        onSubmitEditing={save}
        maxFontSizeMultiplier={1.4}
        style={styles.input}
      />
      {message ? (
        <Txt
          variant="caption"
          color={message.problem ? 'destructive' : 'textSecondary'}
          accessibilityRole={message.problem ? 'alert' : undefined}
          style={styles.message}
        >
          {message.text}
        </Txt>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          label={busy ? 'Checking…' : 'Save key'}
          disabled={busy || typed.trim() === ''}
          onPress={save}
        />
        {saved ? <SecondaryButton label="Remove key" color="destructive" onPress={remove} /> : null}
      </View>

      <SectionLabel style={styles.label}>What is sent</SectionLabel>
      <Txt variant="caption" color="textSecondary">
        The key stays in this iPhone&apos;s keychain. When you open Navigate, your position and
        the venue&apos;s are sent to openrouteservice (run by HeiGIT in Heidelberg, Germany) to
        work out the route, and nothing else about the event. Saving a key sends one test
        route between two fixed points in Heidelberg. Routes are kept on this phone for two
        weeks and go with Delete all data.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    marginBottom: space[2],
  },
  label: {
    marginTop: space[8],
    marginBottom: space[3],
  },
  steps: {
    gap: space[3],
  },
  status: {
    marginBottom: space[2],
  },
  input: {
    ...type.body,
    lineHeight: undefined,
    minHeight: size.button,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.inner,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  message: {
    marginTop: space[2],
  },
  actions: {
    marginTop: space[4],
    gap: space[3],
  },
});
