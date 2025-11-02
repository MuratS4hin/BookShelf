import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LibraryScreen from '../screens/LibraryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AudioBookPlayerScreen from '../screens/AudioPlayerScreen';

const Drawer = createDrawerNavigator();
const HomeStack = createNativeStackNavigator();
const LibraryStack = createNativeStackNavigator();

// --- Home Stack Tanımı ---
function HomeStackScreen() {
  return (
    <HomeStack.Navigator 
      // HomeMain ve diğer ekranlar kendi header'larını yönetecek.
      screenOptions={{ headerShown: false }} 
    >
      <HomeStack.Screen
        name="HomeMain"
        component={HomeScreen}
        // ✅ GÜNCELLEME: Stack header'ını göster ve başlığı Stack tarafından yönet
        options={{ title: 'Home', headerShown: true }} 
      />
      <HomeStack.Screen
        name="AudioBookPlayer"
        component={AudioBookPlayerScreen}
        // ✅ GÜNCELLEME: Player ekranında Stack header'ını göster
        options={{ title: 'Audio Player', headerShown: false }} 
      />
    </HomeStack.Navigator>
  );
}

// --- Library Stack Tanımı ---
function LibraryStackScreen() {
  return (
    <LibraryStack.Navigator 
      // LibraryMain ve diğer ekranlar kendi header'larını yönetecek.
      screenOptions={{ headerShown: false }}
    >
      <LibraryStack.Screen
        name="LibraryMain"
        component={LibraryScreen}
        // ✅ GÜNCELLEME: Stack header'ını göster ve başlığı Stack tarafından yönet
        options={{ title: 'My Library', headerShown: true }}
      />
      <LibraryStack.Screen
        name="AudioBookPlayer"
        component={AudioBookPlayerScreen}
        // ✅ GÜNCELLEME: Player ekranında Stack header'ını göster
        options={{ title: 'Audio Player', headerShown: false }}
      />
      {/* Settings ekranı da bu Stack üzerinden açılabilir, ancak burada sadece Player'ı tuttum. */}
    </LibraryStack.Navigator>
  );
}

// --- Ana Drawer Navigator ---
export default function AppNavigator() {
  return (
    <Drawer.Navigator>
      <Drawer.Screen
        name="HomeStack"
        component={HomeStackScreen}
        options={{
          title: 'Home',
          // ✅ GÜNCELLEME: Drawer'ın kendi header'ını gizle, Stack'in header'ı görünecek
          headerShown: false, 
        }}
      />
      <Drawer.Screen
        name="LibraryStack"
        component={LibraryStackScreen}
        options={{
          title: 'My Library',
          // ✅ GÜNCELLEME: Drawer'ın kendi header'ını gizle, Stack'in header'ı görünecek
          headerShown: false, 
        }}
      />
      <Drawer.Screen
        name="SettingsStack"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          // Settings, Stack içinde olmadığı için kendi header'ını Drawer'dan alır
        }} />
    </Drawer.Navigator>
  );
}
