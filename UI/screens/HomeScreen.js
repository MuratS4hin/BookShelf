import React, { useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HIGButton from '../components/hig/HIGButton';
import { HIGGroupedRow, HIGGroupedSection } from '../components/hig/HIGGroupedSection';
import HIGScreen from '../components/hig/HIGScreen';
import HIGSegmentedControl from '../components/hig/HIGSegmentedControl';
import PressableScale from '../components/hig/PressableScale';
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
import { formatDuration } from '../utils/helpers';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'audiobooks', label: 'Audiobooks' },
  { value: 'pdfs', label: 'PDFs' },
];

export default function HomeScreen({ navigation }) {
  const theme = useHIGTheme();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const libraryBooks = useAppStore((state) => state.audiobooks);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return libraryBooks.filter((book) => {
      const matchesQuery =
        !q ||
        (book.title || '').toLowerCase().includes(q) ||
        (book.author || '').toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (activeFilter === 'audiobooks') {
        return Boolean(book.audioPath);
      }
      if (activeFilter === 'pdfs') {
        return (book.fileType || 'pdf').toLowerCase() === 'pdf';
      }
      return true;
    });
  }, [libraryBooks, searchQuery, activeFilter]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveFilter('all');
  };

  const countLabel = `${filteredBooks.length} ${filteredBooks.length === 1 ? 'book' : 'books'}`;

  return (
    <HIGScreen
      title="Home"
      headerRight={
        <PressableScale
          onPress={() => navigation.navigate('LibraryStack')}
          accessibilityLabel="Import new book"
          style={styles.headerAction}
        >
          <Ionicons name="add" size={26} color={theme.colors.accent} />
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
        accessibilityLabel="Filter library"
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
              ? 'Import a PDF or EPUB to strip layout noise and generate a neural-narrated audiobook.'
              : 'No titles match your current search or filter. Try adjusting your query.'}
          </Text>
          {libraryBooks.length === 0 ? (
            <HIGButton
              title="Import PDF or EPUB"
              variant="primary"
              onPress={() => navigation.navigate('LibraryStack')}
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
        <HIGGroupedSection title="Recently Added" titleTrailing={countLabel}>
          {filteredBooks.map((book, index) => {
            const isLast = index === filteredBooks.length - 1;
            const durationText = formatDuration(book.duration);
            const fileLabel = (book.fileType || 'PDF').toUpperCase();
            const showImage = Boolean(book.imageUrl) && !failedImages[book.id];
            const isProcessingOrFailed = book.status && book.status !== 'completed';
            const isFailed = book.status === 'failed';

            return (
              <HIGGroupedRow
                key={String(book.id)}
                showDivider={!isLast}
                dividerInset={80}
              >
                <PressableScale
                  onPress={() => navigation.navigate('AudioBookPlayer', { bookData: book })}
                  accessibilityLabel={`Open ${book.title} by ${book.author || 'Unknown'}`}
                  style={styles.bookRow}
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
                        size={20}
                        color={theme.colors.labelSecondary}
                      />
                    )}
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
                      {book.author || 'AI Narrator'}
                    </Text>

                    <View style={styles.metaLine}>
                      <Text
                        style={[
                          Typography.footnote,
                          Typography.tabularNums,
                          { color: theme.colors.labelSecondary },
                        ]}
                      >
                        {durationText ? `${fileLabel} · ${durationText}` : fileLabel}
                      </Text>

                      {isProcessingOrFailed && (
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: isFailed
                                ? theme.colors.destructiveTint
                                : theme.colors.accentTint,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              Typography.caption,
                              Typography.tabularNums,
                              {
                                fontWeight: '600',
                                color: isFailed
                                  ? theme.colors.destructive
                                  : theme.colors.accent,
                              },
                            ]}
                          >
                            {isFailed ? 'Failed' : `Processing ${book.progress || 0}%`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Ionicons
                    name={book.audioPath ? 'play-circle' : 'chevron-forward'}
                    size={book.audioPath ? 28 : 18}
                    color={book.audioPath ? theme.colors.accent : theme.colors.labelTertiary}
                  />
                </PressableScale>
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
  bookRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
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
});
