// components/BottomTabBar.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';

const BottomNavBar = ({ navigation, currentRouteName }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeStyles = getThemeStyles(colorScheme);

  // Sekme verileri
  const tabs = [
    { name:'Home', nameStack: 'HomeStack', icon: 'home', route: 'HomeStack', iconLib: MaterialIcons },
    { name:'Library', nameStack: 'LibraryStack', icon: 'book', route: 'LibraryStack', iconLib: MaterialIcons },
     { name:'Settings', nameStack: 'SettingsStack', icon: 'settings', route: 'SettingsStack', iconLib: MaterialIcons },
  ];

  const styles = StyleSheet.create({
    footer: {
      borderTopWidth: 1,
      borderColor: Colors.slate500, // Home/Settings'teki sınırları kullan
      ...themeStyles.headerBackground,
      paddingTop: 8,
      paddingBottom: 4, 
    },
    navBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    navItem: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 96,
      gap: 4,
      paddingVertical: 4
    },
    activeColor: Colors.primary,
    inactiveColor: isDark ? Colors.slate200 : Colors.slate500,
  });

  return (
    <View style={styles.footer}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = currentRouteName === tab.nameStack;
          const iconColor = isActive ? styles.activeColor : styles.inactiveColor;
          const IconComponent = tab.iconLib;

          return (
            <TouchableOpacity 
              key={tab.name}
              style={styles.navItem} 
              onPress={() => navigation.navigate(tab.route)}
            >
              <IconComponent name={tab.icon} size={24} color={iconColor} />
              <Text 
                style={{ 
                  fontSize: 12, 
                  fontWeight: '500', 
                  color: iconColor 
                }}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default BottomNavBar;