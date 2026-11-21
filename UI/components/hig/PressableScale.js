import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { getWebFocusRingStyle, Motion, useHIGTheme, useReducedMotion } from '../../theme/hig';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Tactile interactive press wrapper enforcing HIG active feedback and web focus rings.
 */
export default function PressableScale({
  children,
  onPress,
  disabled = false,
  style,
  hitSlop,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  onFocus,
  onBlur,
  ...rest
}) {
  const theme = useHIGTheme();
  const reducedMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animatePress = (pressed) => {
    if (disabled) return;
    if (reducedMotion) {
      opacityAnim.setValue(pressed ? Motion.pressOpacity : 1);
      return;
    }

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: pressed ? Motion.pressScale : 1,
        duration: Motion.pressDuration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: pressed ? Motion.pressOpacity : 1,
        duration: Motion.pressDuration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={[
        style,
        getWebFocusRingStyle(theme.colors.accent, isFocused),
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
