import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import HIGButton from '../components/hig/HIGButton';
import HIGScreen from '../components/hig/HIGScreen';
import PressableScale from '../components/hig/PressableScale';
import ApiService from '../services/ApiService';
import useAppStore from '../store/UseAppStore';
import {
  continuousCurve,
  getLayoutMetrics,
  Radii,
  Spacing,
  Typography,
  useHIGTheme,
} from '../theme/hig';
import { confirmAction, formatDuration } from '../utils/helpers';

const STAGE_LABELS = {
  queued: 'Queued...',
  extracting: 'Extracting layout & text from document...',
  cleaning: 'DNN removing page numbers, headers & noise...',
  narrating: 'Neural TTS synthesizing audiobook...',
  encoding: 'Encoding final MP3...',
  done: 'Completed!',
};

export default function LibraryScreen({ navigation }) {
  const theme = useHIGTheme();
  const { width } = useWindowDimensions();
  const metrics = getLayoutMetrics(width);

  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [failedImages, setFailedImages] = useState({});
  const pollTimerRef = useRef(null);

  const serverUrl = useAppStore((state) => state.serverUrl);
  const defaultNarrationSpeed = useAppStore((state) => state.defaultNarrationSpeed);
  const addAudiobook = useAppStore((state) => state.addAudiobook);
  const updateAudiobook = useAppStore((state) => state.updateAudiobook);
  const removeAudiobook = useAppStore((state) => state.removeAudiobook);
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
          setStatusMessage(stageLabel);

          if (bk?.title || bk?.author) {
            updateAudiobook(initialBookItem.id, {
              title: bk.title || initialBookItem.title,
              author:
                bk.author && bk.author !== 'Unknown'
                  ? bk.author
                  : initialBookItem.author,
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
              author:
                bk?.author && bk.author !== 'Unknown' ? bk.author : 'AI Narrator',
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

      const uploadRes = await ApiService.uploadBook(
        file,
        defaultNarrationSpeed || 1.0,
        serverUrl
      );
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

  const handleDeleteBook = (book) => {
    confirmAction(
      'Remove Book',
      `Remove "${book.title}" from your bookshelf?`,
      () => {
        removeAudiobook(book.id);
        if (book.bookId) {
          ApiService.deleteBook(book.bookId, serverUrl).catch(() => {});
        }
      },
      'Remove'
    );
  };

  const effectiveWidth = metrics.isRegular ? width - metrics.sidebarWidth : width;
  const contentWidth = Math.max(
    280,
    Math.min(effectiveWidth, metrics.contentMaxWidth) - metrics.horizontalMargin * 2
  );
  const columns = contentWidth < 520 ? 2 : contentWidth <= 860 ? 3 : 4;
  const cardWidth = Math.floor((contentWidth - Spacing.base * (columns - 1)) / columns);

  const countLabel = `${libraryBooks.length} ${libraryBooks.length === 1 ? 'book' : 'books'}`;

  return (
    <HIGScreen title="Library">
      <View
        style={[
          styles.importCard,
          continuousCurve,
          {
            backgroundColor: theme.colors.surfaceCard,
            borderColor: theme.colors.separator,
          },
        ]}
      >
        <View
          style={[
            styles.importIconBadge,
            continuousCurve,
            { backgroundColor: theme.colors.accentTint },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={24} color={theme.colors.accent} />
        </View>

        <View style={styles.importTextGroup}>
          <Text style={[Typography.title3, { color: theme.colors.labelPrimary }]}>
            Import Book
          </Text>
          <Text
            style={[
              Typography.subheadlineRegular,
              styles.importSubtitle,
              { color: theme.colors.labelSecondary },
            ]}
          >
            Upload a PDF or EPUB. AI removes page numbers and footnotes, then narrates with neural voice.
          </Text>
        </View>

        {isUploading && (
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: theme.colors.surfaceInset },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.colors.accent,
                    width: `${Math.max(0, Math.min(100, progress))}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.progressTextRow}>
              <Text
                numberOfLines={2}
                style={[
                  Typography.footnote,
                  { flex: 1, color: theme.colors.labelPrimary },
                ]}
              >
                {statusMessage}
              </Text>
              <Text
                style={[
                  Typography.footnote,
                  Typography.tabularNums,
                  { fontWeight: '600', color: theme.colors.accent },
                ]}
              >
                {progress}%
              </Text>
            </View>
          </View>
        )}

        <HIGButton
          variant="primary"
          fullWidth
          loading={isUploading}
          title={isUploading ? 'Processing…' : 'Select PDF or EPUB'}
          icon={
            !isUploading ? (
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={theme.colors.accentOnFill}
              />
            ) : null
          }
          onPress={handleFileUpload}
        />
      </View>

      <View style={styles.shelfSection}>
        <View style={styles.sectionHeaderRow}>
          <Text
            accessibilityRole="header"
            style={[Typography.title3, { color: theme.colors.labelPrimary }]}
          >
            Your Shelf
          </Text>
          <Text
            style={[
              Typography.footnote,
              Typography.tabularNums,
              { color: theme.colors.labelSecondary },
            ]}
          >
            {countLabel}
          </Text>
        </View>

        {libraryBooks.length === 0 ? (
          <View
            style={[
              styles.emptyNoteCard,
              continuousCurve,
              {
                backgroundColor: theme.colors.surfaceCard,
                borderColor: theme.colors.separator,
              },
            ]}
          >
            <Text
              style={[
                Typography.subheadlineRegular,
                styles.emptyNoteText,
                { color: theme.colors.labelSecondary },
              ]}
            >
              No books imported yet. Select a PDF or EPUB above to build your audiobook shelf.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {libraryBooks.map((book) => {
              const showImage = Boolean(book.imageUrl) && !failedImages[book.id];
              const durationStr = formatDuration(book.duration);
              const fileLabel = (book.fileType || 'PDF').toUpperCase();
              const isPendingOrFailed = book.status && book.status !== 'completed';
              const isFailed = book.status === 'failed';

              return (
                <View
                  key={String(book.id)}
                  style={[
                    styles.bookCard,
                    continuousCurve,
                    {
                      width: cardWidth,
                      backgroundColor: theme.colors.surfaceCard,
                      borderColor: theme.colors.separator,
                    },
                  ]}
                >
                  <PressableScale
                    onPress={() => navigation.navigate('AudioBookPlayer', { bookData: book })}
                    accessibilityLabel={`Open ${book.title} by ${book.author || 'Unknown'}`}
                    style={styles.cardBodyPressable}
                  >
                    <View
                      style={[
                        styles.coverFrame,
                        continuousCurve,
                        {
                          backgroundColor: theme.colors.surfaceInset,
                          borderColor: theme.colors.separator,
                        },
                      ]}
                    >
                      {showImage ? (
                        <Image
                          source={{ uri: book.imageUrl }}
                          style={styles.coverImage}
                          resizeMode="cover"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [book.id]: true }))
                          }
                        />
                      ) : (
                        <Ionicons
                          name="book-outline"
                          size={32}
                          color={theme.colors.labelSecondary}
                        />
                      )}

                      {isPendingOrFailed && (
                        <View
                          style={[
                            styles.statusOverlay,
                            continuousCurve,
                            {
                              backgroundColor: isFailed
                                ? theme.colors.destructive
                                : theme.colors.accent,
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              Typography.caption,
                              Typography.tabularNums,
                              styles.statusOverlayText,
                            ]}
                          >
                            {isFailed ? 'Failed' : `${book.progress || 0}%`}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      numberOfLines={2}
                      style={[
                        Typography.subheadline,
                        styles.cardTitle,
                        { color: theme.colors.labelPrimary },
                      ]}
                    >
                      {book.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
                    >
                      {book.author || 'AI Narrator'}
                    </Text>
                  </PressableScale>

                  <View
                    style={[
                      styles.cardFooter,
                      { borderTopColor: theme.colors.separator },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        Typography.caption,
                        Typography.tabularNums,
                        { color: theme.colors.labelSecondary, flex: 1 },
                      ]}
                    >
                      {durationStr ? `${fileLabel} · ${durationStr}` : fileLabel}
                    </Text>
                    <PressableScale
                      onPress={() => handleDeleteBook(book)}
                      accessibilityLabel={`Remove ${book.title}`}
                      style={styles.deleteButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.colors.labelSecondary}
                      />
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </HIGScreen>
  );
}

const styles = StyleSheet.create({
  importCard: {
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.base,
  },
  importIconBadge: {
    width: 48,
    height: 48,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importTextGroup: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  importSubtitle: {
    textAlign: 'center',
    maxWidth: 420,
  },
  progressSection: {
    width: '100%',
    gap: Spacing.sm,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  shelfSection: {
    marginTop: Spacing.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  emptyNoteCard: {
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
  },
  emptyNoteText: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  bookCard: {
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardBodyPressable: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  coverFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radii.cover,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.pillItem,
  },
  statusOverlayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cardTitle: {
    fontWeight: '600',
    minHeight: 40,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pillItem,
  },
});
