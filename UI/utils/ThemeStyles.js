import {
  Spacing,
  Radii,
  Typography,
  Motion,
  LightColors,
  DarkColors,
  useHIGTheme,
  useReducedMotion,
  getChromeMaterialStyle,
  getLayoutMetrics,
  getWebFocusRingStyle,
  continuousCurve,
} from '../theme/hig';

export {
  Spacing,
  Radii,
  Typography,
  Motion,
  LightColors,
  DarkColors,
  useHIGTheme,
  useReducedMotion,
  getChromeMaterialStyle,
  getLayoutMetrics,
  getWebFocusRingStyle,
  continuousCurve,
};

export const Colors = {
  primary: LightColors.accent,
  primaryDark: DarkColors.accent,
  backgroundLight: LightColors.surfaceGroupedCanvas,
  backgroundDark: DarkColors.surfaceGroupedCanvas,
  surfaceLight: LightColors.surfaceCard,
  surfaceDark: DarkColors.surfaceCard,
  textLight: DarkColors.labelPrimary,
  textDark: LightColors.labelPrimary,
};

export const getThemeStyles = (colorScheme) => {
  const palette = colorScheme === 'dark' ? DarkColors : LightColors;
  return {
    container: {
      flex: 1,
      backgroundColor: palette.surfaceGroupedCanvas,
    },
    headerBackground: {
      backgroundColor: palette.chromeMaterialNative,
    },
    textPrimary: {
      color: palette.labelPrimary,
    },
    textSecondary: {
      color: palette.labelSecondary,
    },
  };
};
