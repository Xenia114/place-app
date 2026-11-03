import * as SQLite from 'expo-sqlite';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  createMarker,
  createMarkerImage,
  deleteMarker,
  deleteMarkerImage,
  getMarkerImages,
  getMarkers,
  updateMarkerName,
} from '../database/operations';
import { initializeDatabase } from '../database/schema';
import type { MapMarkerData, MarkerImage } from '../types';

interface DatabaseContextValue {
  places: MapMarkerData[];
  addPlace: (latitude: number, longitude: number) => Promise<MapMarkerData>;
  removePlace: (placeId: string) => Promise<boolean>;
  addImage: (placeId: string, image: MarkerImage) => Promise<MarkerImage>;
  removeImage: (placeId: string, imageId: string) => Promise<boolean>;
  updatePlaceName: (id: string, newName: string) => Promise<void>;
  getMarkers: () => Promise<MapMarkerData[]>;
  getMarkerImages: (markerId: string) => Promise<MarkerImage[]>;
  isLoading: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  const databaseRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const [places, setPlaces] = useState<MapMarkerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let database: SQLite.SQLiteDatabase | null = null;

    const openDatabase = async () => {
      try {
        database = await SQLite.openDatabaseAsync('markers.db');
        await initializeDatabase(database);
        const loadedPlaces = await getMarkers(database);

        if (!active) {
          await database.closeAsync();
          return;
        }

        databaseRef.current = database;
        setPlaces(loadedPlaces);
      } catch (cause) {
        const initializationError = asError(cause);
        if (__DEV__) console.error('Ошибка инициализации базы данных:', initializationError);
        if (active) setError(initializationError);
        if (database) {
          try {
            await database.closeAsync();
          } catch (closeError) {
            if (__DEV__) console.error('Ошибка закрытия базы данных:', closeError);
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void openDatabase();

    return () => {
      active = false;
      const currentDatabase = databaseRef.current;
      databaseRef.current = null;
      if (currentDatabase) {
        void currentDatabase.closeAsync().catch(cause => {
          if (__DEV__) console.error('Ошибка закрытия базы данных:', cause);
        });
      }
    };
  }, []);

  const run = useCallback(async <T,>(
    operation: (database: SQLite.SQLiteDatabase) => Promise<T>
  ): Promise<T> => {
    const database = databaseRef.current;
    if (!database) {
      throw error ?? new Error('База данных ещё не готова.');
    }

    try {
      const result = await operation(database);
      setError(null);
      return result;
    } catch (cause) {
      const operationError = asError(cause);
      setError(operationError);
      if (__DEV__) console.error('Ошибка операции с базой данных:', operationError);
      throw operationError;
    }
  }, [error]);

  const refreshMarkers = useCallback(
    () => run(async database => {
      const loadedPlaces = await getMarkers(database);
      setPlaces(loadedPlaces);
      return loadedPlaces;
    }),
    [run]
  );

  const addPlace = useCallback(
    (latitude: number, longitude: number) => run(async database => {
      const place = await createMarker(database, latitude, longitude);
      setPlaces(currentPlaces => [...currentPlaces, place]);
      return place;
    }),
    [run]
  );

  const removePlace = useCallback(
    (placeId: string) => run(async database => {
      const removed = await deleteMarker(database, placeId);
      if (removed) setPlaces(currentPlaces => currentPlaces.filter(place => place.id !== placeId));
      return removed;
    }),
    [run]
  );

  const addImage = useCallback(
    (placeId: string, image: MarkerImage) => run(async database => {
      const savedImage = await createMarkerImage(database, placeId, image.uri);
      setPlaces(currentPlaces => currentPlaces.map(place =>
        place.id === placeId
          ? { ...place, images: [...place.images, { ...savedImage, fileName: image.fileName }] }
          : place
      ));
      return { ...savedImage, fileName: image.fileName };
    }),
    [run]
  );

  const removeImage = useCallback(
    (placeId: string, imageId: string) => run(async database => {
      const removed = await deleteMarkerImage(database, placeId, imageId);
      if (removed) {
        setPlaces(currentPlaces => currentPlaces.map(place =>
          place.id === placeId
            ? { ...place, images: place.images.filter(image => image.id !== imageId) }
            : place
        ));
      }
      return removed;
    }),
    [run]
  );

  const renamePlace = useCallback(
    async (placeId: string, newName: string) => {
      const updated = await run(database => updateMarkerName(database, placeId, newName));
      if (!updated) throw new Error('Метка не найдена.');
      setPlaces(currentPlaces => currentPlaces.map(place =>
        place.id === placeId ? { ...place, name: newName } : place
      ));
    },
    [run]
  );

  const loadMarkerImages = useCallback(
    (markerId: string) => run(database => getMarkerImages(database, markerId)),
    [run]
  );

  const value = useMemo(
    () => ({
      places,
      addPlace,
      removePlace,
      addImage,
      removeImage,
      updatePlaceName: renamePlace,
      getMarkers: refreshMarkers,
      getMarkerImages: loadMarkerImages,
      isLoading,
      error,
    }),
    [
      places,
      addPlace,
      removePlace,
      addImage,
      removeImage,
      renamePlace,
      refreshMarkers,
      loadMarkerImages,
      isLoading,
      error,
    ]
  );

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}
