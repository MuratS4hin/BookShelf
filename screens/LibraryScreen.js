// screens/LibraryScreen.js

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';

const LibraryScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';

  const libraryBooks = [
    { id: 1, title: 'The Silent Observer', author: 'Ethan Carter', imageUrl: 'https://picsum.photos/id/4/150/200' },
    { id: 2, title: 'Echoes of the Past', author: 'Sophia Bennett', imageUrl: 'https://picsum.photos/id/5/150/200' },
    { id: 3, title: 'The Hidden Path', author: 'Daniel Harper', imageUrl: 'https://picsum.photos/id/6/150/200' },
  ];

  const styles = StyleSheet.create({
    header: {
        padding: 16,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Stack Navigasyon başlığı bunu zaten halledecektir, o yüzden bu kısmı kaldırıyorum.
    },
    headerButton: {
      alignItems: 'center', 
      justifyContent: 'center', 
      height: 40, 
      width: 40, 
      borderRadius: 20, 
      backgroundColor: Colors.primary
    },
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 28, 34, 0.05)',
      paddingVertical: 12,
      paddingLeft: 40,
      paddingRight: 16,
      color: isDark ? 'white' : Colors.slate900,
    },
    filterButton: {
      flexShrink: 0,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
    },
    activeFilter: {
      backgroundColor: Colors.primary,
    },
    inactiveFilter: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(16, 28, 34, 0.1)',
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

  // Header'daki "+" butonu için özel bileşen (Stack Navigator başlığını kullanmak için)
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
      ),
      headerLeft: () => (
          // Drawer menü butonu Stack Navigator'da zaten tanımlı
          <TouchableOpacity 
            onPress={() => navigation.openDrawer()}
            style={{ paddingHorizontal: 16, height: 40, justifyContent: 'center' }}
          >
              <Feather name="menu" size={24} color={isDark ? 'white' : 'black'} />
          </TouchableOpacity>
      ),
    });
  }, [navigation, isDark]);

  return (
    <SafeAreaView style={themeStyles.container}>
      <View style={styles.mainContent}>
        <View style={styles.searchContainer}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, zIndex: 1 }}>
            <Feather name="search" size={20} color={Colors.slate400} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your library"
            placeholderTextColor={isDark ? Colors.slate400 : Colors.slate500}
            keyboardAppearance={colorScheme}
          />
        </View>

        {/* Filter Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24, paddingBottom: 8 }}>
          <TouchableOpacity style={[styles.filterButton, styles.activeFilter]}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: 'white' }}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.inactiveFilter]}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: isDark ? Colors.slate300 : Colors.slate700 }}>Audiobooks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.inactiveFilter]}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: isDark ? Colors.slate300 : Colors.slate700 }}>PDFs</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Book List */}
        <Text style={{ marginBottom: 12, fontSize: 18, fontWeight: 'bold', color: isDark ? 'white' : Colors.slate900 }}>Recently Added</Text>
        <ScrollView>
          {libraryBooks.map((book) => (
            <TouchableOpacity key={book.id} style={styles.bookItem} onPress={() => navigation.navigate('AudioBookPlayer')}>
              <Image source={{ uri: book.imageUrl }} style={styles.bookImage} />
              <View style={{ flexGrow: 1 }}>
                <Text style={{ fontWeight: '600', color: isDark ? 'white' : Colors.slate900 }}>{book.title}</Text>
                <Text style={{ fontSize: 12, color: isDark ? Colors.slate400 : Colors.slate600 }}>{book.author}</Text>
              </View>
              <TouchableOpacity style={{ padding: 8 }}>
                <Feather name="more-vertical" size={24} color={isDark ? Colors.slate400 : Colors.slate500} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Footer / Tab Navigation */}
      <BottomTabBar navigation={navigation} currentRouteName="LibraryStack" />
    </SafeAreaView>
  );
};

export default LibraryScreen;