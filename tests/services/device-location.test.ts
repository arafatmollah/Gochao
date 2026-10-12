import {
  detectDeviceLocation,
  type LocationProvider,
} from '@/services/device-location';

function makeProvider(overrides: Partial<LocationProvider> = {}): LocationProvider {
  return {
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 23.8103, longitude: 90.4125 },
    }),
    reverseGeocodeAsync: async () => [
      { city: 'Dhaka', district: null, subregion: null, region: 'Dhaka Division' },
    ],
    ...overrides,
  };
}

describe('detectDeviceLocation', () => {
  it('returns coordinates with the reverse-geocoded city', async () => {
    const result = await detectDeviceLocation(makeProvider());

    expect(result).toEqual({
      ok: true,
      location: { latitude: 23.8103, longitude: 90.4125, cityLabel: 'Dhaka' },
    });
  });

  it('falls back through district and region when city is missing', async () => {
    const byDistrict = await detectDeviceLocation(
      makeProvider({
        reverseGeocodeAsync: async () => [
          { city: null, district: 'Savar', subregion: null, region: null },
        ],
      }),
    );
    expect(byDistrict).toEqual({
      ok: true,
      location: { latitude: 23.8103, longitude: 90.4125, cityLabel: 'Savar' },
    });

    const none = await detectDeviceLocation(
      makeProvider({ reverseGeocodeAsync: async () => [] }),
    );
    expect(none).toEqual({
      ok: true,
      location: { latitude: 23.8103, longitude: 90.4125, cityLabel: null },
    });
  });

  it('keeps coordinates when reverse geocoding fails (offline)', async () => {
    const result = await detectDeviceLocation(
      makeProvider({
        reverseGeocodeAsync: async () => {
          throw new Error('network');
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      location: { latitude: 23.8103, longitude: 90.4125, cityLabel: null },
    });
  });

  it('reports denied when permission is not granted', async () => {
    const result = await detectDeviceLocation(
      makeProvider({
        requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
      }),
    );

    expect(result).toEqual({ ok: false, reason: 'denied' });
  });

  it('reports unavailable when permission, fix, or coordinates fail', async () => {
    const permissionThrows = await detectDeviceLocation(
      makeProvider({
        requestForegroundPermissionsAsync: async () => {
          throw new Error('boom');
        },
      }),
    );
    expect(permissionThrows).toEqual({ ok: false, reason: 'unavailable' });

    const fixThrows = await detectDeviceLocation(
      makeProvider({
        getCurrentPositionAsync: async () => {
          throw new Error('no fix');
        },
      }),
    );
    expect(fixThrows).toEqual({ ok: false, reason: 'unavailable' });

    const badCoords = await detectDeviceLocation(
      makeProvider({
        getCurrentPositionAsync: async () => ({
          coords: { latitude: Number.NaN, longitude: 90.4125 },
        }),
      }),
    );
    expect(badCoords).toEqual({ ok: false, reason: 'unavailable' });
  });
});
