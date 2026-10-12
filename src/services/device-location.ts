import * as Location from 'expo-location';

/**
 * One-shot device location for prayer settings.
 *
 * Flow: foreground permission -> GPS fix (balanced accuracy: fast and
 * battery-friendly) -> best-effort reverse geocode for a place name.
 * Reverse geocoding needs network and is unsupported on web, so a missing
 * place name is normal — coordinates are the source of truth for prayer
 * times, the label is display-only.
 *
 * The provider is injectable so tests never touch native modules. Results
 * use a discriminated union (not `AppError`) because these are device
 * capability failures, not record validation or storage failures.
 */

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  /** Best available label (city, district, region), or null offline. */
  cityLabel: string | null;
}

export type LocationFailureReason = 'denied' | 'unavailable';

export type DetectLocationResult =
  | { ok: true; location: DetectedLocation }
  | { ok: false; reason: LocationFailureReason };

/** Minimal surface of `expo-location` used here (mirrors its real types). */
export interface LocationProvider {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  getCurrentPositionAsync(options?: {
    accuracy?: number;
  }): Promise<{ coords: { latitude: number; longitude: number } }>;
  reverseGeocodeAsync(location: {
    latitude: number;
    longitude: number;
  }): Promise<
    { city: string | null; district: string | null; subregion: string | null; region: string | null }[]
  >;
}

function isUsableCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function detectDeviceLocation(
  provider: LocationProvider = Location as unknown as LocationProvider,
): Promise<DetectLocationResult> {
  let permission: { status: string };
  try {
    permission = await provider.requestForegroundPermissionsAsync();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (permission.status !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  let coords: { latitude: number; longitude: number };
  try {
    const position = await provider.getCurrentPositionAsync({});
    coords = position.coords;
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!isUsableCoordinate(coords.latitude) || !isUsableCoordinate(coords.longitude)) {
    return { ok: false, reason: 'unavailable' };
  }

  let cityLabel: string | null = null;
  try {
    const [address] = await provider.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const label = address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? null;
    cityLabel = label && label.trim() !== '' ? label.trim() : null;
  } catch {
    // Offline or unsupported platform (web): coordinates still stand.
    cityLabel = null;
  }

  return { ok: true, location: { latitude: coords.latitude, longitude: coords.longitude, cityLabel } };
}
