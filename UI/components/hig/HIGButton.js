import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { continuousCurve, Radii, Spacing, Typography, useHIGTheme } from '../../theme/hig';
import PressableScale from './PressableScale';

/**
 * Apple HIG button with primary, secondary, gray, tertiary, and destructive variants.
 */
export default function HIGButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}) {
  const theme = useHIGTheme();
  const isDisabled = disabled || loading;

  const palette = {
    primary: {
      bg: theme.colors.accent,
      fg: theme.colors.accentOnFill,
    },
    secondary: {
      bg: theme.colors.accentTint,
      fg: theme.colors.accent,
    },
    gray: {
      bg: theme.colors.fillSecondary,
      fg: theme.colors.labelPrimary,
    },
    tertiary: {
      bg: 'transparent',
      fg: theme.colors.accent,
    },
    destructive: {
      bg: theme.colors.destructiveTint,
      fg: theme.colors.destructive,
    },
  }[variant] || {
    bg: theme.colors.accent,
    fg: theme.colors.accentOnFill,
  };

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        continuousCurve,
        {
          minHeight: fullWidth ? 48 : 44,
          backgroundColor: palette.bg,
          opacity: disabled && !loading ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          icon || null
        )}
        <Text
          style={[
            Typography.headline,
            {
              fontSize: fullWidth ? 17 : 15,
              color: palette.fg,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.control,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
});
