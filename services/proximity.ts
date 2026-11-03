import type { MapMarkerData } from '../types';

export const PROXIMITY_THRESHOLD_METERS = 100;

const EARTH_RADIUS_METERS = 6_371_000;

export function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = toRadians(latitude2 - latitude1);
  const longitudeDifference = toRadians(longitude2 - longitude1);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function isWithinProximity(
  latitude: number,
  longitude: number,
  marker: MapMarkerData
): boolean {
  return calculateDistance(
    latitude,
    longitude,
    marker.latitude,
    marker.longitude
  ) <= PROXIMITY_THRESHOLD_METERS;
}
