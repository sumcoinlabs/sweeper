import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {reverseGeocode} from '@inoxialabs/react-native-nitro-location-geocoder';
import type {LocationInfo} from '../types';

export const MAX_SWEEP_ACCURACY_METERS = 50;

Geolocation.setRNConfiguration({
  // Request permission explicitly so the location timeout does not run while
  // the user is still reading the iOS permission sheet.
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto',
});

type NativeGeoError = {
  code?: number;
  message?: string;
};

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve, reject) => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        error => reject(error),
      );
    });
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Sweeper location access',
      message:
        'Sweeper needs precise location while you perform a sweep so the report can be tied to the correct property.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getPosition(): Promise<{
  lat: number;
  lng: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      reject,
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      },
    );
  });
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(() => resolve(), ms));
}

function friendlyLocationError(error: unknown): Error {
  const source = error as NativeGeoError;

  if (source?.code === 1) {
    return new Error(
      'Location access is not available to Sweeper. Enable Location Services and allow location access, then try again.',
    );
  }

  if (source?.code === 2) {
    return new Error(
      'Sweeper could not obtain a usable GPS fix. Move near a window or outdoors briefly and try again.',
    );
  }

  if (source?.code === 3) {
    return new Error(
      'Sweeper could not obtain a precise GPS fix in time. Try again with a clearer view of the sky.',
    );
  }

  return new Error(source?.message || 'Unable to get your current location.');
}

async function getAccuratePosition() {
  let lastError: unknown;

  // A fresh high-accuracy request can occasionally time out immediately after
  // the permission sheet closes. Retry once automatically before showing an
  // error to the user.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const position = await getPosition();

      if (
        Number.isFinite(position.accuracy) &&
        position.accuracy <= MAX_SWEEP_ACCURACY_METERS
      ) {
        return position;
      }

      lastError = new Error(
        `GPS accuracy is about ${Math.round(
          position.accuracy,
        )} m. Sweeper requires ${MAX_SWEEP_ACCURACY_METERS} m accuracy or better before continuing.`,
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt === 0) {
      await wait(1200);
    }
  }

  if (
    lastError instanceof Error &&
    lastError.message.startsWith('GPS accuracy is about')
  ) {
    throw lastError;
  }

  throw friendlyLocationError(lastError);
}

export async function detectLocation(): Promise<LocationInfo> {
  let granted = false;

  try {
    granted = await requestLocationPermission();
  } catch (error) {
    throw friendlyLocationError(error);
  }

  if (!granted) {
    throw new Error(
      'Location permission was not granted. Sweeper cannot start a property sweep without GPS.',
    );
  }

  const position = await getAccuratePosition();

  let locality = '';
  let administrativeArea = '';
  let country = '';

  try {
    const geo = await reverseGeocode(position.lat, position.lng, '');
    locality = geo.locality || geo.subLocality || '';
    administrativeArea = geo.administrativeArea || '';
    country = geo.country || '';
  } catch {
    // Coordinates remain authoritative. Street-level native geocoding is a
    // later property-identification milestone.
  }

  return {
    ...position,
    name: '',
    address: '',
    locality,
    administrativeArea,
    country,
  };
}
