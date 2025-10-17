import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from '../screens/HomeScreen';
import LibraryScreen from '../screens/LibraryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Drawer = createDrawerNavigator();

// --- Theme Colors ---
const COLORS = {
  primary: '#1193d4',
  backgroundDark: '#101c22',
  backgroundLight: '#f6f7f8',
  iconDark: 'white',
  iconLight: 'black',
};


export default function AppNavigator() {
  return (
    <Drawer.Navigator>
      <Drawer.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
            title: 'Home'
        }} 
      />
      <Drawer.Screen 
        name="Library" 
        component={LibraryScreen} 
        options={{ 
            title: 'My Library'
        }} 
      />
       <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ 
            title: 'Settings'
        }} 
      />
    </Drawer.Navigator>
  );
}