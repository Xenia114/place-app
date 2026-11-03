import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapMarkerData } from '../types';
import {
  proximityNotificationManager,
  requestNotificationPermission,
} from '../services/notifications';

const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 5000,
  distanceInterval: 5,
};

interface NotificationSetup {
  enabled: boolean;
  error: string | null;
}

function getErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function getNotificationErrorMessage(cause: unknown): string {
  const message = getErrorMessage(cause, '');
  if (/ExpoTopicSubscriptionModule|Cannot find native module/i.test(message)) {
    return 'Локальные уведомления недоступны в текущей сборке Expo Go. Создайте development build командой npx expo run:android.';
  }
  return message || 'Не удалось настроить локальные уведомления.';
}

async function setupNotifications(): Promise<NotificationSetup> {
  try {
    const enabled = await requestNotificationPermission();
    return {
      enabled,
      error: enabled
        ? null
        : 'Разрешение на уведомления не предоставлено. Уведомления о метках отключены.',
    };
  } catch (cause) {
    if (__DEV__) console.error('Ошибка настройки уведомлений:', cause);
    return { enabled: false, error: getNotificationErrorMessage(cause) };
  }
}

export function useLocationTracking(markers: MapMarkerData[]) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const markersRef = useRef(markers);
  const notificationsEnabledRef = useRef(false);
  const notificationErrorRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const pendingLocationRef = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const processProximity = useCallback(async (nextLocation: Location.LocationObject) => {
    pendingLocationRef.current = nextLocation;
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (pendingLocationRef.current) {
        const currentLocation = pendingLocationRef.current;
        pendingLocationRef.current = null;
        await proximityNotificationManager.update(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          markersRef.current,
          notificationsEnabledRef.current
        );
        setNotificationError(notificationErrorRef.current);
      }
    } catch (cause) {
      const message = getNotificationErrorMessage(cause);
      setNotificationError(message);
      if (__DEV__) console.error('Ошибка уведомления о метке:', cause);
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let isStarting = false;
    let locationSubscription: Location.LocationSubscription | null = null;

    const stopLocationUpdates = () => {
      locationSubscription?.remove();
      locationSubscription = null;
    };

    const handleLocation = (nextLocation: Location.LocationObject) => {
      if (!mounted || AppState.currentState !== 'active') return;
      setLocationError(null);
      setLocation(nextLocation);
      void processProximity(nextLocation);
    };

    const startLocationUpdates = async () => {
      if (
        !mounted ||
        isStarting ||
        locationSubscription ||
        AppState.currentState !== 'active'
      ) {
        return;
      }

      isStarting = true;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          throw new Error(
            'Разрешите доступ к геолокации, чтобы показывать ваше положение и находить метки поблизости.'
          );
        }

        if (!await Location.hasServicesEnabledAsync()) {
          throw new Error('Включите службы геолокации на устройстве.');
        }

        const notificationSetup = await setupNotifications();
        notificationsEnabledRef.current = notificationSetup.enabled;
        notificationErrorRef.current = notificationSetup.error;
        setNotificationError(notificationSetup.error);

        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted || AppState.currentState !== 'active') return;
        handleLocation(initialLocation);

        locationSubscription = await Location.watchPositionAsync(
          LOCATION_OPTIONS,
          handleLocation,
          cause => {
            if (!mounted || AppState.currentState !== 'active') return;
            const message = getErrorMessage(
              cause,
              'Не удалось получить обновление геопозиции.'
            );
            setLocationError(message);
            if (__DEV__) console.error('Ошибка отслеживания геолокации:', cause);
          }
        );

        if (!mounted || AppState.currentState !== 'active') {
          stopLocationUpdates();
        }
      } catch (cause) {
        const message = getErrorMessage(cause, 'Не удалось определить местоположение.');
        if (mounted) setLocationError(message);
        if (__DEV__) console.error('Ошибка геолокации:', cause);
      } finally {
        isStarting = false;
      }
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void startLocationUpdates();
      } else {
        stopLocationUpdates();
      }
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    void startLocationUpdates();

    return () => {
      mounted = false;
      appStateSubscription.remove();
      stopLocationUpdates();
    };
  }, [processProximity]);

  useEffect(() => {
    if (location) void processProximity(location);
  }, [markers, location, processProximity]);

  return { location, locationError, notificationError };
}
