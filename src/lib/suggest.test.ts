import {
  fetchSuggestions,
  parseOrs,
  parsePhoton,
  queryFor,
  suggestSource,
  suggestUrl,
  type SuggestError,
} from './suggest';

// Answers shaped like each service's, with invented places.
const photon = {
  type: 'FeatureCollection',
  features: [
    {
      geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] },
      properties: {
        osm_key: 'building',
        housenumber: '350',
        street: '5th Avenue',
        city: 'New York',
        state: 'New York',
        postcode: '10118',
        country: 'United States',
        countrycode: 'US',
        type: 'house',
      },
    },
    {
      geometry: { type: 'Point', coordinates: [-73.9851, 40.7486] },
      properties: {
        name: 'Corner Bakery',
        housenumber: '352',
        street: '5th Avenue',
        city: 'New York',
        state: 'New York',
        postcode: '10118',
        countrycode: 'US',
        country: 'United States',
      },
    },
    {
      geometry: { type: 'Point', coordinates: [8.6821, 50.1109] },
      properties: { housenumber: '5', street: 'Hauptstraße', city: 'Frankfurt', postcode: '60311', countrycode: 'DE', country: 'Germany' },
    },
    {
      geometry: { type: 'Point', coordinates: [-73.99, 40.74] },
      properties: { name: '5th Avenue', street: '5th Avenue', city: 'New York', countrycode: 'US', country: 'United States', type: 'street' },
    },
    // A repeat of the first, as for a building with two entrances.
    {
      geometry: { type: 'Point', coordinates: [-73.9856, 40.7485] },
      properties: { housenumber: '350', street: '5th Avenue', city: 'New York', state: 'New York', postcode: '10118', countrycode: 'US' },
    },
    { geometry: { coordinates: [0, 999] }, properties: { name: 'Off the map' } },
    { geometry: { coordinates: [1, 1] }, properties: {} },
  ],
};

const ors = {
  features: [
    {
      geometry: { coordinates: [-73.9857, 40.7484] },
      properties: { layer: 'address', name: '350 5th Avenue', label: '350 5th Avenue, New York, NY, USA' },
    },
    {
      geometry: { coordinates: [-73.9851, 40.7486] },
      properties: { layer: 'venue', name: 'Corner Bakery', label: 'Corner Bakery, New York, NY, USA' },
    },
    { geometry: { coordinates: [-73.98, 40.75] }, properties: { name: 'No label' } },
  ],
};

describe('queryFor', () => {
  it('sends only something worth sending', () => {
    expect(queryFor('  350   5th ')).toBe('350 5th');
    expect(queryFor('35')).toBeNull();
    expect(queryFor('https://zoom.us/j/123?pwd=secret')).toBeNull();
    expect(queryFor('x'.repeat(201))).toBeNull();
  });
});

describe('parsePhoton', () => {
  const list = parsePhoton(photon, 'US');

  it('writes each address out with the number where that country puts it', () => {
    expect(list[0]).toEqual({
      title: '350 5th Avenue',
      detail: 'New York, New York 10118',
      full: '350 5th Avenue, New York, New York 10118',
      lat: 40.7484,
      lng: -73.9857,
    });
    expect(list.find((s) => s.lng === 8.6821)).toMatchObject({
      title: 'Hauptstraße 5',
      full: 'Hauptstraße 5, Frankfurt, 60311, Germany',
    });
  });

  it('puts a place name first, with its address under it', () => {
    expect(list[1]).toMatchObject({
      title: 'Corner Bakery',
      detail: '352 5th Avenue, New York, New York 10118',
      full: 'Corner Bakery, 352 5th Avenue, New York, New York 10118',
    });
  });

  it('shows a street on its own, and drops repeats and anything off the map or nameless', () => {
    expect(list.map((s) => s.title)).toEqual(['350 5th Avenue', 'Corner Bakery', 'Hauptstraße 5', '5th Avenue']);
  });

  it('names the country only when it is not the phone’s own', () => {
    expect(parsePhoton(photon, 'GB')[0].full).toBe('350 5th Avenue, New York, New York 10118, United States');
  });

  it('copes with an answer that is not one', () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({ features: 'no' })).toEqual([]);
  });
});

describe('parseOrs', () => {
  it('uses the line openrouteservice writes, split into name and the rest', () => {
    expect(parseOrs(ors)).toEqual([
      { title: '350 5th Avenue', detail: 'New York, NY, USA', full: '350 5th Avenue, New York, NY, USA', lat: 40.7484, lng: -73.9857 },
      { title: 'Corner Bakery', detail: 'New York, NY, USA', full: 'Corner Bakery, New York, NY, USA', lat: 40.7486, lng: -73.9851 },
    ]);
  });
});

describe('suggestUrl', () => {
  it('ranks nearby first when it knows roughly where you are, and rounds that', () => {
    const near = { lat: 40.748412, lng: -73.985664 };
    expect(suggestUrl('photon', '350 5th', near)).toBe(
      'https://photon.komoot.io/api/?q=350+5th&limit=8&lang=en&lat=40.748&lon=-73.986',
    );
    expect(suggestUrl('openrouteservice', '350 5th', near)).toBe(
      'https://api.openrouteservice.org/geocode/autocomplete?text=350+5th&size=8&focus.point.lat=40.748&focus.point.lon=-73.986',
    );
  });

  it('still works without a location', () => {
    expect(suggestUrl('photon', '350 5th')).toBe('https://photon.komoot.io/api/?q=350+5th&limit=8&lang=en');
  });
});

describe('fetchSuggestions', () => {
  const answering = (status: number, body: unknown) =>
    jest.fn(async () => ({ ok: status < 300, status, json: async () => body }) as unknown as Response);

  it('asks Photon with no key and reads its answer', async () => {
    const fetcher = answering(200, photon);
    const list = await fetchSuggestions('photon', '350 5th', { fetcher, homeCountry: 'US' });
    expect(list[0].title).toBe('350 5th Avenue');
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends the key to openrouteservice in a header, never in the address', async () => {
    const fetcher = answering(200, ors);
    await fetchSuggestions('openrouteservice', '350 5th', { fetcher, key: 'secret-key' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('secret-key');
    expect((init.headers as Record<string, string>).Authorization).toBe('secret-key');
  });

  it('sends nothing for too few letters, and needs a key for openrouteservice', async () => {
    const fetcher = answering(200, photon);
    expect(await fetchSuggestions('photon', 'ab', { fetcher })).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(fetchSuggestions('openrouteservice', '350 5th', { fetcher })).rejects.toMatchObject({
      problem: 'noKey',
    } satisfies Partial<SuggestError>);
  });

  it('says offline when there is no connection, and names a refused key', async () => {
    const down = jest.fn(async (): Promise<Response> => {
      throw new TypeError('Network request failed');
    });
    await expect(fetchSuggestions('photon', '350 5th', { fetcher: down })).rejects.toMatchObject({ problem: 'offline' });
    await expect(
      fetchSuggestions('openrouteservice', '350 5th', { fetcher: answering(403, {}), key: 'k' }),
    ).rejects.toMatchObject({ problem: 'badKey' });
  });
});

describe('suggestSource', () => {
  it('works with no key at all', () => {
    expect(suggestSource(null)).toBe('photon');
  });
});
