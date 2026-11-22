import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HIGButton from '../components/hig/HIGButton';
import { HIGGroupedRow, HIGGroupedSection } from '../components/hig/HIGGroupedSection';
import HIGScreen from '../components/hig/HIGScreen';
import HIGSegmentedControl from '../components/hig/HIGSegmentedControl';
import PressableScale from '../components/hig/PressableScale';
import ApiService from '../services/ApiService';
import LocalLibraryStorage from '../services/LocalLibraryStorage';
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
import { confirmAction, formatBytes, getInitials } from '../utils/helpers';

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

export default function SettingsScreen({ navigation }) {
  const theme = useHIGTheme();

  const user = useAppStore((state) => state.user);
  const authToken = useAppStore((state) => state.authToken);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);
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

  const isSignedIn = Boolean(user && authToken);

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

  const handleSignOut = () => {
    confirmAction(
      'Sign Out',
      'Sign out of your account? Books and audio saved on this device will remain available.',
      clearAuthSession,
      'Sign Out'
    );
  };

  const handleClearShelf = () => {
    confirmAction(
      'Clear On-Device Library',
      'Delete all saved books, covers, and MP3 audiobooks from this device?',
      async () => {
        await LocalLibraryStorage.clearAllBookFiles().catch(() => {});
        clearAudiobooks();
      },
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

  const totalStorageBytes = LocalLibraryStorage.getTotalStorageBytes(audiobooks);
  const displayName = user?.full_name || user?.username || 'Signed In';

  return (
    <HIGScreen title="Settings">
      <View style={styles.sectionsStack}>
        <HIGGroupedSection
          title="Account"
          footer="Account sign-in is optional. Database connection is used only for login and sign-up."
        >
          {isSignedIn ? (
            <>
              <HIGGroupedRow showDivider dividerInset={72}>
                <View style={styles.accountRow}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: theme.colors.accentTint },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.headline,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {getInitials(user)}
                    </Text>
                  </View>
                  <View style={styles.accountMeta}>
                    <Text
                      numberOfLines={1}
                      style={[Typography.headline, { color: theme.colors.labelPrimary }]}
                    >
                      {displayName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
                    >
                      {user?.email || ''}
                      {user?.username ? ` · @${user.username}` : ''}
                    </Text>
                  </View>
                </View>
              </HIGGroupedRow>

              <HIGGroupedRow showDivider={false}>
                <PressableScale
                  onPress={handleSignOut}
                  accessibilityLabel="Sign out"
                  style={styles.destructiveRow}
                >
                  <Text style={[Typography.body, { color: theme.colors.destructive }]}>
                    Sign Out
                  </Text>
                </PressableScale>
              </HIGGroupedRow>
            </>
          ) : (
            <>
              <HIGGroupedRow showDivider dividerInset={72}>
                <PressableScale
                  onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
                  accessibilityLabel="Sign in"
                  style={styles.accountRow}
                >
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: theme.colors.accentTint },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={22}
                      color={theme.colors.accent}
                    />
                  </View>
                  <View style={styles.accountMeta}>
                    <Text
                      numberOfLines={1}
                      style={[Typography.headline, { color: theme.colors.accent }]}
                    >
                      Sign In
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
                    >
                      Optional account · Books stay on this device
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.labelTertiary}
                  />
                </PressableScale>
              </HIGGroupedRow>

              <HIGGroupedRow showDivider={false}>
                <PressableScale
                  onPress={() => navigation.navigate('Auth', { initialMode: 'signup' })}
                  accessibilityLabel="Create account"
                  style={styles.navigationRow}
                >
                  <Text style={[Typography.body, { color: theme.colors.accent }]}>
                    Create Account
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.labelTertiary}
                  />
                </PressableScale>
              </HIGGroupedRow>
            </>
          )}
        </HIGGroupedSection>

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
            footer="Used for account sign-in and temporary AI narration. Books and audio are saved directly on this device."
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

        <HIGGroupedSection title="On-Device Storage & About">
          <HIGGroupedRow showDivider dividerInset={16}>
            <View style={styles.keyValueRow}>
              <Text style={[Typography.body, { color: theme.colors.labelPrimary }]}>
                Storage
              </Text>
              <Text
                style={[
                  Typography.body,
                  { color: theme.colors.labelSecondary },
                ]}
              >
                On This Device
              </Text>
            </View>
          </HIGGroupedRow>

          <HIGGroupedRow showDivider dividerInset={16}>
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

          <HIGGroupedRow showDivider dividerInset={16}>
            <View style={styles.keyValueRow}>
              <Text style={[Typography.body, { color: theme.colors.labelPrimary }]}>
                Device Space Used
              </Text>
              <Text
                style={[
                  Typography.body,
                  Typography.tabularNums,
                  { color: theme.colors.labelSecondary },
                ]}
              >
                {formatBytes(totalStorageBytes)}
              </Text>
            </View>
          </HIGGroupedRow>

          <HIGGroupedRow showDivider={audiobooks.length > 0} dividerInset={16}>
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

          {audiobooks.length > 0 && (
            <HIGGroupedRow showDivider={false}>
              <PressableScale
                onPress={handleClearShelf}
                accessibilityLabel="Clear on-device library"
                style={styles.destructiveRow}
              >
                <Text
                  style={[Typography.body, { color: theme.colors.destructive }]}
                >
                  Clear On-Device Library
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
  accountRow: {
    minHeight: 68,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMeta: {
    flex: 1,
    gap: 2,
  },
  navigationRow: {
    minHeight: 48,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
