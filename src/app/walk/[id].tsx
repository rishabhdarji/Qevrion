import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { GroundArrow } from '@/components/GroundArrow';
import { Icon } from '@/components/Icon';
import { LocationCard } from '@/components/LocationCard';
import { NoticeBanner } from '@/components/NoticeBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Pill } from '@/components/Pill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatGrid } from '@/components/StatGrid';
import { Txt } from '@/components/Txt';
import { getSettings, updateSettings } from '@/data/db';
import { useEvent } from '@/data/events';
import { useWalkingRoute } from '@/data/routes';
import { loadRecording, saveRecording } from '@/data/walkRecording';
import { useNow } from '@/lib/countdown';
import { formatTime } from '@/lib/dates';
import {
  arrowRotation,
  bearing,
  distance,
  formatDistance,
  isPlace,
  OFF_ROUTE_M,
  WAYPOINT_REACHED_M,
  type LatLng,
} from '@/lib/geo';
import { arrived as arrivedTap, turnSoon } from '@/lib/haptics';
import {
  compassNeedsCalibration,
  easeAngle,
  filterHeading,
  signedAngle,
  type HeadingFilter,
} from '@/lib/heading';
import { useLocationAccess, usePosition, type Position } from '@/lib/location';
import { useOnline } from '@/lib/network';
import { useReplay } from '@/lib/replay';
import { useAppActive, useHeadingSamples, type HeadingSample } from '@/lib/sensors';
import {
  recordFix,
  recordHeading,
  recordingToTrack,
  startRecording,
  walkAlong,
  type HeadingReading,
  type Recording,
  type Track,
} from '@/lib/simulateWalk';
import {
  ARRIVED_M,
  arrivalAt,
  arrowWords,
  compassWord,
  formatAccuracy,
  guide,
  POOR_GPS_M,
  prepareRoute,
  START,
  TURN_SOON_M,
  turnLabel,
  type GuideState,
} from '@/lib/walkGuide';
import { whyStraight } from '@/lib/walkSummary';
import type { QevrionEvent, Settings } from '@/types';
import { colors, radius, size, space } from '@/theme';

// AR Walk (SPEC F6): the rear camera with an arrow on the ground that turns toward the
// next turn, driven by GPS and the compass. Not ARKit: it knows where you are to a few
// metres and which way the phone faces to a few degrees, and says so.

/** How long the bearing to the aim takes to settle after a jump, such as at a turn. */
const BEARING_EASE_S = 0.35;
/** Arrow changes smaller than this are not drawn, so it never shivers. */
const DEAD_BAND = 0.5;
/** The arrow is laid down at most this far, seen along the ground with the phone upright. */
const MAX_LEAN = 62;
/** GPS banner hysteresis: shown worse than 30 m (SPEC F6), gone again at 25 m. */
const GPS_FINE_M = 25;
/** Poor compass readings for this long before the banner says so. */
const COMPASS_POOR_MS = 3000;
/** A heading reading kept in a recording at most this often. */
const RECORD_HEADING_MS = 250;
/** A made-up walk starts here if you are not near the venue (or not known). */
const SIM_NEAR_M = 3000;
const SIM_START = { north: -280, east: -280 };
/** The arrow's box, in points. */
const ARROW_MAX = 240;
const ARROW_MIN = 120;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** `p` moved `north` and `east` metres. */
const shift = (p: LatLng, north: number, east: number): LatLng => ({
  lat: p.lat + north / 111_195,
  lng: p.lng + east / (111_195 * Math.cos((p.lat * Math.PI) / 180)),
});

// The screen: the event, its place, and the one-time safety note before anything starts.
export default function ArWalk() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const [settings] = useState(getSettings);
  const [safetySeen, setSafetySeen] = useState(settings.walkSafetySeen);
  // One object for the walk, not a new one each time the screen is drawn.
  const lat = event?.lat;
  const lng = event?.lng;
  const venue = useMemo(() => (typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null), [lat, lng]);

  if (!event) {
    return (
      <Screen glow>
        <ScreenHeader />
        <EmptyState title="Event not found" body="Go back and pick an event to walk to." />
      </Screen>
    );
  }
  if (!venue || !isPlace(venue) || event.geocodeStatus !== 'located') {
    return (
      <Screen glow>
        <ScreenHeader />
        <EmptyState
          title="Not on the map"
          body="AR Walk points to the venue, so it needs the event's place on the map first."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  if (!safetySeen) {
    return (
      <SafetyNote
        onAccept={() => {
          updateSettings({ walkSafetySeen: true });
          setSafetySeen(true);
        }}
        onLater={() => router.back()}
      />
    );
  }
  return <Walk event={event} venue={venue} settings={settings} />;
}

/** Shown once, before the first walk (SPEC F6). */
function SafetyNote({ onAccept, onLater }: { onAccept: () => void; onLater: () => void }) {
  return (
    <Screen
      glow
      footer={
        <View style={styles.safetyButtons}>
          <PrimaryButton label="I'll keep my eyes up" onPress={onAccept} />
          <SecondaryButton label="Not now" onPress={onLater} />
        </View>
      }
    >
      <View style={styles.safety}>
        <Icon name="eye" size={32} color={colors.accent} />
        <Txt variant="display" accessibilityRole="header">
          Eyes on the road
        </Txt>
        <Txt color="textSecondary">
          Glance at the arrow, then look where you are going. Stop somewhere safe to read the screen,
          and watch for traffic at every crossing.
        </Txt>
        <Txt color="textSecondary">
          The arrow comes from GPS and the compass, not from what the camera sees. It points the
          general way and can be several metres out, more between tall buildings. Street signs win.
        </Txt>
        <Txt variant="caption" color="textTertiary">
          AR Walk uses the camera, your location and the compass while it is open. Nothing the
          camera sees is kept or sent.
        </Txt>
      </View>
    </Screen>
  );
}

/** Lines running to a horizon, behind the arrow when the camera is off. */
function Backdrop() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="walkBackdrop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.glow} />
          <Stop offset="0.45" stopColor={colors.surface} />
          <Stop offset="1" stopColor={colors.background} />
        </LinearGradient>
      </Defs>
      <Rect width={390} height={844} fill="url(#walkBackdrop)" />
      {[-200, -60, 60, 140, 250, 330, 450, 590].map((x) => (
        <Path key={x} d={`M195 300L${x} 844`} stroke={colors.textPrimary} strokeOpacity={0.06} strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

type Readout = { motion: number | null; compass: number | null; tilt: number | null; arrow: number };

/** The walk itself. Mounted only after the safety note, and every sensor stops when it unmounts. */
function Walk({ event, venue: eventVenue, settings }: { event: QevrionEvent; venue: LatLng; settings: Settings }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const units = settings.units;
  const simulate = settings.simulateWalk;
  const record = settings.recordWalks && !simulate;
  const dev = settings.simulateWalk || settings.recordWalks;
  const active = useAppActive();
  const online = useOnline();
  const now = useNow(10_000);
  const { access, ask } = useLocationAccess();
  const [camera, askCamera] = useCameraPermissions();

  // The camera is asked for once, as the walk opens; the safety note said why.
  useEffect(() => {
    if (camera?.status === 'undetermined' && camera.canAskAgain) askCamera();
  }, [camera, askCamera]);

  // Simulation (Settings, Developer): what to replay, which heading, how fast.
  const [recording] = useState(() => (simulate ? loadRecording() : null));
  const [source, setSource] = useState<'route' | 'recorded'>('route');
  const [headingFrom, setHeadingFrom] = useState<'walk' | 'phone'>('walk');
  const [speed, setSpeed] = useState(1);
  const replaying = simulate && source === 'recorded' && recording !== null;
  const venue = replaying ? recording.venue : eventVenue;

  // The GPS: the walk itself, or in a simulation only where the made-up walk starts.
  const gps = usePosition(active && access === 'granted', simulate ? {} : { everyMetres: 2, best: true });
  const [gpsWaited, setGpsWaited] = useState(false);
  useEffect(() => {
    if (!simulate) return;
    const timer = setTimeout(() => setGpsWaited(true), 4000);
    return () => clearTimeout(timer);
  }, [simulate]);
  const simStart = useMemo<LatLng | null>(() => {
    if (!simulate) return null;
    if (gps && distance(gps, venue) <= SIM_NEAR_M) return { lat: gps.lat, lng: gps.lng };
    return gps || gpsWaited ? shift(venue, SIM_START.north, SIM_START.east) : null;
  }, [simulate, gps, gpsWaited, venue]);

  // Headings, smoothed, and the arrow they turn. None of this re-renders the screen.
  const rotation = useSharedValue(0);
  const lean = useSharedValue(MAX_LEAN);
  const filter = useRef<HeadingFilter | null>(null);
  const aimBearing = useRef<number | null>(null);
  const shownBearing = useRef<number | null>(null);
  const shownTurn = useRef(0);
  const tilt = useRef<number | null>(null);
  const lastSteer = useRef(0);
  const lastReadout = useRef(0);
  const [level, setLevel] = useState(-1);
  // The compass banner waits for 3 seconds of poor readings, so a moment of doubt as
  // the compass starts does not flash it.
  const compassPoorSince = useRef<number | null>(null);
  const [compassPoor, setCompassPoor] = useState(false);
  const noteLevel = useCallback((value: number, at: number) => {
    setLevel(value);
    const poor = value >= 0 && compassNeedsCalibration(value);
    compassPoorSince.current = poor ? (compassPoorSince.current ?? at) : null;
    setCompassPoor(poor && at - (compassPoorSince.current ?? at) >= COMPASS_POOR_MS);
  }, []);
  const [steering, setSteering] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);

  const steer = useCallback(
    (heading: number, at: number, phoneTilt: number | null, sample: HeadingSample | null) => {
      filter.current = filterHeading(filter.current, heading, at);
      if (aimBearing.current !== null) {
        shownBearing.current =
          shownBearing.current === null
            ? aimBearing.current
            : easeAngle(shownBearing.current, aimBearing.current, at - lastSteer.current, BEARING_EASE_S);
        const step = signedAngle(arrowRotation(shownBearing.current, filter.current.value) - shownTurn.current);
        if (Math.abs(step) >= DEAD_BAND) {
          // Kept unwound, so the arrow always goes the short way round.
          shownTurn.current += step;
          rotation.set(withTiming(shownTurn.current, { duration: 90, easing: Easing.linear }));
        }
        setSteering(true);
      }
      if (phoneTilt !== null) {
        tilt.current = tilt.current === null ? phoneTilt : tilt.current + 0.2 * (phoneTilt - tilt.current);
        lean.set(withTiming(Math.max(0, Math.min(MAX_LEAN, tilt.current)), { duration: 90 }));
      }
      lastSteer.current = at;
      // Twice a second is enough for the words and numbers.
      if (at - lastReadout.current >= 500) {
        lastReadout.current = at;
        setReadout({
          motion: sample?.motion ?? null,
          compass: sample?.compass ?? null,
          tilt: phoneTilt,
          arrow: signedAngle(shownTurn.current),
        });
      }
    },
    [rotation, lean],
  );

  // The recording of this walk, when "Record AR walks" is on.
  const walkLog = useRef<Recording | null>(null);
  const lastLogged = useRef(0);

  const onLive = useCallback(
    (sample: HeadingSample) => {
      noteLevel(sample.level, sample.at);
      if (record && walkLog.current && sample.at - lastLogged.current >= RECORD_HEADING_MS) {
        lastLogged.current = sample.at;
        recordHeading(walkLog.current, sample);
      }
      if (simulate && headingFrom === 'walk') return;
      if (sample.heading !== null) steer(sample.heading, sample.at, sample.tilt, sample);
    },
    [record, simulate, headingFrom, steer, noteLevel],
  );
  useHeadingSamples(active && (!simulate || headingFrom === 'phone'), onLive);

  const onTrackHeading = useCallback(
    (reading: HeadingReading) => {
      if (headingFrom !== 'walk') return;
      noteLevel(reading.level, Date.now());
      steer(reading.heading, Date.now(), null, null);
    },
    [headingFrom, steer, noteLevel],
  );

  // The walk to replay: one made up along the route, or the one recorded.
  const recordedTrack = useMemo(() => (replaying ? recordingToTrack(recording) : null), [replaying, recording]);
  const [routeTrack, setRouteTrack] = useState<Track | null>(null);
  const track = simulate ? (replaying ? recordedTrack : routeTrack) : null;
  const replay = useReplay(track, active, speed, onTrackHeading);

  const replayFix = replay.fix;
  const simPosition = useMemo<Position | null>(
    () => (replayFix ? { lat: replayFix.lat, lng: replayFix.lng, accuracy: replayFix.accuracy, at: replayFix.at } : null),
    [replayFix],
  );
  const me = simulate ? simPosition : gps;
  const answer = useWalkingRoute(simulate ? (me ?? simStart) : gps, venue, online);

  // A made-up walk is laid along the first answer, the route or a straight line, and
  // kept: a later answer must not start the walk again.
  if (simulate && !replaying && !routeTrack && answer && simStart) {
    setRouteTrack(walkAlong(answer.kind === 'route' ? answer.route.line : [simStart, venue]));
  }

  // Where you are on the route, which turns are behind you, and where the arrow aims.
  const prepared = useMemo(() => (answer?.kind === 'route' ? prepareRoute(answer.route) : null), [answer]);
  const routeKey = prepared?.fetchedAt ?? 0;
  const [progress, setProgress] = useState<{ route: number; state: GuideState }>({ route: 0, state: START });
  const guideState = progress.route === routeKey ? progress.state : START;
  const guidance = useMemo(
    () => (me ? guide(prepared, me, venue, guideState) : null),
    [prepared, me, venue, guideState],
  );
  // A turn once reached stays reached.
  if (guidance && guidance.state.next !== guideState.next) setProgress({ route: routeKey, state: guidance.state });
  useEffect(() => {
    aimBearing.current = guidance && me ? bearing(me, guidance.aim) : null;
  }, [guidance, me]);

  // Two taps as a turn comes close, once per turn.
  const buzzed = useRef(new Set<string>());
  const turnIndex = guidance?.turn?.index ?? null;
  const toTurn = guidance?.toTurn ?? null;
  useEffect(() => {
    if (turnIndex === null || toTurn === null) return;
    const key = `${routeKey}:${turnIndex}`;
    if (toTurn <= TURN_SOON_M && toTurn > -WAYPOINT_REACHED_M && !buzzed.current.has(key)) {
      buzzed.current.add(key);
      turnSoon();
    }
  }, [routeKey, turnIndex, toTurn]);

  // VoiceOver hears each new instruction.
  const instruction = guidance?.turn?.instruction ?? null;
  useEffect(() => {
    if (instruction) AccessibilityInfo.announceForAccessibility(instruction);
  }, [instruction]);

  // Arrival: a success tap and a card, once. "Keep guiding" puts the card away.
  const [arrival, setArrival] = useState<'walking' | 'arrived' | 'dismissed'>('walking');
  if (guidance?.arrived && arrival === 'walking') setArrival('arrived');
  useEffect(() => {
    if (arrival !== 'arrived') return;
    arrivedTap();
    AccessibilityInfo.announceForAccessibility("You've arrived");
  }, [arrival]);

  // GPS worse than 30 m gets a banner, and loses it again at 25 m.
  const [gpsPoor, setGpsPoor] = useState(false);
  const accuracy = me?.accuracy ?? null;
  const poorNow =
    accuracy === null ? gpsPoor : accuracy > POOR_GPS_M ? true : accuracy <= GPS_FINE_M ? false : gpsPoor;
  if (poorNow !== gpsPoor) setGpsPoor(poorNow);

  // Recording: each real fix, and the file written when the walk closes or the app goes
  // to the background (where it may be closed for good).
  useEffect(() => {
    if (!record || !gps) return;
    walkLog.current ??= startRecording(gps.at, eventVenue);
    recordFix(walkLog.current, gps);
  }, [record, gps, eventVenue]);
  useEffect(() => {
    const log = walkLog;
    const keep = () => {
      if (log.current && log.current.fixes.length >= 2) saveRecording(log.current);
    };
    if (!active) keep();
    return keep;
  }, [active]);

  const restart = () => {
    replay.restart();
    setProgress({ route: 0, state: START });
    setArrival('walking');
    buzzed.current.clear();
    filter.current = null;
  };

  // The arrow fills the room between the cards, within limits, so a small phone with
  // a banner showing still has one that does not run under the cards.
  const [room, setRoom] = useState(ARROW_MAX);
  const arrowSize = Math.max(ARROW_MIN, Math.min(ARROW_MAX, room - space[4]));

  const left = guidance?.left ?? null;
  const offRoute = guidance?.offRoute != null && guidance.offRoute > OFF_ROUTE_M;
  const needsLocation = !simulate && access !== 'granted' && access !== 'checking';

  return (
    <View style={styles.root}>
      {camera?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" active={active} animateShutter={false} />
      ) : (
        <Backdrop />
      )}

      <View style={[styles.top, { paddingTop: insets.top + space[3] }]}>
        {arrival === 'arrived' ? (
          // Not grouped for VoiceOver, so its two buttons stay reachable; the arrival is announced.
          <View style={styles.card}>
            <Icon name="pin" size={28} color={colors.success} />
            <Txt variant="display">You&apos;ve arrived</Txt>
            <Txt color="textSecondary">
              {replaying
                ? 'This is where the recorded walk ended.'
                : `Within about ${formatDistance(ARRIVED_M, units)} of ${event.locationText}. ${event.title} starts at ${formatTime(event.startsAt)}.`}
            </Txt>
            <View style={styles.arrivedButtons}>
              <PrimaryButton label="End walk" onPress={() => router.back()} />
              <SecondaryButton label="Keep guiding" onPress={() => setArrival('dismissed')} />
            </View>
          </View>
        ) : (
          <View style={styles.card} accessible accessibilityLiveRegion="polite">
            {needsLocation ? (
              <Txt variant="title">Your location is needed</Txt>
            ) : !me ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.textSecondary} />
                <Txt color="textSecondary">
                  {simulate ? 'Starting the simulated walk…' : 'Finding where you are…'}
                </Txt>
              </View>
            ) : guidance?.turn && toTurn !== null ? (
              <>
                <Txt variant="label" color="textSecondary">
                  {turnLabel(toTurn, units)}
                </Txt>
                <Txt variant="title" accessibilityRole="header">
                  {guidance.turn.instruction}
                </Txt>
              </>
            ) : (
              <>
                <Txt variant="label" color="textSecondary">
                  {left !== null ? `About ${formatDistance(left, units)}` : 'Ahead'}
                </Txt>
                <Txt variant="title" accessibilityRole="header">
                  {prepared ? 'Follow the arrow to the venue' : 'Straight toward the venue'}
                </Txt>
              </>
            )}
            {me && !prepared ? (
              <Txt variant="caption" color="textSecondary">
                {answer?.kind === 'straight'
                  ? `${whyStraight(answer.problem)} Follow the streets: the arrow points through buildings.`
                  : 'Finding the walking route…'}
              </Txt>
            ) : null}
            {offRoute ? (
              <Txt variant="caption" color="warning">
                Off the route. A new one is found once you have been off it for 10 seconds.
              </Txt>
            ) : null}
          </View>
        )}

        {gpsPoor || compassPoor ? (
          <NoticeBanner
            solid
            title="Low accuracy"
            body={[
              gpsPoor
                ? `GPS is rough here (worse than ${formatDistance(POOR_GPS_M, units)} either way), so the arrow and distances may be well off. Check the street signs.`
                : null,
              compassPoor
                ? 'The compass needs calibrating: hold the phone out and trace a figure of eight a few times, away from cars and railings.'
                : null,
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ) : null}
        {online ? null : (
          <OfflineBanner solid body="The arrow still works. A new route cannot be fetched until you are back online." />
        )}
      </View>

      <View style={styles.middle} onLayout={(e) => setRoom(e.nativeEvent.layout.height)}>
        {needsLocation ? (
          <LocationCard
            access={access}
            ask={ask}
            title="Walk from where you are"
            reason="AR Walk turns the arrow from where you are and which way you face. It needs your location while the app is open, never in the background."
            without="Without it AR Walk cannot tell where you are."
          />
        ) : arrival === 'arrived' ? null : (
          <GroundArrow
            size={arrowSize}
            rotation={rotation}
            lean={lean}
            faint={!me || !steering}
            accessibilityLabel={readout ? arrowWords(readout.arrow) : 'Arrow, waiting for the compass'}
          />
        )}
        {!camera?.granted && camera ? (
          <View style={styles.cameraOff}>
            <Pill
              icon="camera"
              label={camera.canAskAgain ? 'Turn on the camera' : 'Camera is off · Settings'}
              onPress={() => (camera.canAskAgain ? askCamera() : Linking.openSettings())}
            />
          </View>
        ) : null}
      </View>

      {simulate || arrival !== 'arrived' ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
          {simulate ? (
            <View style={[styles.sim, arrival !== 'arrived' && styles.simDivider]}>
              <View style={styles.simTop}>
                <Txt variant="label" color="sampleBadgeText">
                  Simulated walk
                </Txt>
                <Txt variant="caption" color="textSecondary">
                  {track ? `${clock(replay.played)} of ${clock(replay.total)}` : 'Getting ready'}
                </Txt>
              </View>
              <View style={styles.chips}>
                {recording ? (
                  <>
                    <Chip
                      label="Route"
                      selected={source === 'route'}
                      onPress={() => {
                        setSource('route');
                        restart();
                      }}
                    />
                    <Chip
                      label="Recorded"
                      selected={source === 'recorded'}
                      onPress={() => {
                        setSource('recorded');
                        restart();
                      }}
                    />
                  </>
                ) : null}
                <Chip
                  label={headingFrom === 'walk' ? 'Facing: the walk' : 'Facing: this phone'}
                  onPress={() => setHeadingFrom((h) => (h === 'walk' ? 'phone' : 'walk'))}
                />
                <Chip label={`${speed}×`} onPress={() => setSpeed((s) => (s >= 8 ? 1 : s * 2))} />
                <Chip label={replay.done ? 'Again' : 'Restart'} onPress={restart} />
              </View>
            </View>
          ) : null}

          {/* Once arrived, the card at the top has the way out. */}
          {arrival === 'arrived' ? null : (
            <>
              <StatGrid
                items={[
                  { label: 'Distance left', value: left !== null ? formatDistance(left, units) : '–' },
                  { label: 'Arrive', value: left !== null ? formatTime(arrivalAt(now, left)) : '–' },
                ]}
              />
              <View>
                <Txt variant="caption" color="textTertiary">
                  {`GPS ${accuracy !== null ? formatAccuracy(accuracy, units) : '…'} · Compass ${compassWord(level)}. The arrow points the general way, not the exact path.`}
                </Txt>
                {dev && readout ? (
                  <Txt variant="caption" color="textTertiary">
                    {`Motion ${readout.motion?.toFixed(0) ?? '–'}° · Compass ${readout.compass?.toFixed(0) ?? '–'}° · Tilt ${readout.tilt?.toFixed(0) ?? '–'}° · Arrow ${readout.arrow.toFixed(0)}°${record ? ' · Recording' : ''}`}
                  </Txt>
                ) : null}
              </View>
              <SecondaryButton label="End" color="destructive" onPress={() => router.back()} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  top: {
    paddingHorizontal: size.screenPadding,
    gap: space[3],
  },
  card: {
    padding: space[5],
    gap: space[2],
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: size.screenPadding,
    paddingBottom: space[4],
  },
  arrivedButtons: {
    gap: space[3],
    marginTop: space[2],
  },
  cameraOff: {
    marginTop: space[3],
  },
  sheet: {
    paddingTop: space[5],
    paddingHorizontal: size.screenPadding,
    gap: space[4],
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    backgroundColor: colors.surface,
  },
  sim: {
    gap: space[3],
  },
  simDivider: {
    paddingBottom: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  simTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  safety: {
    flex: 1,
    justifyContent: 'center',
    gap: space[5],
    paddingTop: space[12],
  },
  safetyButtons: {
    gap: space[3],
  },
});
