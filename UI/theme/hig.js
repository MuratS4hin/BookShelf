import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Easing, Platform, useColorScheme } from 'react-native';
import useAppStore from '../store/UseAppStore';

// 8-Point Spacing Grid
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Continuous Corner Radii (Squircle Geometry)
export const Radii = {
  pillItem: 8,
  cover: 10,
  controlInner: 10,
  control: 12,
  card: 16,
  sheet: 24,
  modalDesktop: 28,
  full: 9999,
};

export const continuousCurve = Platform.OS === 'ios' ? { borderCurve: 'continuous' } : {};

const webFontFamily =
  Platform.OS === 'web'
    ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    : undefined;

const makeType = (style) => (webFontFamily ? { fontFamily: webFontFamily, ...style } : style);

export const Typography = {
  fontFamily: webFontFamily,
  monoFontFamily: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: '"SF Mono", ui-monospace, Menlo, monospace',
  }),
  largeTitle: makeType({ fontSize: 34, fontWeight: '700', letterSpacing: -0.68, lineHeight: 41 }),
  title1: makeType({ fontSize: 28, fontWeight: '700', letterSpacing: -0.42, lineHeight: 34 }),
  title2: makeType({ fontSize: 22, fontWeight: '700', letterSpacing: -0.22, lineHeight: 28 }),
  title3: makeType({ fontSize: 20, fontWeight: '600', letterSpacing: -0.2, lineHeight: 25 }),
  headline: makeType({ fontSize: 17, fontWeight: '600', letterSpacing: -0.17, lineHeight: 22 }),
  body: makeType({ fontSize: 17, fontWeight: '400', lineHeight: 25 }),
  callout: makeType({ fontSize: 16, fontWeight: '400', lineHeight: 22 }),
  subheadline: makeType({ fontSize: 15, fontWeight: '500', lineHeight: 20 }),
  subheadlineRegular: makeType({ fontSize: 15, fontWeight: '400', lineHeight: 20 }),
  footnote: makeType({ fontSize: 13, fontWeight: '400', lineHeight: 18 }),
  caption: makeType({ fontSize: 12, fontWeight: '400', lineHeight: 16 }),
  tabularNums: { fontVariant: ['tabular-nums'] },
};

// Semantic Adaptive Color Tokens
export const LightColors = {
  backgroundPrimary: '#FFFFFF',
  surfaceGroupedCanvas: '#F2F2F7',
  surfaceSecondary: '#F2F2F7',
  surfaceCard: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSheet: '#FFFFFF',
  surfaceInset: 'rgba(120, 120, 128, 0.12)',
  surfaceSegmentedActive: '#FFFFFF',
  labelPrimary: '#000000',
  labelSecondary: 'rgba(60, 60, 67, 0.60)',
  labelTertiary: 'rgba(60, 60, 67, 0.30)',
  separator: 'rgba(60, 60, 67, 0.12)',
  chromeBorder: 'rgba(60, 60, 67, 0.18)',
  accent: '#007AFF',
  accentOnFill: '#FFFFFF',
  accentTint: 'rgba(0, 122, 255, 0.12)',
  fillSecondary: 'rgba(120, 120, 128, 0.12)',
  success: '#34C759',
  successTint: 'rgba(52, 199, 89, 0.12)',
  warning: '#FF9500',
  warningTint: 'rgba(255, 149, 0, 0.12)',
  destructive: '#FF3B30',
  destructiveTint: 'rgba(255, 59, 48, 0.12)',
  chromeMaterial: 'rgba(255, 255, 255, 0.78)',
  chromeMaterialNative: 'rgba(255, 255, 255, 0.92)',
  scrim: 'rgba(0, 0, 0, 0.32)',
};

export const DarkColors = {
  backgroundPrimary: '#000000',
  surfaceGroupedCanvas: '#000000',
  surfaceSecondary: '#1C1C1E',
  surfaceCard: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  surfaceSheet: '#1C1C1E',
  surfaceInset: 'rgba(120, 120, 128, 0.24)',
  surfaceSegmentedActive: '#2C2C2E',
  labelPrimary: '#FFFFFF',
  labelSecondary: 'rgba(235, 235, 245, 0.60)',
  labelTertiary: 'rgba(235, 235, 245, 0.30)',
  separator: 'rgba(235, 235, 245, 0.14)',
  chromeBorder: 'rgba(235, 235, 245, 0.18)',
  accent: '#0A84FF',
  accentOnFill: '#FFFFFF',
  accentTint: 'rgba(10, 132, 255, 0.18)',
  fillSecondary: 'rgba(120, 120, 128, 0.24)',
  success: '#30D158',
  successTint: 'rgba(48, 209, 88, 0.18)',
  warning: '#FF9F0A',
  warningTint: 'rgba(255, 159, 10, 0.18)',
  destructive: '#FF453A',
  destructiveTint: 'rgba(255, 69, 58, 0.18)',
  chromeMaterial: 'rgba(28, 28, 30, 0.78)',
  chromeMaterialNative: 'rgba(28, 28, 30, 0.92)',
  scrim: 'rgba(0, 0, 0, 0.60)',
};

export const Motion = {
  standardDuration: 280,
  springDuration: 380,
  pressDuration: 120,
  pressScale: 0.97,
  pressOpacity: 0.85,
  standardEasing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
  springEasing: Easing.bezier(0.32, 0.72, 0, 1),
};

export function getChromeMaterialStyle(theme) {
  if (Platform.OS === 'web') {
    return {
      backgroundColor: theme.colors.chromeMaterial,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    };
  }
  return {
    backgroundColor: theme.colors.chromeMaterialNative,
  };
}

export function getLayoutMetrics(width) {
  return {
    isRegular: width >= 768,
    horizontalMargin: width >= 1024 ? 40 : width >= 768 ? 24 : 20,
    contentMaxWidth: 760,
    sidebarWidth: 260,
    minHitTarget: 44,
  };
}

export function getWebFocusRingStyle(accentColor, isFocused = true) {
  if (Platform.OS !== 'web' || !isFocused) {
    return null;
  }
  return {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: accentColor,
    outlineOffset: 2,
  };
}

export const webInputResetStyle = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

export function useHIGTheme() {
  const systemScheme = useColorScheme();
  const themePreference = useAppStore((state) => state.themePreference);

  const resolvedScheme =
    themePreference === 'light' || themePreference === 'dark'
      ? themePreference
      : systemScheme === 'dark'
      ? 'dark'
      : 'light';

  return useMemo(() => {
    const isDark = resolvedScheme === 'dark';
    return {
      isDark,
      colorScheme: resolvedScheme,
      colors: isDark ? DarkColors : LightColors,
      spacing: Spacing,
      radii: Radii,
      typography: Typography,
      motion: Motion,
    };
  }, [resolvedScheme]);
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReducedMotion(Boolean(enabled));
        }
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReducedMotion(Boolean(enabled));
    });

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}
