import { mapRegion, project } from './mapRegion';

describe('mapRegion', () => {
  it('centres on the points with room around them', () => {
    const region = mapRegion([
      { lat: 40.75, lng: -73.99 },
      { lat: 40.76, lng: -73.97 },
    ]);
    expect(region.latitude).toBeCloseTo(40.755, 6);
    expect(region.longitude).toBeCloseTo(-73.98, 6);
    expect(region.latitudeDelta).toBeCloseTo(0.016, 6);
    expect(region.longitudeDelta).toBeCloseTo(0.032, 6);
  });

  it('never shows less than a few hundred metres, even for one point', () => {
    const region = mapRegion([{ lat: 51.5, lng: -0.12 }]);
    expect(region.latitudeDelta).toBe(0.004);
    expect(region.longitudeDelta).toBe(0.004);
  });
});

describe('project', () => {
  it('puts north at the top and keeps every point inside the box', () => {
    const [south, north] = project(
      [
        { lat: 40.75, lng: -73.98 },
        { lat: 40.76, lng: -73.98 },
      ],
      340,
      255,
      24,
    );
    expect(north.y).toBeLessThan(south.y);
    for (const p of [south, north]) {
      expect(p.x).toBeGreaterThanOrEqual(24);
      expect(p.x).toBeLessThanOrEqual(316);
      expect(p.y).toBeGreaterThanOrEqual(24);
      expect(p.y).toBeLessThanOrEqual(231);
    }
  });
});
