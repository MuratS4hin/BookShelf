// screens/HomeScreen.js

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';

const HomeScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';

  const recentlyAddedBooks = [
    { id: 1, title: 'The Silent Observer', author: 'Author A', imageUrl: 'https://picsum.photos/id/1/150/200' },
    { id: 2, title: 'Echoes of the Past', author: 'Author B', imageUrl: 'https://picsum.photos/id/2/150/200' },
    { id: 3, title: 'Whispers of the Wind', author: 'Author C', imageUrl: 'https://picsum.photos/id/3/150/200' },
  ];

  const styles = StyleSheet.create({
    uploadContainer: {
      alignItems: 'center',
      gap: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: isDark ? Colors.slate700 : Colors.slate300,
      paddingHorizontal: 24,
      paddingVertical: 48,
      textAlign: 'center',
      marginHorizontal: 16,
      marginTop: 16,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 8,
      backgroundColor: Colors.primary,
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
      marginRight: 16, // Sağdaki boşluk
    },
    bookImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 8,
      backgroundColor: Colors.slate500, // Placeholder rengi
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
      {/* ScrollView for content */}
      <ScrollView contentContainerStyle={styles.mainContent}>
        {/* Upload Section */}
        <View style={styles.uploadContainer}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? 'white' : Colors.slate900 }}>Upload a new file</Text>
            <Text style={{ fontSize: 14, color: isDark ? Colors.slate400 : Colors.slate600 }}>Supported formats: PDF, EPUB, TXT</Text>
          </View>
          <TouchableOpacity style={styles.uploadButton}>
            <MaterialIcons name="cloud-upload" size={16} color="white" />
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Recently Added Section */}
        <View style={{ marginTop: 32 }}>
          <Text style={styles.sectionTitle}>Recently Added</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {recentlyAddedBooks.map((book) => (
              <TouchableOpacity key={book.id} style={styles.bookCard} onPress={() => navigation.navigate('AudioBookPlayer')}>
                <Image source={{ uri: book.imageUrl }} style={styles.bookImage} />
                <View>
                  <Text numberOfLines={1} style={{ fontWeight: '500', color: isDark ? Colors.slate100 : Colors.slate800 }}>{book.title}</Text>
                  <Text style={{ fontSize: 12, color: isDark ? Colors.slate400 : Colors.slate500 }}>{book.author}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Footer / Tab Navigation */}
      <BottomTabBar navigation={navigation} currentRouteName="HomeStack" />
    </SafeAreaView>
  );
};

export default HomeScreen;