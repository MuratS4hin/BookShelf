import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  createNavigatorFactory,
  TabActions,
  TabRouter,
  useNavigationBuilder,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AudioPlayerScreen from '../screens/AudioPlayerScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ApiService from '../services/ApiService';
import useAppStore from '../store/UseAppStore';
import { getLayoutMetrics, useHIGTheme } from '../theme/hig';
import BottomNavBar, { SidebarNav } from './BottomNavBar';
import { NavigationLayoutContext } from './NavigationLayoutContext';

function AdaptiveTabNavigatorView({ initialRouteName, backBehavior, children, screenOptions }) {
  const theme = useHIGTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isRegular } = getLayoutMetrics(width);

  const { state, navigation, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, {
    initialRouteName,
    backBehavior,
    children,
    screenOptions,
  });

  const focusedRoute = state.routes[state.index];
  const currentRouteName = focusedRoute?.name;

  const bottomBarHeight = isRegular
    ? Math.max(insets.bottom, 16)
    : 64 + Math.max(insets.bottom, 8);

  const layoutValue = useMemo(
    () => ({
      bottomBarHeight,
      isSidebar: isRegular,
    }),
    [bottomBarHeight, isRegular]
  );

  const handleSelectRoute = (routeName) => {
    const targetRoute = state.routes.find((r) => r.name === routeName);
    if (!targetRoute) return;

    const isFocused = currentRouteName === routeName;
    const event = navigation.emit({
      type: 'tabPress',
      target: targetRoute.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.dispatch({
        ...TabActions.jumpTo(targetRoute.name, targetRoute.params),
        target: state.key,
      });
    }
  };

  // Keep all tab screens mounted so UI state stays intact when switching tabs.
  const scenes = (
    <View style={styles.sceneContainer}>
      {state.routes.map((route, index) => {
        const isFocused = index === state.index;
        return (
          <View
            key={route.key}
            pointerEvents={isFocused ? 'auto' : 'none'}
            accessibilityElementsHidden={!isFocused}
            importantForAccessibility={isFocused ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.scene,
              { display: isFocused ? 'flex' : 'none' },
            ]}
          >
            {descriptors[route.key].render()}
          </View>
        );
      })}
    </View>
  );

  return (
    <NavigationContent>
      <NavigationLayoutContext.Provider value={layoutValue}>
        <View
          style={[
            styles.shell,
            {
              backgroundColor: theme.colors.surfaceGroupedCanvas,
              flexDirection: isRegular ? 'row' : 'column',
            },
          ]}
        >
          {isRegular && (
            <SidebarNav
              navigation={navigation}
              currentRouteName={currentRouteName}
              onSelectRoute={handleSelectRoute}
            />
          )}

          <View style={styles.contentArea}>{scenes}</View>

          {!isRegular && (
            <BottomNavBar
              navigation={navigation}
              currentRouteName={currentRouteName}
              onSelectRoute={handleSelectRoute}
            />
          )}
        </View>
      </NavigationLayoutContext.Provider>
    </NavigationContent>
  );
}

const createAdaptiveTabNavigator = createNavigatorFactory(AdaptiveTabNavigatorView);
const Tab = createAdaptiveTabNavigator();
const RootStack = createNativeStackNavigator();

function MainTabsScreen() {
  return (
    <Tab.Navigator initialRouteName="HomeStack">
      <Tab.Screen name="HomeStack" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="SettingsStack" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const theme = useHIGTheme();
  const authToken = useAppStore((state) => state.authToken);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const serverUrl = useAppStore((state) => state.serverUrl);
  const setAuthSession = useAppStore((state) => state.setAuthSession);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);

  useEffect(() => {
    if (!hasHydrated || !authToken) return;
    let active = true;

    ApiService.getMe(serverUrl)
      .then((freshUser) => {
        if (active && freshUser) {
          setAuthSession(freshUser, authToken);
        }
      })
      .catch((err) => {
        // Only invalidate session on explicit auth rejection; keep offline playback working.
        if (active && (err?.status === 401 || err?.status === 403)) {
          clearAuthSession();
        }
      });

    return () => {
      active = false;
    };
  }, [hasHydrated, authToken, serverUrl]);

  if (!hasHydrated) {
    return (
      <View
        style={[
          styles.loadingCanvas,
          { backgroundColor: theme.colors.surfaceGroupedCanvas },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabsScreen} />
      <RootStack.Screen
        name="AudioBookPlayer"
        component={AudioPlayerScreen}
        options={{
          headerShown: false,
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <RootStack.Screen
        name="Auth"
        component={AuthScreen}
        options={{
          headerShown: false,
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  sceneContainer: {
    flex: 1,
  },
  scene: {
    flex: 1,
  },
});
