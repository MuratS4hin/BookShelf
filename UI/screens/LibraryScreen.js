import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import useAppStore from '../store/UseAppStore';
import ApiService from '../services/ApiService';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';

const DEFAULT_SPEED = 1.0;

const STAGE_LABELS = {
  queued: 'Queued...',
  extracting: 'Extracting layout & text from document...',
  cleaning: 'DNN removing page numbers, headers & noise...',
  narrating: 'Neural TTS synthesizing audiobook...',
  encoding: 'Encoding final MP3...',
  done: 'Completed!',
};

const LibraryScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';

  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const pollTimerRef = useRef(null);

  const serverUrl = useAppStore((state) => state.serverUrl);
  const addAudiobook = useAppStore((state) => state.addAudiobook);
  const updateAudiobook = useAppStore((state) => state.updateAudiobook);
  const libraryBooks = useAppStore((state) => state.audiobooks);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const pollAudiobookUntilReady = (bookId, initialBookItem) => {
    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const data = await ApiService.getAudiobookStatus(bookId, serverUrl);
          const ab = data.audiobook;
          const bk = data.book;
          if (!ab) return;

          const pct = Math.round(ab.progress || 0);
          const stageLabel = STAGE_LABELS[ab.stage] || `Processing (${ab.status})...`;
          setProgress(pct);
          setStatusMessage(`${stageLabel} (${pct}%)`);

          if (bk?.title || bk?.author) {
            updateAudiobook(initialBookItem.id, {
              title: bk.title || initialBookItem.title,
              author: bk.author && bk.author !== 'Unknown' ? bk.author : initialBookItem.author,
              status: ab.status,
              progress: pct,
            });
          }

          if (ab.status === 'completed') {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            const streamUrl = ApiService.getStreamUrl(bookId, serverUrl);
            const coverUrl =
              ApiService.resolveUrl(bk?.cover_image) || initialBookItem.imageUrl;
            const finalBook = {
              ...initialBookItem,
              bookId,
              title: bk?.title || initialBookItem.title,
              author: bk?.author && bk.author !== 'Unknown' ? bk.author : 'AI Narrator',
              imageUrl: coverUrl,
              audioPath: streamUrl,
              duration: ab.duration,
              status: 'completed',
              progress: 100,
            };
            updateAudiobook(initialBookItem.id, finalBook);
            resolve(finalBook);
          } else if (ab.status === 'failed') {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            updateAudiobook(initialBookItem.id, { status: 'failed', error: ab.error });
            reject(new Error(ab.error || 'Audiobook generation failed'));
          }
        } catch (err) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          reject(err);
        }
      };

      pollTimerRef.current = setInterval(check, 1500);
      check();
    });
  };

  const handleFileUpload = async () => {
    const allowedTypes = ['application/pdf', 'application/epub+zip'];

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setIsUploading(true);
      setProgress(0);
      setStatusMessage('Uploading document to server...');

      const baseFileName =
        file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();

      const uploadRes = await ApiService.uploadBook(file, DEFAULT_SPEED, serverUrl);
      const bookId = uploadRes.book?.id;
      const coverUrl =
        ApiService.resolveUrl(uploadRes.book?.cover_image) ||
        `https://picsum.photos/seed/${bookId || Date.now()}/300/400`;

      const newBookItem = {
        id: String(bookId || Date.now()),
        bookId,
        title: uploadRes.book?.title || baseFileName,
        author:
          uploadRes.book?.author && uploadRes.book?.author !== 'Unknown'
            ? uploadRes.book.author
            : 'AI Narrator',
        fileType: uploadRes.book?.file_type || ext,
        imageUrl: coverUrl,
        audioPath: null,
        status: 'processing',
        progress: 0,
      };

      addAudiobook(newBookItem);
      const finishedBook = await pollAudiobookUntilReady(bookId, newBookItem);

      Alert.alert(
        'Audiobook Ready',
        `"${finishedBook.title}" was cleaned by the DNN and narrated with Neural TTS.`
      );
    } catch (err) {
      console.error('Upload / Generation Error:', err);
      Alert.alert(
        'Error',
        `Could not process book: ${err.message || 'Unknown error'}\n\nServer: ${serverUrl}`
      );
    } finally {
      setIsUploading(false);
      setStatusMessage('');
      setProgress(0);
    }
  };

  const styles = StyleSheet.create({
    uploadContainer: {
      alignItems: 'center',
      gap: 14,
      borderRadius: 10,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: isDark ? Colors.slate700 : Colors.slate300,
      paddingHorizontal: 24,
      paddingVertical: 24,
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
    },
    progressTrack: {
      width: '100%',
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? Colors.slate700 : Colors.slate200,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: Colors.primary,
    },
    bookCard: {
      flexDirection: 'column',
      gap: 10,
      width: 160,
      marginRight: 16,
    },
    bookImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 8,
      backgroundColor: Colors.slate500,
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
    badge: {
      fontSize: 11,
      color: Colors.primary,
      fontWeight: '600',
      marginTop: 2,
    },
  });

  return (
    <SafeAreaView style={themeStyles.container}>
      <ScrollView contentContainerStyle={styles.mainContent}>
        <View style={styles.uploadContainer}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: isDark ? 'white' : Colors.slate900,
              }}
            >
              Import E-Book or PDF
            </Text>
            <Text
              style={{
                fontSize: 13,
                textAlign: 'center',
                color: isDark ? Colors.slate400 : Colors.slate600,
              }}
            >
              DNN strips page numbers, headers & footnotes • Piper Neural TTS narrates
            </Text>
          </View>

          {isUploading && (
            <View style={{ width: '100%', gap: 6 }}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  color: isDark ? Colors.slate300 : Colors.slate600,
                }}
              >
                {statusMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={isUploading ? null : handleFileUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <MaterialIcons name="cloud-upload" size={18} color="white" />
            )}
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>
              {isUploading ? 'Processing...' : 'Select PDF or EPUB'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Recently Added</Text>
        {libraryBooks.length === 0 ? (
          <Text
            style={{
              paddingHorizontal: 16,
              color: isDark ? Colors.slate400 : Colors.slate500,
            }}
          >
            No books imported yet. Upload a PDF or EPUB above to generate an audiobook.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {libraryBooks.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={styles.bookCard}
                onPress={() =>
                  navigation.navigate('AudioBookPlayer', { bookData: book })
                }
              >
                <Image source={{ uri: book.imageUrl }} style={styles.bookImage} />
                <View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontWeight: '600',
                      color: isDark ? Colors.slate100 : Colors.slate800,
                    }}
                  >
                    {book.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      color: isDark ? Colors.slate400 : Colors.slate500,
                    }}
                  >
                    {book.author}
                  </Text>
                  {book.status && book.status !== 'completed' && (
                    <Text style={styles.badge}>
                      {book.status === 'failed'
                        ? 'Failed'
                        : `Processing (${book.progress || 0}%)`}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </ScrollView>
      <BottomTabBar navigation={navigation} currentRouteName="LibraryStack" />
    </SafeAreaView>
  );
};

export default LibraryScreen;
