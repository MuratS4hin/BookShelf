import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../components/hig/PressableScale';
import useAppStore from '../store/UseAppStore';
import {
  continuousCurve,
  getChromeMaterialStyle,
  Radii,
  Spacing,
  Typography,
  useHIGTheme,
} from '../theme/hig';
import { getInitials } from '../utils/helpers';

export const TABS = [
  {
    name: 'HomeStack',
    label: 'Home',
    iconOutline: 'home-outline',
    iconFilled: 'home',
  },
  {
    name: 'SettingsStack',
    label: 'Settings',
    iconOutline: 'settings-outline',
    iconFilled: 'settings',
  },
];

/**
 * Compact viewport bottom tab bar with translucent material and 48px+ touch targets.
 */
export default function BottomNavBar({ navigation, currentRouteName, onSelectRoute }) {
  const theme = useHIGTheme();
  const insets = useSafeAreaInsets();

  const handlePress = (routeName) => {
    if (onSelectRoute) {
      onSelectRoute(routeName);
    } else {
      navigation?.navigate(routeName);
    }
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.footer,
        getChromeMaterialStyle(theme),
        {
          borderTopColor: theme.colors.chromeBorder,
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
        },
      ]}
    >
      <View style={styles.navBar}>
        {TABS.map((tab) => {
          const isActive = currentRouteName === tab.name;
          const tint = isActive ? theme.colors.accent : theme.colors.labelSecondary;

          return (
            <PressableScale
              key={tab.name}
              style={styles.navItem}
              onPress={() => handlePress(tab.name)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={isActive ? tab.iconFilled : tab.iconOutline}
                size={24}
                color={tint}
              />
              <Text
                numberOfLines={1}
                style={[
                  Typography.caption,
                  {
                    fontWeight: isActive ? '600' : '500',
                    color: tint,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Regular/wide viewport translucent sidebar navigation (iPadOS / macOS / Desktop Web).
 */
export function SidebarNav({ navigation, currentRouteName, onSelectRoute }) {
  const theme = useHIGTheme();
  const insets = useSafeAreaInsets();
  const bookCount = useAppStore((state) => state.audiobooks.length);
  const user = useAppStore((state) => state.user);
  const authToken = useAppStore((state) => state.authToken);
  const [browseExpanded, setBrowseExpanded] = React.useState(true);

  const handlePress = (routeName) => {
    if (onSelectRoute) {
      onSelectRoute(routeName);
    } else {
      navigation?.navigate(routeName);
    }
  };

  const isSignedIn = Boolean(user && authToken);
  const displayName = user?.full_name || user?.username || 'Account';

  return (
    <View
      accessibilityRole="navigation"
      style={[
        styles.sidebar,
        getChromeMaterialStyle(theme),
        {
          borderRightColor: theme.colors.chromeBorder,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.base),
        },
      ]}
    >
      <View style={styles.sidebarTop}>
        <Text
          accessibilityRole="header"
          style={[
            Typography.title2,
            {
              color: theme.colors.labelPrimary,
              paddingHorizontal: Spacing.md,
              marginBottom: Spacing.lg,
            },
          ]}
        >
          Bookshelf
        </Text>

        <PressableScale
          onPress={() => setBrowseExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Browse section"
          accessibilityState={{ expanded: browseExpanded }}
          style={styles.sectionToggle}
        >
          <Text
            style={[
              Typography.footnote,
              {
                fontWeight: '600',
                color: theme.colors.labelSecondary,
                letterSpacing: 0.3,
              },
            ]}
          >
            Browse
          </Text>
          <Ionicons
            name={browseExpanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={theme.colors.labelSecondary}
          />
        </PressableScale>

        {browseExpanded && (
          <View style={styles.sidebarList}>
            {TABS.map((tab) => {
              const isActive = currentRouteName === tab.name;
              const iconColor = isActive ? theme.colors.accent : theme.colors.labelSecondary;
              const textColor = isActive ? theme.colors.accent : theme.colors.labelPrimary;

              return (
                <PressableScale
                  key={tab.name}
                  onPress={() => handlePress(tab.name)}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                  style={[
                    styles.sidebarItem,
                    continuousCurve,
                    {
                      backgroundColor: isActive ? theme.colors.accentTint : 'transparent',
                    },
                  ]}
                >
                  <Ionicons
                    name={isActive ? tab.iconFilled : tab.iconOutline}
                    size={20}
                    color={iconColor}
                  />
                  <Text
                    style={[
                      Typography.subheadline,
                      {
                        flex: 1,
                        fontWeight: isActive ? '600' : '500',
                        color: textColor,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {tab.name === 'HomeStack' && bookCount > 0 && (
                    <Text
                      style={[
                        Typography.footnote,
                        Typography.tabularNums,
                        {
                          fontWeight: '600',
                          color: isActive ? theme.colors.accent : theme.colors.labelSecondary,
                        },
                      ]}
                    >
                      {bookCount}
                    </Text>
                  )}
                </PressableScale>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.accountFooter, { borderTopColor: theme.colors.separator }]}>
        {isSignedIn ? (
          <PressableScale
            onPress={() => handlePress('SettingsStack')}
            accessibilityLabel={`Account ${displayName}, open settings`}
            style={[styles.accountButton, continuousCurve]}
          >
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.colors.accentTint },
              ]}
            >
              <Text
                style={[
                  Typography.footnote,
                  { fontWeight: '700', color: theme.colors.accent },
                ]}
              >
                {getInitials(user)}
              </Text>
            </View>
            <View style={styles.accountMeta}>
              <Text
                numberOfLines={1}
                style={[
                  Typography.subheadline,
                  { fontWeight: '600', color: theme.colors.labelPrimary },
                ]}
              >
                {displayName}
              </Text>
              <Text
                numberOfLines={1}
                style={[Typography.caption, { color: theme.colors.labelSecondary }]}
              >
                {user.email}
              </Text>
            </View>
          </PressableScale>
        ) : (
          <PressableScale
            onPress={() => navigation?.navigate('Auth', { initialMode: 'login' })}
            accessibilityLabel="Sign in (optional account)"
            style={[styles.accountButton, continuousCurve]}
          >
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.colors.surfaceInset },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={theme.colors.accent}
              />
            </View>
            <View style={styles.accountMeta}>
              <Text
                numberOfLines={1}
                style={[
                  Typography.subheadline,
                  { fontWeight: '600', color: theme.colors.accent },
                ]}
              >
                Sign In
              </Text>
              <Text
                numberOfLines={1}
                style={[Typography.caption, { color: theme.colors.labelSecondary }]}
              >
                Optional account
              </Text>
            </View>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  sidebar: {
    width: 260,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-between',
  },
  sidebarTop: {
    flex: 1,
  },
  sectionToggle: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarList: {
    gap: Spacing.xs,
  },
  sidebarItem: {
    minHeight: 44,
    borderRadius: Radii.pillItem,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  accountFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  accountButton: {
    minHeight: 52,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pillItem,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMeta: {
    flex: 1,
    gap: 2,
  },
});
