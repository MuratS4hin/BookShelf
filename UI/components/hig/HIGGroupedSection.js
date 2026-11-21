import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { continuousCurve, Radii, Spacing, Typography, useHIGTheme } from '../../theme/hig';

/**
 * Grouped rounded surface section with optional title, trailing metadata, and footer note.
 */
export function HIGGroupedSection({ title, titleTrailing, footer, children, style }) {
  const theme = useHIGTheme();

  return (
    <View style={[styles.wrapper, style]}>
      {(title || titleTrailing) && (
        <View style={styles.headerRow}>
          {title ? (
            <Text
              accessibilityRole="header"
              style={[Typography.title3, { color: theme.colors.labelPrimary }]}
            >
              {title}
            </Text>
          ) : (
            <View />
          )}
          {titleTrailing ? (
            <Text
              style={[
                Typography.footnote,
                Typography.tabularNums,
                { color: theme.colors.labelSecondary },
              ]}
            >
              {titleTrailing}
            </Text>
          ) : null}
        </View>
      )}

      <View
        style={[
          styles.card,
          continuousCurve,
          {
            backgroundColor: theme.colors.surfaceCard,
            borderColor: theme.colors.separator,
          },
        ]}
      >
        {children}
      </View>

      {footer ? (
        <Text style={[Typography.footnote, styles.footer, { color: theme.colors.labelSecondary }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Row inside a HIGGroupedSection with optional inset hairline divider.
 */
export function HIGGroupedRow({ children, showDivider = false, dividerInset = 16, style }) {
  const theme = useHIGTheme();

  return (
    <View>
      <View style={[styles.row, style]}>{children}</View>
      {showDivider && (
        <View
          style={[
            styles.divider,
            {
              backgroundColor: theme.colors.separator,
              marginLeft: dividerInset,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  footer: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  row: {
    minHeight: 48,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
