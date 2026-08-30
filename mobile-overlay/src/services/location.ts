import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {reverseGeocode} from '@inoxialabs/react-native-nitro-location-geocoder';
import type {LocationInfo} from '../types';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // getCurrentPosition triggers the native iOS permission prompt.
    // Do not pass "whenInUse" to requestAuthorization; that API is callback-based.
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Sweeper location access',
      message: 'Sweeper uses your location to tag the property being swept.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getPosition(): Promise<{lat: number; lng: number; accuracy?: number}> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      reject,
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  });
}

function friendlyLocationError(error: unknown): Error {
  const source = error as {code?: number; message?: string};

  if (source?.code === 1) {
    return new Error('Location permission is turned off for Sweeper. Allow location access and try again.');
  }

  if (source?.code === 2) {
    return new Error('A location could not be determined. In the iOS Simulator, choose Features → Location and select a test location.');
  }

  if (source?.code === 3) {
    return new Error('The location request timed out. Try again, or set a test location if you are using the iOS Simulator.');
  }

  return new Error(source?.message || 'Unable to get your current location.');
}

export async function detectLocation(): Promise<LocationInfo> {
  const granted = await requestLocationPermission();
  if (!granted) throw new Error('Location permission was not granted.');

  let position: {lat: number; lng: number; accuracy?: number};
  try {
    position = await getPosition();
  } catch (error) {
    throw friendlyLocationError(error);
  }

  let locality = '';
  let administrativeArea = '';
  let country = '';

  try {
    const geo = await reverseGeocode(position.lat, position.lng, '');
    locality = geo.locality || geo.subLocality || '';
    administrativeArea = geo.administrativeArea || '';
    country = geo.country || '';
  } catch {
    // GPS is enough for the sweep. Reverse geocoding is only a convenience.
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
