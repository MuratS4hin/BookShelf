import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, SafeAreaView, StyleSheet, useColorScheme, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
// Yükleme işleviyle ilgili importlar kaldırıldı: DocumentPicker, axios, ActivityIndicator, Alert
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';
import useAppStore from '../store/UseAppStore'; 

// Ekran genişliğini alıyoruz
const screenWidth = Dimensions.get('window').width;

const HomeScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';
  // isUploading state'i kaldırıldı
  const [activeFilter, setActiveFilter] = useState('all');

  // Zustand Store'dan kitapları çek (addAudiobook'a gerek kalmadı)
  const libraryBooks = useAppStore(state => state.audiobooks);

  // Düğme Genişliği Hesaplaması (Aynı kalır)
  const totalHorizontalPadding = 16 * 2; 
  const spaceBetweenButtons = 8 * 2; 
  const availableWidth = screenWidth - totalHorizontalPadding - spaceBetweenButtons;
  const buttonWidth = availableWidth / 3;

  // handleFileUpload işlevi kaldırıldı
  
  const styles = StyleSheet.create({
    headerButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
      width: 28,
      borderRadius: 20,
      backgroundColor: Colors.slate500,
      marginRight: 16,
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
    // uploadContainer ve uploadButton stilleri kaldırıldı
    
    // DİNAMİK GENİŞLİK İÇİN AYARLANMIŞ BUTON STİLİ (Aynı kalır)
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(16, 28, 34, 0.1)',
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
    scrollViewContainer: { maxHeight: 48, marginBottom: 4 },
    scrollContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 0 },
  });

  // Header'daki "+" ve "menü" butonu ayarı (Aynı kalır)
  // React.useLayoutEffect(() => {
  //   navigation.setOptions({
  //     headerRight: () => (
  //       <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')}>
  //         <Feather name="settings" size={18} color="white" />
  //       </TouchableOpacity>
  //     ),
  //     headerLeft: () => (
  //         <TouchableOpacity 
  //           onPress={() => navigation.openDrawer()}
  //           style={{ paddingHorizontal: 16, height: 40, justifyContent: 'center' }}
  //         >
  //             <Feather name="menu" size={24} color={isDark ? 'white' : 'black'} />
  //         </TouchableOpacity>
  //     ),
  //   });
  // }, [navigation, isDark]);
  
  const filterData = [
    { key: 'all', title: 'All' },
    { key: 'audiobooks', title: 'Audiobooks' },
    { key: 'pdfs', title: 'PDFs' },
  ];


  return (
    <SafeAreaView style={themeStyles.container}>
      <View style={styles.mainContent}>
        {/* Search Bar */}
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
        <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16 }}>
            {filterData.map((filter, index) => {
                const isActive = activeFilter === filter.key;
                const buttonStyle = [
                    styles.filterButton,
                    isActive ? styles.activeFilter : styles.inactiveFilter,
                    index === filterData.length - 1 && { marginRight: 0 } 
                ];
                
                const textColor = isActive ? 'white' : (isDark ? Colors.slate300 : Colors.slate700);

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

        {/* Book List */}
        <Text style={{ marginBottom: 12, fontSize: 18, fontWeight: 'bold', color: isDark ? 'white' : Colors.slate900 }}>Recently Added</Text>
        <ScrollView>
          {libraryBooks.map((book) => (
            <TouchableOpacity 
              key={book.id} 
              style={styles.bookItem} 
              // ✅ GÜNCELLEME: Kitap verisini AudioBookPlayer'a gönderiyoruz
              onPress={() => navigation.navigate('AudioBookPlayer', { bookData: book })}
            >
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
      <BottomTabBar navigation={navigation} currentRouteName="HomeStack" />
    </SafeAreaView>
  );
};

export default HomeScreen;
