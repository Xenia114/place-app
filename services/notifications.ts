import { dismissNotificationAsync } from 'expo-notifications/build/dismissNotificationAsync';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import type { MapMarkerData } from '../types';
import { isWithinProximity } from './proximity';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const currentPermission = await getPermissionsAsync();
  if (currentPermission.granted) return true;
  if (!currentPermission.canAskAgain) return false;

  const requestedPermission = await requestPermissionsAsync();
  return requestedPermission.granted;
}

class ProximityNotificationManager {
  private readonly activeNotifications = new Map<string, string>();
  private readonly markersInRange = new Set<string>();

  async update(
    latitude: number,
    longitude: number,
    markers: MapMarkerData[],
    notificationsEnabled: boolean
  ): Promise<void> {
    const markerIds = new Set(markers.map(marker => marker.id));

    const trackedMarkerIds = new Set([
      ...this.markersInRange,
      ...this.activeNotifications.keys(),
    ]);
    for (const markerId of trackedMarkerIds) {
      if (!markerIds.has(markerId)) await this.leaveMarker(markerId);
    }

    for (const marker of markers) {
      const isInRange = isWithinProximity(latitude, longitude, marker);

      if (!isInRange) {
        if (
          this.markersInRange.has(marker.id) ||
          this.activeNotifications.has(marker.id)
        ) {
          await this.leaveMarker(marker.id);
        }
        continue;
      }

      if (
        this.markersInRange.has(marker.id) ||
        this.activeNotifications.has(marker.id) ||
        !notificationsEnabled
      ) {
        continue;
      }

      this.markersInRange.add(marker.id);

      try {
        const notificationId = await scheduleNotificationAsync({
          content: {
            title: 'Вы рядом с меткой!',
            body: `Поблизости находится место «${marker.name}».`,
          },
          trigger: null,
        });
        this.activeNotifications.set(marker.id, notificationId);
      } catch (cause) {
        this.markersInRange.delete(marker.id);
        throw cause;
      }
    }
  }

  private async leaveMarker(markerId: string): Promise<void> {
    this.markersInRange.delete(markerId);
    const notificationId = this.activeNotifications.get(markerId);
    if (!notificationId) return;

    await dismissNotificationAsync(notificationId);
    this.activeNotifications.delete(markerId);
  }
}

export const proximityNotificationManager = new ProximityNotificationManager();
