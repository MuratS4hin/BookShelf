import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  continuousCurve,
  getWebFocusRingStyle,
  Motion,
  Radii,
  Typography,
  useHIGTheme,
  useReducedMotion,
} from '../../theme/hig';

/**
 * Native-style segmented control with sliding pill thumb and reduced-motion support.
 */
export default function HIGSegmentedControl({
  options = [],
  value,
  onChange,
  disabled = false,
  tabular = false,
  style,
  accessibilityLabel,
}) {
  const theme = useHIGTheme();
  const reducedMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const translateX = useRef(new Animated.Value(0)).current;

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value)
  );
  const padding = 4;
  const trackWidth = Math.max(0, containerWidth - padding * 2);
  const segmentWidth = options.length > 0 ? trackWidth / options.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const targetX = activeIndex * segmentWidth;
    if (reducedMotion) {
      translateX.setValue(targetX);
      return;
    }
    Animated.timing(translateX, {
      toValue: targetX,
      duration: Motion.standardDuration,
      easing: Motion.springEasing,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, reducedMotion, translateX]);

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        continuousCurve,
        {
          backgroundColor: theme.colors.surfaceInset,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            continuousCurve,
            !theme.isDark && styles.thumbLightShadow,
            {
              width: segmentWidth,
              backgroundColor: theme.colors.surfaceSegmentedActive,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {options.map((opt, index) => {
        const isActive = opt.value === value;
        const isFocused = focusedIndex === index;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => !disabled && onChange?.(opt.value)}
            disabled={disabled}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex((prev) => (prev === index ? -1 : prev))}
            accessibilityRole="tab"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: isActive, disabled }}
            style={[
              styles.segment,
              continuousCurve,
              Platform.OS === 'web' && isFocused && getWebFocusRingStyle(theme.colors.accent, true),
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                Typography.subheadline,
                tabular && Typography.tabularNums,
                {
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? theme.colors.labelPrimary : theme.colors.labelSecondary,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    borderRadius: Radii.control,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: Radii.controlInner,
  },
  thumbLightShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radii.controlInner,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 1,
  },
});
