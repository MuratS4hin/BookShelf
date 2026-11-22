import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import LocalCoverImage from '../components/LocalCoverImage';
import HIGButton from '../components/hig/HIGButton';
import { HIGGroupedRow, HIGGroupedSection } from '../components/hig/HIGGroupedSection';
import HIGScreen from '../components/hig/HIGScreen';
import HIGSegmentedControl from '../components/hig/HIGSegmentedControl';
import PressableScale from '../components/hig/PressableScale';
import AudiobookGenerator, { STAGE_LABELS } from '../services/AudiobookGenerator';
import LocalLibraryStorage from '../services/LocalLibraryStorage';
import useAppStore from '../store/UseAppStore';
import {
  continuousCurve,
  getWebFocusRingStyle,
  Radii,
  Spacing,
  Typography,
  useHIGTheme,
  webInputResetStyle,
} from '../theme/hig';
import { confirmAction, formatBytes, formatDuration } from '../utils/helpers';

const FILTER_OPTIONS = [
  { value: 'audio', label: 'Audio' },
  { value: 'pdf', label: 'PDF' },
];

export default function HomeScreen({ navigation }) {
  const theme = useHIGTheme();
  const [activeFilter, setActiveFilter] = useState('audio');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const serverUrl = useAppStore((state) => state.serverUrl);
  const libraryBooks = useAppStore((state) => state.audiobooks);
  const addAudiobook = useAppStore((state) => state.addAudiobook);
  const removeAudiobook = useAppStore((state) => state.removeAudiobook);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return libraryBooks.filter((book) => {
      if (!q) return true;
      return (
        (book.title || '').toLowerCase().includes(q) ||
        (book.author || '').toLowerCase().includes(q)
      );
    });
  }, [libraryBooks, searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleAddDocument = async () => {
    if (isAdding) return;
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
      setIsAdding(true);

      const localId = LocalLibraryStorage.createBookId();
      const { sourcePath, sourceSize } = await LocalLibraryStorage.saveSourceFile(localId, file);

      const baseFileName =
        file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const mimeType =
        file.mimeType || (ext === 'epub' ? 'application/epub+zip' : 'application/pdf');

      addAudiobook({
        id: localId,
        title: baseFileName,
        author: null,
        fileName: file.name,
        mimeType,
        fileType: ext,
        sourcePath,
        sourceSize,
        localSizeBytes: sourceSize,
        imageUrl: null,
        audioPath: null,
        textPath: null,
        storedLocally: true,
        status: 'imported',
        stage: null,
        progress: 0,
        lastPositionMs: 0,
      });

      setActiveFilter('pdf');
    } catch (err) {
      console.error('Add Document Error:', err);
      Alert.alert('Import Failed', err.message || 'Could not save document to this device.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCreateAudio = async (book) => {
    try {
      const finished = await AudiobookGenerator.generateForBook(book.id);
      if (finished) {
        Alert.alert(
          'Audiobook Ready',
          `"${finished.title}" was cleaned by the DNN and saved on this device.`
        );
      }
    } catch (err) {
      Alert.alert(
        'Conversion Failed',
        `${err.message || 'Could not create audio.'}\n\nServer: ${serverUrl}`
      );
    }
  };

  const handleDeleteBook = (book) => {
    confirmAction(
      'Remove Book',
      `Remove "${book.title}" and its files from this device?`,
      async () => {
        await LocalLibraryStorage.deleteBookFiles(book.id).catch(() => {});
        removeAudiobook(book.id);
      },
      'Remove'
    );
  };

  const isPdfTab = activeFilter === 'pdf';
  const countLabel = `${filteredBooks.length} ${filteredBooks.length === 1 ? 'item' : 'items'}`;

  return (
    <HIGScreen
      title="Home"
      leveledHeader
      headerRight={
        <PressableScale
          onPress={handleAddDocument}
          disabled={isAdding}
          accessibilityLabel="Add PDF or EPUB"
          accessibilityState={{ busy: isAdding }}
          style={styles.headerAction}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Ionicons name="add" size={28} color={theme.colors.accent} />
          )}
        </PressableScale>
      }
    >
      <View
        style={[
          styles.searchBar,
          continuousCurve,
          {
            backgroundColor: theme.colors.surfaceInset,
          },
          Platform.OS === 'web' &&
            searchFocused &&
            getWebFocusRingStyle(theme.colors.accent, true),
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={theme.colors.labelSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            Typography.body,
            styles.searchInput,
            { color: theme.colors.labelPrimary },
            webInputResetStyle,
          ]}
          placeholder="Search your library"
          placeholderTextColor={theme.colors.labelTertiary}
          keyboardAppearance={theme.colorScheme}
          returnKeyType="search"
          accessibilityLabel="Search your library"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchQuery.length > 0 && (
          <PressableScale
            onPress={() => setSearchQuery('')}
            accessibilityLabel="Clear search"
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.labelSecondary} />
          </PressableScale>
        )}
      </View>

      <HIGSegmentedControl
        options={FILTER_OPTIONS}
        value={activeFilter}
        onChange={setActiveFilter}
        accessibilityLabel="Library view mode"
        style={styles.segmented}
      />

      {filteredBooks.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            continuousCurve,
            {
              backgroundColor: theme.colors.surfaceCard,
              borderColor: theme.colors.separator,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIconBadge,
              continuousCurve,
              { backgroundColor: theme.colors.accentTint },
            ]}
          >
            <Ionicons
              name={libraryBooks.length === 0 ? 'book-outline' : 'search-outline'}
              size={26}
              color={theme.colors.accent}
            />
          </View>
          <Text
            style={[
              Typography.title3,
              styles.emptyTitle,
              { color: theme.colors.labelPrimary },
            ]}
          >
            {libraryBooks.length === 0 ? 'Your Bookshelf is Empty' : 'No Matching Books'}
          </Text>
          <Text
            style={[
              Typography.subheadlineRegular,
              styles.emptySubtitle,
              { color: theme.colors.labelSecondary },
            ]}
          >
            {libraryBooks.length === 0
              ? 'Tap + to add a PDF or EPUB to your device, then create an offline audiobook anytime from Audio.'
              : 'No titles match your current search. Try adjusting your query.'}
          </Text>
          {libraryBooks.length === 0 ? (
            <HIGButton
              title={isAdding ? 'Adding…' : 'Add PDF or EPUB'}
              variant="primary"
              loading={isAdding}
              onPress={handleAddDocument}
            />
          ) : (
            <HIGButton
              title="Clear Search"
              variant="secondary"
              onPress={handleClearSearch}
            />
          )}
        </View>
      ) : (
        <HIGGroupedSection
          title={isPdfTab ? 'PDF Documents' : 'Audio'}
          titleTrailing={countLabel}
        >
          {filteredBooks.map((book, index) => {
            const isLast = index === filteredBooks.length - 1;
            const durationText = formatDuration(book.duration);
            const sizeText = book.localSizeBytes > 0 ? formatBytes(book.localSizeBytes) : null;
            const sourceSizeText = book.sourceSize > 0 ? formatBytes(book.sourceSize) : sizeText;
            const fileLabel = (book.fileType || 'PDF').toUpperCase();
            const hasAudio = Boolean(book.audioPath);
            const isProcessing = book.status === 'processing';
            const isFailed = book.status === 'failed';

            const showProgress = !isPdfTab && isProcessing;
            const showCreateButton = !isPdfTab && !hasAudio && !isProcessing;
            const showFailedPill = !isPdfTab && isFailed;
            const showPlayButton = !isPdfTab && hasAudio;

            const subtitleText = isPdfTab
              ? book.author || `${fileLabel} Document`
              : hasAudio
              ? book.author || 'AI Narrator'
              : isFailed
              ? 'Audio generation failed'
              : book.author || 'Ready to create audio';

            const metaSummary = isPdfTab
              ? [fileLabel, sourceSizeText].filter(Boolean).join(' · ')
              : hasAudio
              ? [fileLabel, durationText, sizeText].filter(Boolean).join(' · ')
              : [fileLabel, sizeText].filter(Boolean).join(' · ');

            const stageText = STAGE_LABELS[book.stage] || 'Processing…';

            return (
              <HIGGroupedRow
                key={String(book.id)}
                showDivider={!isLast}
                dividerInset={80}
              >
                <View style={styles.rowWrapper}>
                  <View style={styles.bookRowTop}>
                    <PressableScale
                      onPress={() => navigation.navigate('AudioBookPlayer', { bookData: book })}
                      accessibilityLabel={`Open ${book.title}`}
                      style={styles.bookRowMain}
                    >
                      <View
                        style={[
                          styles.coverContainer,
                          continuousCurve,
                          {
                            backgroundColor: theme.colors.surfaceInset,
                            borderColor: theme.colors.separator,
                          },
                        ]}
                      >
                        <LocalCoverImage book={book} style={styles.coverImage} iconSize={20} />
                      </View>

                      <View style={styles.bookMetaColumn}>
                        <Text
                          numberOfLines={2}
                          style={[Typography.headline, { color: theme.colors.labelPrimary }]}
                        >
                          {book.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            Typography.subheadlineRegular,
                            { color: theme.colors.labelSecondary },
                          ]}
                        >
                          {subtitleText}
                        </Text>

                        <View style={styles.metaLine}>
                          <Text
                            style={[
                              Typography.footnote,
                              Typography.tabularNums,
                              { color: theme.colors.labelSecondary },
                            ]}
                          >
                            {metaSummary}
                          </Text>

                          {showFailedPill && (
                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: theme.colors.destructiveTint },
                              ]}
                            >
                              <Text
                                style={[
                                  Typography.caption,
                                  { fontWeight: '600', color: theme.colors.destructive },
                                ]}
                              >
                                Failed
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </PressableScale>

                    <View style={styles.trailingActions}>
                      {showPlayButton && (
                        <PressableScale
                          onPress={() => navigation.navigate('AudioBookPlayer', { bookData: book })}
                          accessibilityLabel={`Play ${book.title}`}
                          style={styles.trailingIconButton}
                        >
                          <Ionicons
                            name="play-circle"
                            size={28}
                            color={theme.colors.accent}
                          />
                        </PressableScale>
                      )}
                      <PressableScale
                        onPress={() => handleDeleteBook(book)}
                        accessibilityLabel={`Remove ${book.title}`}
                        style={styles.trailingIconButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={theme.colors.labelSecondary}
                        />
                      </PressableScale>
                    </View>
                  </View>

                  {showProgress && (
                    <View style={styles.rowSubBlock}>
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
                              width: `${Math.max(0, Math.min(100, book.progress || 0))}%`,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.progressTextRow}>
                        <Text
                          numberOfLines={1}
                          style={[
                            Typography.caption,
                            { flex: 1, color: theme.colors.labelSecondary },
                          ]}
                        >
                          {stageText}
                        </Text>
                        <Text
                          style={[
                            Typography.caption,
                            Typography.tabularNums,
                            { fontWeight: '600', color: theme.colors.accent },
                          ]}
                        >
                          {book.progress || 0}%
                        </Text>
                      </View>
                    </View>
                  )}

                  {showCreateButton && (
                    <View style={styles.rowSubBlock}>
                      <PressableScale
                        onPress={() => handleCreateAudio(book)}
                        accessibilityLabel={`${isFailed ? 'Retry' : 'Create'} audio for ${book.title}`}
                        style={[
                          styles.createAudioChip,
                          continuousCurve,
                          { backgroundColor: theme.colors.accentTint },
                        ]}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={15}
                          color={theme.colors.accent}
                        />
                        <Text
                          style={[
                            Typography.footnote,
                            { fontWeight: '600', color: theme.colors.accent },
                          ]}
                        >
                          {isFailed ? 'Retry Audio' : 'Create Audio'}
                        </Text>
                      </PressableScale>
                    </View>
                  )}
                </View>
              </HIGGroupedRow>
            );
          })}
        </HIGGroupedSection>
      )}
    </HIGScreen>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    minHeight: 44,
    borderRadius: Radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingRight: Spacing.sm,
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    marginBottom: Spacing.xl,
  },
  emptyCard: {
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIconBadge: {
    width: 56,
    height: 56,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: Spacing.xs,
  },
  rowWrapper: {
    paddingBottom: Spacing.xs,
  },
  bookRowTop: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.xs,
  },
  bookRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.base,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.xs,
    gap: Spacing.base,
  },
  coverContainer: {
    width: 48,
    height: 64,
    borderRadius: Radii.pillItem,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  bookMetaColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailingIconButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSubBlock: {
    paddingLeft: 80,
    paddingRight: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  progressTrack: {
    width: '100%',
    height: 5,
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
  createAudioChip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
});
