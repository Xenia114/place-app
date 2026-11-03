import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { isWithinProximity } from '../services/proximity';
import type { MapMarkerData } from '../types';

interface PlaceMapProps {
  places: MapMarkerData[];
  userLocation: { latitude: number; longitude: number } | null;
  onLongPress: (latitude: number, longitude: number) => void;
  onMarkerPress: (place: MapMarkerData) => void;
  onMapReady: () => void;
}

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    
    .custom-pin {
      background-color: var(--pin-color, gold);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }

    .user-location-pin {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #2563eb;
      border: 3px solid white;
      box-shadow: 0 0 0 7px rgba(37, 99, 235, 0.22);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    if (typeof L === 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
    } else {
      const map = L.map('map', { zoomControl: true }).setView([58.0105, 56.2502], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      
      const markers = L.layerGroup().addTo(map);
      let userLocationMarker = null;
      let centeredOnUser = false;

        const customIcon = L.divIcon({
        className: 'custom-pin-wrapper',
        html: '<div class="custom-pin"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      });

      const nearbyIcon = L.divIcon({
        className: 'custom-pin-wrapper',
        html: '<div class="custom-pin" style="--pin-color: #22c55e"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      });

      const userLocationIcon = L.divIcon({
        className: 'user-location-wrapper',
        html: '<div class="user-location-pin"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      window.setUserLocation = function(location) {
        if (!location) {
          if (userLocationMarker) map.removeLayer(userLocationMarker);
          userLocationMarker = null;
          return;
        }

        const coordinates = [location.latitude, location.longitude];
        if (userLocationMarker) {
          userLocationMarker.setLatLng(coordinates);
        } else {
          userLocationMarker = L.marker(coordinates, {
            icon: userLocationIcon,
            interactive: false
          }).addTo(map);
        }

        if (!centeredOnUser) {
          map.setView(coordinates, 15);
          centeredOnUser = true;
        }
      };

      window.setPlaces = function(places) {
        markers.clearLayers();
        places.forEach(function(place) {
          
          const marker = L.marker([place.latitude, place.longitude], {
            icon: place.isNearby ? nearbyIcon : customIcon
          }).addTo(markers);
          
          const popup = document.createElement('span');
          popup.textContent = String(place.name);
          popup.style.fontWeight = 'bold';
          marker.bindPopup(popup);

          marker.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'markerPress',
              id: place.id
            }));
          });
        });
      };

      map.on('contextmenu', function(event) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'longPress',
          latitude: event.latlng.lat,
          longitude: event.latlng.lng
        }));
      });

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  </script>
</body>
</html>
`;

function serializePlaces(
  places: MapMarkerData[],
  userLocation: PlaceMapProps['userLocation']
) {
  const placesWithProximity = places.map(place => ({
    ...place,
    isNearby: userLocation
      ? isWithinProximity(userLocation.latitude, userLocation.longitude, place)
      : false,
  }));
  return JSON.stringify(placesWithProximity).replace(/</g, '\\u003c');
}

export default function PlaceMap({
  places,
  userLocation,
  onLongPress,
  onMarkerPress,
  onMapReady,
}: PlaceMapProps) {
  const webViewRef = useRef<WebView>(null);
  const placesById = useRef(new Map<string, MapMarkerData>());
  const userLocationRef = useRef(userLocation);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    placesById.current = new Map(places.map(place => [place.id, place]));
    webViewRef.current?.injectJavaScript(
      `window.setPlaces && window.setPlaces(${serializePlaces(places, userLocation)});` +
      `window.setUserLocation && window.setUserLocation(${JSON.stringify(userLocation)}); true;`
    );
  }, [places, userLocation]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let message: unknown;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch (error) {
      console.error('Не удалось прочитать ответ карты:', error);
      return;
    }

    if (typeof message !== 'object' || message === null || !('type' in message)) {
      return;
    }

    if (message.type === 'ready') {
      webViewRef.current?.injectJavaScript(
        `window.setPlaces(${serializePlaces(placesById.current.size
          ? Array.from(placesById.current.values())
          : [], userLocationRef.current)});` +
        `window.setUserLocation(${JSON.stringify(userLocationRef.current)}); true;`
      );
      onMapReady();
    } else if (
      message.type === 'longPress' &&
      'latitude' in message &&
      'longitude' in message &&
      typeof message.latitude === 'number' &&
      typeof message.longitude === 'number'
    ) {
      onLongPress(message.latitude, message.longitude);
    } else if (
      message.type === 'markerPress' &&
      'id' in message &&
      typeof message.id === 'string'
    ) {
      const place = placesById.current.get(message.id);
      if (place) onMarkerPress(place);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});