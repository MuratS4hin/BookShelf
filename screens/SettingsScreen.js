// screens/SettingsScreen.js

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';

const SettingsScreen = ({ navigation }) => {
    const colorScheme = useColorScheme();
    const themeStyles = getThemeStyles(colorScheme);
    const isDark = colorScheme === 'dark';

    const [isDarkModeEnabled, setIsDarkModeEnabled] = useState(isDark);

    const toggleDarkMode = () => {
        setIsDarkModeEnabled(previousState => !previousState);
        // Gerçek temayı burada değiştirme mantığı eklenmeli.
    };

    const styles = StyleSheet.create({
        sectionHeader: {
            marginBottom: 16,
            fontSize: 20,
            fontWeight: 'bold',
            color: isDark ? 'white' : Colors.slate900,
        },
        listGroup: {
            borderRadius: 8,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
            overflow: 'hidden',
        },
        listItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
        },
        borderBottom: {
            borderBottomWidth: 1,
            borderColor: isDark ? 'rgba(148, 163, 178, 0.25)' : 'rgba(203, 213, 225, 0.5)',
        },
        listItemText: {
            fontSize: 16,
            color: isDark ? Colors.slate200 : Colors.slate800,
        },
        actionButton: {
            width: '100%',
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: 'center',
            marginTop: 4,
        },
        logoutButton: {
            backgroundColor: isDark ? 'rgba(17, 147, 212, 0.3)' : 'rgba(17, 147, 212, 0.2)',
        },
        headerTitle: {
            fontSize: 30,
            fontWeight: 'bold',
            color: isDark ? 'white' : Colors.slate900,
            marginBottom: 32,
            marginTop: 16,
        },
        mainContent: {
            paddingHorizontal: 24,
            flexGrow: 1,
        },
    });

    return (
        <SafeAreaView style={themeStyles.container}>
            <ScrollView contentContainerStyle={styles.mainContent}>
                <View style={{ marginTop: 12 }}>
                    <View>
                        <Text style={styles.sectionHeader}>Appearance</Text>
                        <View style={styles.listGroup}>
                            <View style={styles.listItem}>
                                <Text style={styles.listItemText}>Dark Mode</Text>
                                <Switch
                                    trackColor={{ false: Colors.slate500, true: Colors.primary }}
                                    thumbColor={'#ffffff'}
                                    onValueChange={toggleDarkMode}
                                    value={isDarkModeEnabled}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Notifications 
                    <View>
                        <Text style={styles.sectionHeader}>Notifications</Text>
                        <View style={styles.listGroup}>
                            <TouchableOpacity style={styles.listItem}>
                                <Text style={styles.listItemText}>Push Notifications</Text>
                                <MaterialIcons name="chevron-right" size={24} color={Colors.slate400} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={{ paddingTop: 16, paddingBottom: 32 }}>
                        <TouchableOpacity style={[styles.actionButton, styles.logoutButton]}>
                            <Text style={{ fontWeight: 'bold', color: Colors.primary }}>Log Out</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton}>
                            <Text style={{ fontWeight: 'bold', color: isDark ? 'red' : 'red' }}>Delete Account</Text>
                        </TouchableOpacity>
                    </View>*/}
                </View>
            </ScrollView>

            {/* Footer / Tab Navigation */}
            <BottomTabBar navigation={navigation} currentRouteName="SettingsStack" />
        </SafeAreaView>
    );
};

export default SettingsScreen;