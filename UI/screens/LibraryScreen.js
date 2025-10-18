import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, SafeAreaView, StyleSheet, useColorScheme, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker'; 
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import useAppStore from '../store/UseAppStore'; 

import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';

const SERVER_IP = '192.168.1.30';
const SERVER_PORT = '5002';
const ENDPOINT = '/generate-audiobook/';
const SERVER_URL = `http://${SERVER_IP}:${SERVER_PORT}${ENDPOINT}`;

// Varsayılan konuşma hızı (Backend'deki DEFAULT_SPEED ile eşleşmeli)
const DEFAULT_SPEED = 0.8;

// Adını LibraryScreen olarak tutuyorum, ancak içeriği bir önceki yanıttaki gibi düzenledim.
const LibraryScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';
  const [isUploading, setIsUploading] = useState(false);

  // Zustand Store'dan aksiyonu çek
  const addAudiobook = useAppStore(state => state.addAudiobook);

  const libraryBooks = useAppStore(state => state.audiobooks);

  const handleFileUpload = async () => {
    const allowedTypes = ['application/pdf', 'application/epub+zip']; 

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log("Dosya seçimi iptal edildi.");
        return;
      }
      
      const file = result.assets[0];
      setIsUploading(true);

      const baseFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
      formData.append('speed', DEFAULT_SPEED.toString());

      const response = await axios.post(
        SERVER_URL, 
        formData, 
        {
          responseType: 'blob', 
          headers: {
            'Accept': 'audio/mpeg',
          },
          timeout: 300000,
        }
      );

      if (response.status === 200 && response.data) {
        const audioBlob = response.data;
        // Dosya adı, uzantı olmadan dosya sisteminde benzersiz olmalıdır
        const filename = `${Date.now()}_${baseFileName}_FULL_BOOK.mp3`; 
        const localUri = FileSystem.cacheDirectory + filename;

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64Audio = reader.result.split(',')[1];
            await FileSystem.writeAsStringAsync(localUri, base64Audio, { encoding: FileSystem.EncodingType.Base64 });

            const uniqueId = Date.now().toString(); 
            const newBook = {
              id: uniqueId,
              title: baseFileName, 
              author: 'AI Narrator', 
              imageUrl: 'https://picsum.photos/id/' + (Math.floor(Math.random() * 100) + 10) + '/150/200',
              audioPath: localUri, 
            };

            addAudiobook(newBook);
            Alert.alert("Başarılı", `${newBook.title} sesli kitap olarak eklendi!`);
          } catch (e) {
            console.error("Yerel Dosya Kayıt Hatası:", e);
            Alert.alert("Hata", "Sesli kitap oluşturuldu ancak cihaza kaydedilemedi.");
          }
        };
      } else {
        const errorText = await response.data.text();
        throw new Error(`Sunucu Hatası: ${response.status}. Detay: ${errorText}`);
      }

    } catch (err) {
      if (axios.isCancel(err) || DocumentPicker.isCancel(err)) {
        console.log("İşlem iptal edildi.");
      } else {
        console.error("Yükleme veya Ağ Hatası:", err);
        Alert.alert("Hata", `Dosya yüklenirken bir sorun oluştu: ${err.message || "Bilinmeyen Hata"}`);
      }
    } finally {
      setIsUploading(false);
    }
  };


  const styles = StyleSheet.create({
    uploadContainer: {
      alignItems: 'center',
      gap: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: isDark ? Colors.slate700 : Colors.slate300,
      paddingHorizontal: 24,
      paddingVertical: 24, 
      textAlign: 'center',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16, 
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 8,
      backgroundColor: isUploading ? Colors.slate500 : Colors.primary, 
      paddingHorizontal: 20,
      paddingVertical: 10,
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    bookCard: {
      flexDirection: 'column',
      gap: 12,
      width: 160,
      marginRight: 16, 
    },
    bookImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 8,
      backgroundColor: Colors.slate500, 
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    mainContent: {
      flexGrow: 1,
      paddingBottom: 16,
      marginTop: 12,
    },
    sectionTitle: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 8,
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? 'white' : Colors.slate900,
    },
  });


  return (
    <SafeAreaView style={themeStyles.container}>
      <ScrollView contentContainerStyle={styles.mainContent}>
        {/* YÜKLEME BÖLÜMÜ */}
        <View style={styles.uploadContainer}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? 'white' : Colors.slate900 }}>Upload a new file</Text>
            <Text style={{ fontSize: 14, color: isDark ? Colors.slate400 : Colors.slate600 }}>Supported formats: PDF, EPUB</Text>
          </View>
          <TouchableOpacity 
            style={styles.uploadButton} 
            onPress={isUploading ? null : handleFileUpload} 
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="white" />
            ) : (
              <MaterialIcons name="cloud-upload" size={16} color="white" />
            )}
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>
              {isUploading ? "Uploading..." : "Upload"}
            </Text>
          </TouchableOpacity>
        </View>


        <Text style={styles.sectionTitle}>Recently Added</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {libraryBooks.map((book) => (
            <TouchableOpacity 
              key={book.id} 
              style={styles.bookCard} 
              // ✅ GÜNCELLEME: Kitap verisini AudioBookPlayer'a gönderiyoruz
              onPress={() => navigation.navigate('AudioBookPlayer', { bookData: book })}
            >
              <Image source={{ uri: book.imageUrl }} style={styles.bookImage} />
              <View>
                <Text numberOfLines={1} style={{ fontWeight: '500', color: isDark ? Colors.slate100 : Colors.slate800 }}>{book.title}</Text>
                <Text style={{ fontSize: 12, color: isDark ? Colors.slate400 : Colors.slate500 }}>{book.author}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>
      <BottomTabBar navigation={navigation} currentRouteName="LibraryStack" />
    </SafeAreaView>
  );
};

export default LibraryScreen;
