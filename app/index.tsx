import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PlaceMap from '../components/PlaceMap';
import { useDatabase } from '../context/DatabaseContext';
import { useLocationTracking } from '../hooks/useLocationTracking';
import type { MapMarkerData } from '../types';

export default function MapScreen() {
  const router = useRouter();
  const { places, addPlace, removePlace, isLoading, error } = useDatabase();
  const { location, locationError, notificationError } = useLocationTracking(places);

  const [mapReady, setMapReady] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);

  const openPlace = (place: MapMarkerData) => {
    router.push({ pathname: '/marker/[id]', params: { id: place.id } });
  };

  const handleAddPlace = async (latitude: number, longitude: number) => {
    try {
      await addPlace(latitude, longitude);
    } catch (cause) {
      Alert.alert(
        'Ошибка',
        cause instanceof Error ? cause.message : 'Не удалось сохранить метку.'
      );
    }
  };

  const confirmDeletePlace = (place: MapMarkerData) => {
    Alert.alert('Удалить метку?', `«${place.name}» будет удалена.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void removePlace(place.id).catch(cause => {
            Alert.alert(
              'Ошибка',
              cause instanceof Error ? cause.message : 'Не удалось удалить метку.'
            );
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <PlaceMap
        places={places}
        userLocation={location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        } : null}
        onLongPress={(lat, lon) => {
          if (!isLoading) void handleAddPlace(lat, lon);
        }}
        onMarkerPress={openPlace}
        onMapReady={() => setMapReady(true)}
      />

      {(!mapReady || isLoading) && (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>
            {isLoading ? 'Загрузка базы данных...' : 'Загрузка карты...'}
          </Text>
        </View>
      )}

      <View style={styles.topPanel}>
        <Pressable 
          style={styles.header} 
          onPress={() => setIsListOpen(!isListOpen)}
        >
          <Text style={styles.title}>Мои места ({places.length})</Text>
          <Text style={styles.arrow}>{isListOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error.message}</Text>}
        {locationError && <Text style={styles.error}>{locationError}</Text>}
        {notificationError && <Text style={styles.error}>{notificationError}</Text>}
        {location && (
          <Text style={styles.location}>
            Вы на карте · точность около {Math.round(location.coords.accuracy ?? 0)} м
          </Text>
        )}

        {isListOpen && (
          <ScrollView style={styles.list} nestedScrollEnabled>
            {places.length === 0 ? (
              <Text style={styles.empty}>Пока нет мест. Удерживайте карту.</Text>
            ) : (
              places.map((place) => (
                <View key={place.id} style={styles.item}>
                  <Pressable style={styles.info} onPress={() => openPlace(place)}>
                    <Text style={styles.name}>{place.name}</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDeletePlace(place)}>
                    <Text style={styles.delete}>Удалить</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  loading: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  loadingText: { 
    marginLeft: 8, 
    color: 'grey' 
  },
  error: {
    color: 'red',
    marginTop: 10,
  },
  location: {
    color: '#2563eb',
    fontSize: 12,
    marginTop: 8,
  },
  
  // Красивая верхняя панель
  topPanel: {
    position: 'absolute',
    top: 60,     
    left: 90,    
    right: 90,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    maxHeight: '50%',
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: 'dark-grey'   
  },
  arrow: { 
    fontSize: 14, 
    color: 'blue'  
  },
  
  list: { 
    marginTop: 12 
  },
  empty: { 
    color: 'grey',  
    fontSize: 14, 
    paddingVertical: 10,
    textAlign: 'center'
  },
  
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'white', 
  },
  info: { 
    flex: 1 
  },
  name: { 
    fontSize: 16, 
    color: 'black',
    fontWeight: '500'
  },
  delete: { 
    color: 'red', 
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10
  },
});