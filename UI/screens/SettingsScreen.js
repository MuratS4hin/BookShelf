import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { Colors, getThemeStyles } from '../utils/ThemeStyles';
import BottomTabBar from '../navigation/BottomNavBar';
import useAppStore from '../store/UseAppStore';
import ApiService from '../services/ApiService';

const SettingsScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const themeStyles = getThemeStyles(colorScheme);
  const isDark = colorScheme === 'dark';

  const [isDarkModeEnabled, setIsDarkModeEnabled] = useState(isDark);
  const serverUrl = useAppStore((state) => state.serverUrl);
  const setServerUrl = useAppStore((state) => state.setServerUrl);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [healthInfo, setHealthInfo] = useState(null);

  const toggleDarkMode = () => {
    setIsDarkModeEnabled((previousState) => !previousState);
  };

  const handleSaveAndTestServer = async () => {
    const cleaned = (urlInput || 'http://localhost:5002').trim().replace(/\/+$/, '');
    setServerUrl(cleaned);
    try {
      const info = await ApiService.getHealth(cleaned);
      setHealthInfo(info);
      Alert.alert(
        'Connected to Backend',
        `Cleaner: ${info.cleaner}\nTTS: ${info.tts_backend} (${info.default_voice})\nFFmpeg: ${info.ffmpeg ? 'Ready' : 'Missing'}`
      );
    } catch (err) {
      setHealthInfo(null);
      Alert.alert('Connection Failed', `Could not reach ${cleaned}/health: ${err.message}`);
    }
  };

  const styles = StyleSheet.create({
    sectionHeader: {
      marginBottom: 12,
      marginTop: 16,
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? 'white' : Colors.slate900,
    },
    listGroup: {
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.7)',
      overflow: 'hidden',
      padding: 12,
      gap: 10,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    listItemText: {
      fontSize: 16,
      color: isDark ? Colors.slate200 : Colors.slate800,
    },
    input: {
      borderWidth: 1,
      borderColor: isDark ? Colors.slate700 : Colors.slate300,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: isDark ? 'white' : Colors.slate900,
      fontSize: 14,
    },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    mainContent: {
      paddingHorizontal: 20,
      flexGrow: 1,
    },
  });

  return (
    <SafeAreaView style={themeStyles.container}>
      <ScrollView contentContainerStyle={styles.mainContent}>
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

        <Text style={styles.sectionHeader}>AI Backend Server</Text>
        <View style={styles.listGroup}>
          <Text style={{ fontSize: 12, color: isDark ? Colors.slate400 : Colors.slate600 }}>
            FastAPI Server URL (use http://localhost:5002 on simulator/web or your Mac LAN IP on a phone)
          </Text>
          <TextInput
            style={styles.input}
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://localhost:5002"
          />
          <TouchableOpacity style={styles.button} onPress={handleSaveAndTestServer}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Save & Test Connection</Text>
          </TouchableOpacity>
          {healthInfo && (
            <Text style={{ fontSize: 12, color: Colors.primary }}>
              Active: Cleaner={healthInfo.cleaner} | Voice={healthInfo.default_voice}
            </Text>
          )}
        </View>
      </ScrollView>

      <BottomTabBar navigation={navigation} currentRouteName="SettingsStack" />
    </SafeAreaView>
  );
};

export default SettingsScreen;
