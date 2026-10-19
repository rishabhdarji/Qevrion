import { useEffect, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { Txt } from '@/components/Txt';
import { getRouteKey } from '@/data/secrets';
import { distance, formatDistance, type LatLng } from '@/lib/geo';
import { placeIfAllowed } from '@/lib/location';
import {
  fetchSuggestions,
  phoneCountry,
  queryFor,
  SOURCE_NAME,
  SuggestError,
  type Suggestion,
  type SuggestSource,
} from '@/lib/suggest';
import { colors, radius, size, space, type } from '@/theme';

// ponytail: a Developer screen for Round 4, to choose between the two suggestion
// services on real addresses near the owner. Remove it once the choice is made.

const SOURCES: SuggestSource[] = ['photon', 'openrouteservice'];

type Result = { list: Suggestion[]; ms: number } | { problem: string };

const PROBLEM: Record<string, string> = {
  noKey: 'Needs the route key: add it in Settings first.',
  badKey: 'openrouteservice did not accept the route key.',
  quota: 'The key has used up its requests for now.',
  offline: 'No connection.',
  failed: 'Unexpected answer.',
};

export default function CompareSuggestions() {
  const [text, setText] = useState('');
  const [near, setNear] = useState<LatLng | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [results, setResults] = useState<Partial<Record<SuggestSource, Result>>>({});
  const [asked, setAsked] = useState('');

  useEffect(() => {
    getRouteKey().then(setKey);
    placeIfAllowed().then(setNear);
  }, []);

  const query = queryFor(text);
  useEffect(() => {
    if (!query) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setAsked(query);
      setResults({});
      for (const source of SOURCES) {
        const started = Date.now();
        fetchSuggestions(source, query, { key, near, homeCountry: phoneCountry(), signal: abort.signal })
          .then((list) => !abort.signal.aborted && setResults((r) => ({ ...r, [source]: { list, ms: Date.now() - started } })))
          .catch((error) => {
            if (abort.signal.aborted) return;
            const problem = error instanceof SuggestError ? error.problem : 'failed';
            setResults((r) => ({ ...r, [source]: { problem } }));
          });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, key, near]);

  const away = (s: Suggestion) => (near ? ` · ${formatDistance(distance(near, s), 'mi')} away` : '');

  const share = () => {
    const lines = [`Typed: "${asked}"`, near ? 'Ranked near my location' : 'No location (not allowed)'];
    for (const source of SOURCES) {
      const result = results[source];
      lines.push('', `${SOURCE_NAME[source]}:`);
      if (!result) lines.push('  (no answer yet)');
      else if ('problem' in result) lines.push(`  ${PROBLEM[result.problem] ?? result.problem}`);
      else if (result.list.length === 0) lines.push(`  nothing (${result.ms} ms)`);
      else result.list.forEach((s, i) => lines.push(`  ${i + 1}. ${s.full}${away(s)}`));
      if (result && !('problem' in result)) lines.push(`  ${result.ms} ms`);
    }
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <Screen glow>
      <ScreenHeader title="Compare suggestions" />
      <Txt variant="bodySmall" color="textSecondary" style={styles.lead}>
        Type part of a real address near you, as you would on the form: a house number and the
        first letters of the street. Both services are asked at once. What you type is sent to
        both{near ? ', with roughly where you are' : ''}.
      </Txt>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="For example: 12 Mai"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Address to try"
        autoCorrect={false}
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        style={styles.input}
      />
      <Txt variant="caption" color="textTertiary" style={styles.lead}>
        {near ? 'Location allowed: nearby places should come first.' : 'Location not allowed: no ranking by nearness.'}
        {key ? '' : ' No route key, so openrouteservice cannot be tried.'}
      </Txt>

      {query
        ? SOURCES.map((source) => {
            const result = results[source];
            return (
              <View key={source}>
                <SectionLabel style={styles.label}>{SOURCE_NAME[source]}</SectionLabel>
                <Card padded={false}>
                  {!result ? (
                    <Txt variant="caption" color="textSecondary" style={styles.row}>
                      Asking…
                    </Txt>
                  ) : 'problem' in result ? (
                    <Txt variant="caption" color="destructive" style={styles.row}>
                      {PROBLEM[result.problem] ?? result.problem}
                    </Txt>
                  ) : result.list.length === 0 ? (
                    <Txt variant="caption" color="textSecondary" style={styles.row}>
                      Nothing found · {result.ms} ms
                    </Txt>
                  ) : (
                    <>
                      {result.list.map((s, i) => (
                        <View key={`${s.full}-${i}`} style={[styles.row, i > 0 && styles.divider]}>
                          <Txt variant="bodySmall">
                            {i + 1}. {s.title}
                          </Txt>
                          <Txt variant="caption" color="textSecondary">
                            {s.detail}
                            {away(s)}
                          </Txt>
                        </View>
                      ))}
                      <Txt variant="caption" color="textTertiary" style={[styles.row, styles.divider]}>
                        {result.ms} ms
                      </Txt>
                    </>
                  )}
                </Card>
              </View>
            );
          })
        : null}

      {asked ? (
        <View style={styles.share}>
          <SecondaryButton label="Share these results" onPress={share} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    marginVertical: space[3],
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
  label: {
    marginTop: space[6],
    marginBottom: space[3],
  },
  row: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  share: {
    marginTop: space[6],
  },
});
