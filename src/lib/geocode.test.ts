import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { nextPendingAddress, setGeocode } from '../data/events';
import { locateVenues } from './geocode';

// The queue with the geocoder and the store replaced: what matters is what it asks
// for, in what order, and what it writes down.
jest.mock('expo-location', () => ({ geocodeAsync: jest.fn() }));
jest.mock('../data/events', () => ({ nextPendingAddress: jest.fn(), setGeocode: jest.fn() }));

const geocode = jest.mocked(Location.geocodeAsync);
const next = jest.mocked(nextPendingAddress);

const place = (latitude: number, longitude: number) => [{ latitude, longitude }];
const setAppState = (currentState: string) => Object.assign(AppState, { currentState });

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

it('writes down where an address is', async () => {
  waiting('14 Alder Row');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await drain();
  expect(geocode).toHaveBeenCalledWith('14 Alder Row');
  expect(setGeocode).toHaveBeenCalledWith('14 Alder Row', { lat: 51.5, lng: -0.12 });
});

it('writes down that an address was not found when the answer is empty', async () => {
  waiting('Nowhere at all');
  geocode.mockResolvedValue([]);
  locateVenues();
  await drain();
  expect(setGeocode).toHaveBeenCalledWith('Nowhere at all', null);
});

it('stops at an error and writes nothing, so the address is tried again next time', async () => {
  waiting('14 Alder Row', '9 Birch Lane');
  geocode.mockRejectedValue(new Error('offline'));
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

it('does nothing while the app is not on screen, and stops when it leaves', async () => {
  setAppState('background');
  waiting('14 Alder Row');
  locateVenues();
  await drain();
  expect(next).not.toHaveBeenCalled();

  setAppState('active');
  waiting('14 Alder Row', '9 Birch Lane');
  geocode.mockResolvedValue(place(51.5, -0.12));
  locateVenues();
  await jest.advanceTimersByTimeAsync(0);
  expect(geocode).toHaveBeenCalledTimes(1);
  setAppState('inactive');
  await drain();
  expect(geocode).toHaveBeenCalledTimes(1);
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
