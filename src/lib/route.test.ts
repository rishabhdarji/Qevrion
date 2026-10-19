import { checkKey, fetchRoute, looksLikeKey, parseRoute, problemFor, RouteError } from './route';

// An answer shaped like openrouteservice's foot-walking GeoJSON, with invented numbers.
const from = { lat: 40.7484, lng: -73.9857 };
const to = { lat: 40.7536, lng: -73.9832 };
const answer = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-73.9857, 40.7484],
          [-73.9846, 40.7499],
          [-73.9839, 40.7509],
          [-73.9832, 40.7536],
        ],
      },
      properties: {
        segments: [
          {
            distance: 640.2,
            duration: 461,
            steps: [
              { distance: 300.1, duration: 216, type: 11, instruction: 'Head north on 5th Avenue', way_points: [0, 2] },
              { distance: 340.1, duration: 245, type: 1, instruction: 'Turn right onto West 42nd Street', way_points: [2, 3] },
              { distance: 0, duration: 0, type: 10, instruction: 'Arrive at West 42nd Street', way_points: [3, 3] },
            ],
          },
        ],
        summary: { distance: 640.2, duration: 461 },
      },
    },
  ],
};

const respond = (status: number, body: unknown) =>
  jest.fn(async () => ({ ok: status < 300, status, json: async () => body }) as unknown as Response);

describe('parseRoute', () => {
  it('reads the line, the totals and each turn', () => {
    const route = parseRoute(answer, from, to, 123);
    expect(route.line).toHaveLength(4);
    expect(route.line[0]).toEqual(from);
    expect(route.line[3]).toEqual(to);
    expect(route).toMatchObject({ from, to, distance: 640.2, duration: 461, fetchedAt: 123 });
    expect(route.steps.map((s) => [s.instruction, s.start])).toEqual([
      ['Head north on 5th Avenue', 0],
      ['Turn right onto West 42nd Street', 2],
      ['Arrive at West 42nd Street', 3],
    ]);
  });

  it('treats anything not shaped like a route as no route, never a crash', () => {
    for (const body of [null, {}, { features: [] }, { features: [{ geometry: { coordinates: 'x' } }] }]) {
      expect(() => parseRoute(body, from, to, 0)).toThrow(RouteError);
    }
    const offMap = { features: [{ geometry: { coordinates: [[0, 0], [0, 99]] } }] };
    expect(() => parseRoute(offMap, from, to, 0)).toThrow(RouteError);
  });

  it('copes with an empty summary and steps that point off the line', () => {
    const odd = {
      features: [
        {
          geometry: { coordinates: [[-73.9857, 40.7484], [-73.9857, 40.7484]] },
          properties: { summary: {}, segments: [{ steps: [{ way_points: [9, 9] }, { way_points: [0, 1] }] }] },
        },
      ],
    };
    const route = parseRoute(odd, from, from, 0);
    expect(route).toMatchObject({ distance: 0, duration: 0 });
    expect(route.steps).toEqual([{ instruction: '', distance: 0, duration: 0, start: 0 }]);
  });
});

describe('problemFor', () => {
  it('names what went wrong', () => {
    expect(problemFor(401, null)).toBe('badKey');
    expect(problemFor(403, { error: 'Access to this API has been disallowed' })).toBe('badKey');
    expect(problemFor(429, null)).toBe('quota');
    expect(problemFor(404, { error: { code: 2010, message: 'Could not find routable point' } })).toBe('noRoute');
    expect(problemFor(400, { error: { code: 2004, message: 'Distance limit exceeded' } })).toBe('tooFar');
    expect(problemFor(500, null)).toBe('failed');
  });
});

describe('fetchRoute', () => {
  it('sends the two points, longitude first, with the key in a header and nowhere else', async () => {
    const fetcher = respond(200, answer);
    await fetchRoute(from, to, 'my-key', { fetcher, now: 5 });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openrouteservice.org/v2/directions/foot-walking/geojson');
    expect(url).not.toContain('my-key');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('my-key');
    expect(JSON.parse(init.body as string).coordinates).toEqual([
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]);
  });

  it('says offline when there is no connection', async () => {
    const fetcher = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(fetchRoute(from, to, 'k', { fetcher })).rejects.toMatchObject({ problem: 'offline' });
  });

  it('passes on what the service said was wrong', async () => {
    await expect(fetchRoute(from, to, 'k', { fetcher: respond(403, {}) })).rejects.toMatchObject({ problem: 'badKey' });
    await expect(fetchRoute(from, to, 'k', { fetcher: respond(429, {}) })).rejects.toMatchObject({ problem: 'quota' });
  });

  it('gives up after a while rather than waiting for ever', async () => {
    jest.useFakeTimers();
    try {
      const fetcher = jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) =>
            init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
      const asked = fetchRoute(from, to, 'k', { fetcher });
      jest.advanceTimersByTime(12_000);
      await expect(asked).rejects.toMatchObject({ problem: 'offline' });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('the key', () => {
  it('looks like one before anything is sent', () => {
    expect(looksLikeKey('5b3ce3597851110001cf6248a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(true);
    expect(looksLikeKey('eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjEyMyJ9')).toBe(true);
    expect(looksLikeKey('short')).toBe(false);
    expect(looksLikeKey('a key with spaces in it, quite long')).toBe(false);
    expect(looksLikeKey('abcdefghijklmnopqrstuvwxyz\r\nX-Evil: 1')).toBe(false);
  });

  it('is tried with one fixed route that says nothing about the owner', async () => {
    const fetcher = respond(200, answer);
    expect(await checkKey('k', fetcher)).toBe('ok');
    const body = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.coordinates).toEqual([
      [8.681495, 49.41461],
      [8.686507, 49.41943],
    ]);
    expect(await checkKey('k', respond(401, {}))).toBe('badKey');
  });
});
