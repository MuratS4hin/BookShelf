import React, { useContext, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationLayoutContext } from '../../navigation/NavigationLayoutContext';
import {
  getChromeMaterialStyle,
  getLayoutMetrics,
  Spacing,
  Typography,
  useHIGTheme,
  useReducedMotion,
} from '../../theme/hig';

const HEADER_HEIGHT = 48;
const LEVELED_HEADER_HEIGHT = 56;

/**
 * Shared screen scaffold implementing Apple HIG edge-to-edge scrolling,
 * translucent sticky navigation bar, and Large Title -> Inline Title transition
 * (or a single leveled Large Title + trailing control row when `leveledHeader` is set).
 */
export default function HIGScreen({
  title,
  headerLeft = null,
  headerRight = null,
  leveledHeader = false,
  children,
  scrollEnabled = true,
  contentContainerStyle,
}) {
  const theme = useHIGTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { bottomBarHeight } = useContext(NavigationLayoutContext);
  const metrics = getLayoutMetrics(width);

  const scrollY = useRef(new Animated.Value(0)).current;

  const chromeOpacity = scrollY.interpolate({
    inputRange: reducedMotion ? [23, 24] : [12, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const inlineTitleOpacity = scrollY.interpolate({
    inputRange: reducedMotion ? [27, 28] : [24, 48],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: reducedMotion ? [27, 28] : [8, 40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerHeight = leveledHeader ? LEVELED_HEADER_HEIGHT : HEADER_HEIGHT;
  const topBarHeight = insets.top + headerHeight;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surfaceGroupedCanvas }]}>
      <Animated.ScrollView
        style={styles.scroll}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="main"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        contentContainerStyle={[
          {
            paddingTop: topBarHeight + (leveledHeader ? Spacing.md : Spacing.sm),
            paddingBottom: bottomBarHeight + Spacing.xxl,
            alignItems: 'center',
          },
          contentContainerStyle,
        ]}
      >
        <View
          style={[
            styles.column,
            {
              maxWidth: metrics.contentMaxWidth,
              paddingHorizontal: metrics.horizontalMargin,
            },
          ]}
        >
          {!leveledHeader && (
            <Animated.Text
              accessibilityRole="header"
              style={[
                Typography.largeTitle,
                {
                  color: theme.colors.labelPrimary,
                  marginBottom: Spacing.base,
                  opacity: largeTitleOpacity,
                },
              ]}
            >
              {title}
            </Animated.Text>
          )}
          {children}
        </View>
      </Animated.ScrollView>

      <View
        accessibilityRole="header"
        pointerEvents="box-none"
        style={[styles.header, { height: topBarHeight, paddingTop: insets.top }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            getChromeMaterialStyle(theme),
            {
              opacity: chromeOpacity,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.chromeBorder,
            },
          ]}
        />
        {leveledHeader ? (
          <View pointerEvents="box-none" style={styles.leveledHeaderOuter}>
            <View
              pointerEvents="box-none"
              style={[
                styles.leveledHeaderInner,
                {
                  height: headerHeight,
                  maxWidth: metrics.contentMaxWidth,
                  paddingHorizontal: metrics.horizontalMargin,
                },
              ]}
            >
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={[
                  Typography.largeTitle,
                  {
                    color: theme.colors.labelPrimary,
                    flexShrink: 1,
                  },
                ]}
              >
                {title}
              </Text>
              <View style={styles.leveledHeaderRight}>{headerRight}</View>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <View style={styles.headerSideLeft}>{headerLeft}</View>
            <View style={styles.headerCenter} pointerEvents="none">
              <Animated.Text
                numberOfLines={1}
                style={[
                  Typography.headline,
                  {
                    color: theme.colors.labelPrimary,
                    opacity: inlineTitleOpacity,
                  },
                ]}
              >
                {title}
              </Animated.Text>
            </View>
            <View style={styles.headerSideRight}>{headerRight}</View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  column: {
    width: '100%',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  leveledHeaderOuter: {
    alignItems: 'center',
  },
  leveledHeaderInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  leveledHeaderRight: {
    marginRight: -Spacing.sm,
    minWidth: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerRow: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  headerSideLeft: {
    minWidth: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerSideRight: {
    minWidth: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
