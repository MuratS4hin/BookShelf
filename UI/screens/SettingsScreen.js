import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HIGButton from '../components/hig/HIGButton';
import { HIGGroupedRow, HIGGroupedSection } from '../components/hig/HIGGroupedSection';
import HIGScreen from '../components/hig/HIGScreen';
import HIGSegmentedControl from '../components/hig/HIGSegmentedControl';
import PressableScale from '../components/hig/PressableScale';
import ApiService from '../services/ApiService';
import useAppStore from '../store/UseAppStore';
import {
  continuousCurve,
  getWebFocusRingStyle,
  Radii,
  Spacing,
  Typography,
  useHIGTheme,
  webInputResetStyle,
} from '../theme/hig';
import { confirmAction } from '../utils/helpers';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SPEED_OPTIONS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1.0x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
];

export default function SettingsScreen() {
  const theme = useHIGTheme();

  const serverUrl = useAppStore((state) => state.serverUrl);
  const setServerUrl = useAppStore((state) => state.setServerUrl);
  const themePreference = useAppStore((state) => state.themePreference);
  const setThemePreference = useAppStore((state) => state.setThemePreference);
  const defaultNarrationSpeed = useAppStore((state) => state.defaultNarrationSpeed);
  const setDefaultNarrationSpeed = useAppStore((state) => state.setDefaultNarrationSpeed);
  const audiobooks = useAppStore((state) => state.audiobooks);
  const clearAudiobooks = useAppStore((state) => state.clearAudiobooks);

  const [urlInput, setUrlInput] = useState(serverUrl);
  const [urlFocused, setUrlFocused] = useState(false);
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'testing' | 'connected' | 'error'
  const [healthInfo, setHealthInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSaveAndTestServer = async () => {
    const cleaned = (urlInput || 'http://localhost:5002').trim().replace(/\/+$/, '');
    setUrlInput(cleaned);
    setServerUrl(cleaned);
    setConnectionState('testing');
    setErrorMessage('');

    try {
      const info = await ApiService.getHealth(cleaned);
      setHealthInfo(info);
      setConnectionState('connected');
      Alert.alert(
        'Connected to Backend',
        `Cleaner: ${info.cleaner}\nTTS: ${info.tts_backend} (${info.default_voice})\nFFmpeg: ${
          info.ffmpeg ? 'Ready' : 'Missing'
        }`
      );
    } catch (err) {
      setHealthInfo(null);
      setConnectionState('error');
      setErrorMessage(err.message || 'Connection failed');
      Alert.alert(
        'Connection Failed',
        `Could not reach ${cleaned}/health: ${err.message}`
      );
    }
  };

  const handleClearShelf = () => {
    confirmAction(
      'Clear Local Shelf',
      'Remove all saved books from this device? Files stored on the backend server will remain untouched.',
      clearAudiobooks,
      'Clear'
    );
  };

  const statusDotColor = {
    connected: theme.colors.success,
    error: theme.colors.destructive,
    testing: theme.colors.warning,
    idle: theme.colors.labelTertiary,
  }[connectionState];

  const statusText =
    connectionState === 'connected' && healthInfo
      ? `Connected · ${healthInfo.cleaner} · ${healthInfo.default_voice}`
      : connectionState === 'error'
      ? `Unreachable · ${errorMessage}`
      : connectionState === 'testing'
      ? 'Testing connection…'
      : 'Not tested yet';

  return (
    <HIGScreen title="Settings">
      <View style={styles.sectionsStack}>
        <HIGGroupedSection
          title="Appearance"
          footer="System automatically matches your device's Light or Dark mode."
        >
          <HIGGroupedRow showDivider={false}>
            <View style={styles.controlBlock}>
              <View style={styles.rowHeader}>
                <View
                  style={[
                    styles.iconBadge,
                    continuousCurve,
                    { backgroundColor: theme.colors.accentTint },
                  ]}
                >
                  <Ionicons name="contrast-outline" size={18} color={theme.colors.accent} />
                </View>
                <Text style={[Typography.headline, { color: theme.colors.labelPrimary }]}>
                  Theme
                </Text>
              </View>

              <HIGSegmentedControl
                options={THEME_OPTIONS}
                value={themePreference}
                onChange={setThemePreference}
                accessibilityLabel="App appearance"
              />
            </View>
          </HIGGroupedRow>
        </HIGGroupedSection>

        <HIGGroupedSection
          title="Narration"
          footer="Default speed applied when generating new audiobooks."
        >
          <HIGGroupedRow showDivider={false}>
            <View style={styles.controlBlock}>
              <View style={styles.rowHeader}>
                <View
                  style={[
                    styles.iconBadge,
                    continuousCurve,
                    { backgroundColor: theme.colors.accentTint },
                  ]}
                >
                  <Ionicons name="speedometer-outline" size={18} color={theme.colors.accent} />
                </View>
                <Text style={[Typography.headline, { color: theme.colors.labelPrimary }]}>
                  Default Speed
                </Text>
              </View>

              <HIGSegmentedControl
                tabular
                options={SPEED_OPTIONS}
                value={defaultNarrationSpeed}
                onChange={setDefaultNarrationSpeed}
                accessibilityLabel="Default narration speed"
              />
            </View>
          </HIGGroupedRow>
        </HIGGroupedSection>

        <View>
          <HIGGroupedSection
            title="AI Backend Server"
            footer="Use http://localhost:5002 on simulator or web, or your computer's LAN IP on a phone."
          >
            <HIGGroupedRow showDivider dividerInset={16}>
              <View style={styles.inputRow}>
                <Text
                  style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
                >
                  Server URL
                </Text>
                <TextInput
                  style={[
                    styles.urlInput,
                    {
                      fontFamily: Typography.monoFontFamily,
                      color: theme.colors.labelPrimary,
                    },
                    urlFocused
                      ? getWebFocusRingStyle(theme.colors.accent, true)
                      : webInputResetStyle,
                  ]}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  keyboardAppearance={theme.colorScheme}
                  placeholder="http://localhost:5002"
                  placeholderTextColor={theme.colors.labelTertiary}
                  accessibilityLabel="FastAPI Server URL"
                />
              </View>
            </HIGGroupedRow>

            <HIGGroupedRow showDivider={false}>
              <View style={styles.statusRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: statusDotColor }]}
                />
                <Text
                  style={[
                    Typography.footnote,
                    {
                      flex: 1,
                      color:
                        connectionState === 'error'
                          ? theme.colors.destructive
                          : connectionState === 'connected'
                          ? theme.colors.labelPrimary
                          : theme.colors.labelSecondary,
                    },
                  ]}
                >
                  {statusText}
                </Text>
              </View>
            </HIGGroupedRow>
          </HIGGroupedSection>

          <HIGButton
            variant="primary"
            fullWidth
            loading={connectionState === 'testing'}
            title={
              connectionState === 'testing'
                ? 'Testing Connection…'
                : 'Save & Test Connection'
            }
            onPress={handleSaveAndTestServer}
            style={styles.testButton}
          />
        </View>

        <HIGGroupedSection title="About">
          <HIGGroupedRow showDivider dividerInset={16}>
            <View style={styles.keyValueRow}>
              <Text style={[Typography.body, { color: theme.colors.labelPrimary }]}>
                Version
              </Text>
              <Text
                style={[
                  Typography.body,
                  Typography.tabularNums,
                  { color: theme.colors.labelSecondary },
                ]}
              >
                1.0.0
              </Text>
            </View>
          </HIGGroupedRow>

          <HIGGroupedRow showDivider={audiobooks.length > 0} dividerInset={16}>
            <View style={styles.keyValueRow}>
              <Text style={[Typography.body, { color: theme.colors.labelPrimary }]}>
                Saved Books
              </Text>
              <Text
                style={[
                  Typography.body,
                  Typography.tabularNums,
                  { color: theme.colors.labelSecondary },
                ]}
              >
                {audiobooks.length}
              </Text>
            </View>
          </HIGGroupedRow>

          {audiobooks.length > 0 && (
            <HIGGroupedRow showDivider={false}>
              <PressableScale
                onPress={handleClearShelf}
                accessibilityLabel="Clear local shelf"
                style={styles.destructiveRow}
              >
                <Text
                  style={[Typography.body, { color: theme.colors.destructive }]}
                >
                  Clear Local Shelf
                </Text>
              </PressableScale>
            </HIGGroupedRow>
          )}
        </HIGGroupedSection>
      </View>
    </HIGScreen>
  );
}

const styles = StyleSheet.create({
  sectionsStack: {
    gap: Spacing.xl,
  },
  controlBlock: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radii.pillItem,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  urlInput: {
    minHeight: 44,
    fontSize: 15,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pillItem,
  },
  statusRow: {
    minHeight: 44,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  testButton: {
    marginTop: Spacing.md,
  },
  keyValueRow: {
    minHeight: 48,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  destructiveRow: {
    minHeight: 48,
    paddingHorizontal: Spacing.base,
    justifyContent: 'center',
  },
});
