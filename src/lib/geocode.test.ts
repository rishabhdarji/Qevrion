import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { nextPendingAddress, setGeocode, showLocations } from '../data/events';
import { locateVenues } from './geocode';

// The queue with the geocoder and the store replaced: what matters is what it asks
// for, in what order, and what it writes down.
jest.mock('expo-location', () => ({ geocodeAsync: jest.fn() }));
jest.mock('../data/events', () => ({
  nextPendingAddress: jest.fn(),
  setGeocode: jest.fn(),
  showLocations: jest.fn(),
}));

const geocode = jest.mocked(Location.geocodeAsync);
const next = jest.mocked(nextPendingAddress);

const place = (latitude: number, longitude: number) => [{ latitude, longitude }];
const setAppState = (currentState: string) => Object.assign(AppState, { currentState });
/** An error as expo-location throws it, with its code. */
const failure = (code: string) => Object.assign(new Error(code), { code });

/** Addresses waiting to be looked up, handed out one at a time. */
function waiting(...addresses: string[]) {
  next.mockImplementation(() => addresses.shift() ?? null);
}

/** Lets the queue run on through its pauses until it has nothing left to do. */
const drain = () => jest.runAllTimersAsync();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  setAppState('active');
});

afterEach(async () => {
  // Whatever a test left running ends here, so the next one starts with no queue.
  waiting();
  await drain();
  jest.useRealTimers();
});

it('writes down where an address is, and shows it', async () => {
  waiting('14 Alder Row');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await drain();
  expect(geocode).toHaveBeenCalledWith('14 Alder Row');
  expect(setGeocode).toHaveBeenCalledWith('14 Alder Row', { lat: 51.5, lng: -0.12 });
  expect(showLocations).toHaveBeenCalledTimes(1);
});

it('writes down that an address was not found when the answer is empty', async () => {
  waiting('Nowhere at all');
  geocode.mockResolvedValue([]);
  locateVenues();
  await drain();
  expect(setGeocode).toHaveBeenCalledWith('Nowhere at all', null);
});

it('never sends a place that holds a link, and goes on to the next', async () => {
  waiting('https://meet.example.com/abc?pwd=123', 'Room 2, zoommtg://example.com/join', '14 Alder Row');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await drain();
  expect(geocode.mock.calls).toEqual([['14 Alder Row']]);
  expect(setGeocode).toHaveBeenCalledWith('https://meet.example.com/abc?pwd=123', null);
  expect(setGeocode).toHaveBeenCalledWith('Room 2, zoommtg://example.com/join', null);
});

it('stops at a network failure and writes nothing, so the address is tried again next time', async () => {
  waiting('14 Alder Row', '9 Birch Lane');
  geocode.mockRejectedValue(failure('ERR_GEOCODING_NETWORK'));
  locateVenues();
  await drain();
  expect(geocode).toHaveBeenCalledTimes(1);
  expect(setGeocode).not.toHaveBeenCalled();

  // And it can start again later.
  waiting('14 Alder Row');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await drain();
  expect(setGeocode).toHaveBeenCalledWith('14 Alder Row', { lat: 51.5, lng: -0.12 });
});

it('counts an address the geocoder fails on in any other way as not found, and goes on', async () => {
  waiting('A strange address', '9 Birch Lane');
  geocode.mockRejectedValueOnce(failure('ERR_GEOCODING_FAILED')).mockResolvedValue(place(1, 2));
  locateVenues();
  await drain();
  expect(setGeocode).toHaveBeenCalledWith('A strange address', null);
  expect(setGeocode).toHaveBeenCalledWith('9 Birch Lane', { lat: 1, lng: 2 });
});

it('does nothing while the app is in the background, and stops when it goes there', async () => {
  setAppState('background');
  waiting('14 Alder Row');
  locateVenues();
  await drain();
  expect(next).not.toHaveBeenCalled();

  // A system box only makes the app inactive for a moment, which is no reason to stop.
  setAppState('inactive');
  waiting('14 Alder Row', '9 Birch Lane', '3 Elm Court');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await jest.advanceTimersByTimeAsync(2000);
  expect(geocode).toHaveBeenCalledTimes(2);
  setAppState('background');
  await drain();
  expect(geocode).toHaveBeenCalledTimes(2);
  expect(showLocations).toHaveBeenCalledTimes(1);
});

it('asks one address at a time, with a pause between them, however often it is started', async () => {
  waiting('14 Alder Row', '9 Birch Lane');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  locateVenues();
  await jest.advanceTimersByTimeAsync(0);
  locateVenues();
  expect(geocode).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1000);
  expect(geocode).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1000);
  expect(geocode).toHaveBeenCalledTimes(2);
  expect(geocode).toHaveBeenLastCalledWith('9 Birch Lane');
});

it('redraws the screens every five answers and once more when it stops, not on each one', async () => {
  waiting(...['1', '2', '3', '4', '5', '6', '7'].map((n) => `${n} Alder Row`));
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await drain();
  expect(setGeocode).toHaveBeenCalledTimes(7);
  expect(showLocations).toHaveBeenCalledTimes(2);
});
