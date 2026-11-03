import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDatabase } from '../../context/DatabaseContext';
import type { MarkerImage, MarkerNavigationParams } from '../../types';

export default function MarkerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<MarkerNavigationParams>();
  
  const {
    places,
    addImage,
    removeImage,
    removePlace,
    updatePlaceName,
    isLoading,
    error,
  } = useDatabase();
  
  const [isPickingImage, setIsPickingImage] = useState(false);
  const place = places.find(item => item.id === id);

  const [nameDraft, setNameDraft] = useState<{ placeId: string; value: string } | null>(null);
  const editName = nameDraft && nameDraft.placeId === place?.id
    ? nameDraft.value
    : place?.name ?? '';

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    try {
      await updatePlaceName(id, editName.trim());
      Alert.alert('Успех', 'Название обновлено');
    } catch (cause) {
      Alert.alert(
        'Ошибка',
        cause instanceof Error ? cause.message : 'Не удалось обновить название.'
      );
    }
  };

  const addPlaceImage = async () => {
    if (isPickingImage) return;
    setIsPickingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нет доступа', 'Разрешите доступ к фото.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      
      const asset = result.assets[0];
      const image: MarkerImage = {
        id: `${Date.now()}`,
        uri: asset.uri,
        fileName: asset.fileName,
      };
      await addImage(id, image);
    } catch (cause) {
      Alert.alert(
        'Ошибка',
        cause instanceof Error ? cause.message : 'Не удалось добавить фото.'
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      await removeImage(id, imageId);
    } catch (cause) {
      Alert.alert(
        'Ошибка',
        cause instanceof Error ? cause.message : 'Не удалось удалить фото.'
      );
    }
  };

  const confirmDeletePlace = () => {
    Alert.alert('Удалить метку?', 'Метка и её фото будут удалены.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void removePlace(id).then(() => {
            router.replace('/');
          }).catch(cause => {
            Alert.alert(
              'Ошибка',
              cause instanceof Error ? cause.message : 'Не удалось удалить метку.'
            );
          });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Загрузка базы данных...</Text>
      </View>
    );
  }

  if (!place) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{error?.message ?? 'Место не найдено'}</Text>
        <Link href="/" style={styles.link}>Вернуться к карте</Link>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      <Text style={styles.label}>Название:</Text>
      <View style={styles.editRow}>
        <TextInput
          style={styles.input}
          value={editName}
          onChangeText={value => setNameDraft({ placeId: id, value })}
          placeholder="Введите название"
        />
        <Pressable style={styles.saveBtn} onPress={handleSaveName}>
          <Text style={styles.saveText}>Сохранить</Text>
        </Pressable>
      </View>

      <Text style={styles.coords}>
        Координаты: {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
      </Text>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Фото ({place.images.length})</Text>
        <Pressable style={styles.addBtn} onPress={addPlaceImage}>
          <Text style={styles.addText}>+ Добавить</Text>
        </Pressable>
      </View>

      <View style={styles.imageList}>
        {place.images.map(image => (
          <View key={image.id} style={styles.imageBox}>
            <Image source={{ uri: image.uri }} style={styles.image} />
            <Pressable onPress={() => { void deleteImage(image.id); }}>
              <Text style={styles.deleteText}>Удалить</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Link href="/" style={styles.link}>← Назад к карте</Link>
      
      <Pressable style={styles.deletePlaceBtn} onPress={confirmDeletePlace}>
        <Text style={styles.deletePlaceText}>Удалить это место</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 20, 
    backgroundColor: 'whitesmoke' 
  },
 
  title: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 16, 
    color: 'black' 
  }, 
  
  label: { 
    fontSize: 16, 
    color: 'gray', 
    marginBottom: 6,
    fontWeight: '500'
  },
  
  editRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 20 
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'lightgray',
    borderRadius: 16, 
    paddingHorizontal: 12,
    fontSize: 16,
    color: 'black',
  },
  saveBtn: {
    backgroundColor: 'green', 
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  saveText: { 
    color: 'white', 
    fontWeight: '600',
    fontSize: 16
  },
  
  coords: { 
    fontSize: 16, 
    color: 'gray', 
    marginBottom: 24 
  },
  
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: 'black' 
  },
  addBtn: { 
    backgroundColor: 'lightgray', 
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16 
  },
  addText: { 
    fontWeight: '600', 
    color: 'black',
    fontSize: 16
  },
  

  imageList: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  imageBox: { 
    width: '48%', 
    marginBottom: 12 
  },
  image: { 
    width: '100%', 
    height: 150, 
    borderRadius: 12,
    backgroundColor: 'lightgray' 
  },
  deleteText: { 
    color: 'red', 
    fontSize: 13, 
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500'
  },
  
  // Ссылка "Назад"
  link: { 
    color: 'royalblue', 
    marginTop: 24, 
    fontSize: 16,
    fontWeight: '600'
  },
  
  deletePlaceBtn: {
    marginTop: 40,
    backgroundColor: 'mistyrose', 
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'red',
  },
  deletePlaceText: { 
    color: 'red', 
    fontWeight: 'bold',
    fontSize: 16
  },
});