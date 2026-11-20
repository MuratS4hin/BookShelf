import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  SafeAreaView,
  StyleSheet,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';
import useAppStore from '../store/UseAppStore';

const screenWidth = Dimensions.get('window').width;

const HomeScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const libraryBooks = useAppStore((state) => state.audiobooks);

  const totalHorizontalPadding = 16 * 2;
  const spaceBetweenButtons = 8 * 2;
  const availableWidth = screenWidth - totalHorizontalPadding - spaceBetweenButtons;
  const buttonWidth = availableWidth / 3;

  const filteredBooks = useMemo(() => {
    return libraryBooks.filter((book) => {
      const q = searchQuery.trim().toLowerCase();
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

  const styles = StyleSheet.create({
    searchContainer: {
      marginBottom: 16,
      position: 'relative',
      marginTop: 12,
    },
    searchInput: {
      width: '100%',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(16, 28, 34, 0.05)',
      paddingVertical: 12,
      paddingLeft: 40,
      paddingRight: 16,
      color: isDark ? 'white' : Colors.slate900,
    },
    filterButton: {
      width: buttonWidth,
      height: 36,
      borderRadius: 8,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeFilter: {
      backgroundColor: Colors.primary,
    },
    inactiveFilter: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(16, 28, 34, 0.1)',
    },
    filterText: {
      fontSize: 14,
      fontWeight: '500',
    },
    bookItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 8,
    },
    bookImage: {
      height: 64,
      width: 48,
      flexShrink: 0,
      borderRadius: 4,
      backgroundColor: Colors.slate500,
    },
    mainContent: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
  });

  const filterData = [
    { key: 'all', title: 'All' },
    { key: 'audiobooks', title: 'Audiobooks' },
    { key: 'pdfs', title: 'PDFs' },
  ];

  return (
    <SafeAreaView style={themeStyles.container}>
      <View style={styles.mainContent}>
        <View style={styles.searchContainer}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 12,
              zIndex: 1,
            }}
          >
            <Feather name="search" size={20} color={Colors.slate400} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your library"
            placeholderTextColor={isDark ? Colors.slate400 : Colors.slate500}
            keyboardAppearance={colorScheme}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            marginBottom: 16,
          }}
        >
          {filterData.map((filter, index) => {
            const isActive = activeFilter === filter.key;
            const buttonStyle = [
              styles.filterButton,
              isActive ? styles.activeFilter : styles.inactiveFilter,
              index === filterData.length - 1 && { marginRight: 0 },
            ];
            const textColor = isActive
              ? 'white'
              : isDark
              ? Colors.slate300
              : Colors.slate700;

            return (
              <TouchableOpacity
                key={filter.key}
                style={buttonStyle}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text style={[styles.filterText, { color: textColor }]}>
                  {filter.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text
          style={{
            marginBottom: 12,
            fontSize: 18,
            fontWeight: 'bold',
            color: isDark ? 'white' : Colors.slate900,
          }}
        >
          Recently Added
        </Text>
        <ScrollView>
          {filteredBooks.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', gap: 12 }}>
              <Text style={{ color: isDark ? Colors.slate400 : Colors.slate500 }}>
                {libraryBooks.length === 0
                  ? 'Your bookshelf is empty.'
                  : 'No books match your search.'}
              </Text>
              {libraryBooks.length === 0 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: Colors.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                  }}
                  onPress={() => navigation.navigate('LibraryStack')}
                >
                  <Text style={{ color: 'white', fontWeight: '600' }}>
                    Import a PDF or EPUB
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredBooks.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={styles.bookItem}
                onPress={() =>
                  navigation.navigate('AudioBookPlayer', { bookData: book })
                }
              >
                <Image source={{ uri: book.imageUrl }} style={styles.bookImage} />
                <View style={{ flexGrow: 1 }}>
                  <Text
                    style={{
                      fontWeight: '600',
                      color: isDark ? 'white' : Colors.slate900,
                    }}
                  >
                    {book.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? Colors.slate400 : Colors.slate600,
                    }}
                  >
                    {book.author}
                  </Text>
                </View>
                <Feather
                  name="play-circle"
                  size={22}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <BottomTabBar navigation={navigation} currentRouteName="HomeStack" />
    </SafeAreaView>
  );
};

export default HomeScreen;
