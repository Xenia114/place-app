import type { SQLiteDatabase } from 'expo-sqlite';
import type { MapMarkerData, MarkerImage } from '../types';

interface MarkerRow {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
}

interface ImageRow {
  id: number;
  marker_id: number;
  uri: string;
}

function toMarkerImage(row: ImageRow): MarkerImage {
  return { id: String(row.id), uri: row.uri };
}

export async function getMarkerImages(
  database: SQLiteDatabase,
  markerId: string
): Promise<MarkerImage[]> {
  const rows = await database.getAllAsync<ImageRow>(
    'SELECT id, marker_id, uri FROM marker_images WHERE marker_id = ? ORDER BY id;',
    Number(markerId)
  );
  return rows.map(toMarkerImage);
}

export async function getMarkers(database: SQLiteDatabase): Promise<MapMarkerData[]> {
  const [markers, images] = await Promise.all([
    database.getAllAsync<MarkerRow>(
      'SELECT id, latitude, longitude, name FROM markers ORDER BY id;'
    ),
    database.getAllAsync<ImageRow>(
      'SELECT id, marker_id, uri FROM marker_images ORDER BY id;'
    ),
  ]);
  const imagesByMarkerId = new Map<number, MarkerImage[]>();

  for (const image of images) {
    const markerImages = imagesByMarkerId.get(image.marker_id) ?? [];
    markerImages.push(toMarkerImage(image));
    imagesByMarkerId.set(image.marker_id, markerImages);
  }

  return markers.map(marker => ({
    id: String(marker.id),
    name: marker.name,
    latitude: marker.latitude,
    longitude: marker.longitude,
    images: imagesByMarkerId.get(marker.id) ?? [],
  }));
}

export async function createMarker(
  database: SQLiteDatabase,
  latitude: number,
  longitude: number
): Promise<MapMarkerData> {
  let marker: MapMarkerData | undefined;

  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'INSERT INTO markers (latitude, longitude, name) VALUES (?, ?, ?);',
      latitude,
      longitude,
      ''
    );
    const name = `Место ${result.lastInsertRowId}`;
    await database.runAsync('UPDATE markers SET name = ? WHERE id = ?;', name, result.lastInsertRowId);
    marker = {
      id: String(result.lastInsertRowId),
      name,
      latitude,
      longitude,
      images: [],
    };
  });

  if (!marker) throw new Error('Не удалось создать метку.');
  return marker;
}

export async function deleteMarker(
  database: SQLiteDatabase,
  markerId: string
): Promise<boolean> {
  const result = await database.runAsync(
    'DELETE FROM markers WHERE id = ?;',
    Number(markerId)
  );
  return result.changes > 0;
}

export async function createMarkerImage(
  database: SQLiteDatabase,
  markerId: string,
  uri: string
): Promise<MarkerImage> {
  const result = await database.runAsync(
    'INSERT INTO marker_images (marker_id, uri) VALUES (?, ?);',
    Number(markerId),
    uri
  );
  return { id: String(result.lastInsertRowId), uri };
}

export async function deleteMarkerImage(
  database: SQLiteDatabase,
  markerId: string,
  imageId: string
): Promise<boolean> {
  const result = await database.runAsync(
    'DELETE FROM marker_images WHERE id = ? AND marker_id = ?;',
    Number(imageId),
    Number(markerId)
  );
  return result.changes > 0;
}

export async function updateMarkerName(
  database: SQLiteDatabase,
  markerId: string,
  name: string
): Promise<boolean> {
  const result = await database.runAsync(
    'UPDATE markers SET name = ? WHERE id = ?;',
    name,
    Number(markerId)
  );
  return result.changes > 0;
}
