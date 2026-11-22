import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HIGButton from '../components/hig/HIGButton';
import { HIGGroupedRow, HIGGroupedSection } from '../components/hig/HIGGroupedSection';
import HIGSegmentedControl from '../components/hig/HIGSegmentedControl';
import PressableScale from '../components/hig/PressableScale';
import ApiService from '../services/ApiService';
import useAppStore from '../store/UseAppStore';
import {
  continuousCurve,
  getLayoutMetrics,
  getWebFocusRingStyle,
  Radii,
  Spacing,
  Typography,
  useHIGTheme,
  webInputResetStyle,
} from '../theme/hig';

const AUTH_MODES = [
  { value: 'login', label: 'Sign In' },
  { value: 'signup', label: 'Create Account' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen({ navigation, route }) {
  const theme = useHIGTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const metrics = getLayoutMetrics(width);
  const isWide = width >= 768;

  const initialMode = route?.params?.initialMode === 'signup' ? 'signup' : 'login';

  const serverUrl = useAppStore((state) => state.serverUrl);
  const setServerUrl = useAppStore((state) => state.setServerUrl);
  const setAuthSession = useAppStore((state) => state.setAuthSession);

  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Collapsible server configuration for physical phone / LAN usage
  const [serverExpanded, setServerExpanded] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [connectionState, setConnectionState] = useState('idle');
  const [connectionStatusText, setConnectionStatusText] = useState('Not tested yet');

  const handleClose = () => {
    navigation?.goBack();
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setErrorMsg('');
  };

  const handleSaveAndTestServer = async () => {
    const cleaned = (urlInput || 'http://localhost:5002').trim().replace(/\/+$/, '');
    setUrlInput(cleaned);
    setServerUrl(cleaned);
    setConnectionState('testing');
    setConnectionStatusText('Testing connection…');

    try {
      const info = await ApiService.getHealth(cleaned);
      setConnectionState('connected');
      setConnectionStatusText(`Connected · ${info.cleaner} · ${info.default_voice}`);
    } catch (err) {
      setConnectionState('error');
      setConnectionStatusText(`Unreachable · ${err.message || 'Connection failed'}`);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg('');

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();

    if (!EMAIL_RE.test(normalizedEmail)) {
      setErrorMsg('Enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (trimmedUsername.length < 2) {
        setErrorMsg('Username must be at least 2 characters.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
    } else if (!password) {
      setErrorMsg('Enter your password to sign in.');
      return;
    }

    const activeServerUrl = (urlInput || serverUrl || 'http://localhost:5002')
      .trim()
      .replace(/\/+$/, '');
    if (activeServerUrl !== serverUrl) {
      setServerUrl(activeServerUrl);
    }

    setSubmitting(true);
    try {
      const response =
        mode === 'signup'
          ? await ApiService.signup(
              {
                email: normalizedEmail,
                username: trimmedUsername,
                password,
                full_name: trimmedFullName || null,
              },
              activeServerUrl
            )
          : await ApiService.login(
              {
                email: normalizedEmail,
                password,
              },
              activeServerUrl
            );

      if (!response?.user || !response?.token) {
        throw new Error('Server returned an incomplete authentication response.');
      }
      setAuthSession(response.user, response.token);
      handleClose();
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Check your details and server connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusDotColor = {
    connected: theme.colors.success,
    error: theme.colors.destructive,
    testing: theme.colors.warning,
    idle: theme.colors.labelTertiary,
  }[connectionState];

  const sheetContent = (
    <View
      style={[
        styles.sheetBase,
        isWide
          ? [
              styles.sheetDesktop,
              continuousCurve,
              {
                backgroundColor: theme.colors.surfaceGroupedCanvas,
                borderColor: theme.colors.separator,
              },
            ]
          : {
              flex: 1,
              backgroundColor: theme.colors.surfaceGroupedCanvas,
              paddingTop: insets.top + Spacing.sm,
            },
      ]}
    >
      <View
        style={[
          styles.grabber,
          { backgroundColor: theme.colors.labelTertiary },
        ]}
      />

      <View
        accessibilityRole="header"
        style={[styles.sheetHeader, { borderBottomColor: theme.colors.separator }]}
      >
        <View style={styles.headerSideLeft}>
          <PressableScale
            onPress={handleClose}
            accessibilityLabel="Cancel"
            style={styles.cancelButton}
          >
            <Text style={[Typography.body, { color: theme.colors.accent }]}>
              Cancel
            </Text>
          </PressableScale>
        </View>

        <Text
          numberOfLines={1}
          style={[Typography.headline, { color: theme.colors.labelPrimary }]}
        >
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </Text>

        <View style={styles.headerSideRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="main"
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Spacing.xl,
              paddingBottom: Math.max(insets.bottom, Spacing.xl) + Spacing.xl,
              paddingHorizontal: isWide ? Spacing.xl : metrics.horizontalMargin,
            },
          ]}
        >
          <View style={styles.column}>
            <View style={styles.brandHeader}>
              <View
                style={[
                  styles.brandBadge,
                  continuousCurve,
                  { backgroundColor: theme.colors.accentTint },
                ]}
              >
                <Ionicons name="book" size={28} color={theme.colors.accent} />
              </View>
              <Text
                accessibilityRole="header"
                style={[Typography.title1, { color: theme.colors.labelPrimary }]}
              >
                Bookshelf
              </Text>
              <Text
                style={[
                  Typography.subheadlineRegular,
                  styles.brandSubtitle,
                  { color: theme.colors.labelSecondary },
                ]}
              >
                Sign in or create an account. Your books and audio stay privately on this device.
              </Text>
            </View>

            <HIGSegmentedControl
              options={AUTH_MODES}
              value={mode}
              onChange={handleModeChange}
              disabled={submitting}
              accessibilityLabel="Authentication mode"
              style={styles.modeControl}
            />

            <HIGGroupedSection>
              {mode === 'signup' && (
                <>
                  <HIGGroupedRow showDivider dividerInset={16}>
                    <View style={styles.fieldRow}>
                      <Text
                        style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
                      >
                        Full Name (Optional)
                      </Text>
                      <TextInput
                        style={[
                          Typography.body,
                          styles.input,
                          { color: theme.colors.labelPrimary },
                          focusedField === 'fullName'
                            ? getWebFocusRingStyle(theme.colors.accent, true)
                            : webInputResetStyle,
                        ]}
                        value={fullName}
                        onChangeText={setFullName}
                        onFocus={() => setFocusedField('fullName')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Jane Appleseed"
                        placeholderTextColor={theme.colors.labelTertiary}
                        autoCapitalize="words"
                        textContentType="name"
                        keyboardAppearance={theme.colorScheme}
                        accessibilityLabel="Full Name"
                      />
                    </View>
                  </HIGGroupedRow>

                  <HIGGroupedRow showDivider dividerInset={16}>
                    <View style={styles.fieldRow}>
                      <Text
                        style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
                      >
                        Username
                      </Text>
                      <TextInput
                        style={[
                          Typography.body,
                          styles.input,
                          { color: theme.colors.labelPrimary },
                          focusedField === 'username'
                            ? getWebFocusRingStyle(theme.colors.accent, true)
                            : webInputResetStyle,
                        ]}
                        value={username}
                        onChangeText={setUsername}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="jane_appleseed"
                        placeholderTextColor={theme.colors.labelTertiary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="username"
                        keyboardAppearance={theme.colorScheme}
                        accessibilityLabel="Username"
                      />
                    </View>
                  </HIGGroupedRow>
                </>
              )}

              <HIGGroupedRow showDivider dividerInset={16}>
                <View style={styles.fieldRow}>
                  <Text style={[Typography.footnote, { color: theme.colors.labelSecondary }]}>
                    Email
                  </Text>
                  <TextInput
                    style={[
                      Typography.body,
                      styles.input,
                      { color: theme.colors.labelPrimary },
                      focusedField === 'email'
                        ? getWebFocusRingStyle(theme.colors.accent, true)
                        : webInputResetStyle,
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.colors.labelTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    keyboardAppearance={theme.colorScheme}
                    accessibilityLabel="Email address"
                  />
                </View>
              </HIGGroupedRow>

              <HIGGroupedRow showDivider={false}>
                <View style={styles.fieldRow}>
                  <Text style={[Typography.footnote, { color: theme.colors.labelSecondary }]}>
                    Password
                  </Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[
                        Typography.body,
                        styles.input,
                        styles.passwordInput,
                        { color: theme.colors.labelPrimary },
                        focusedField === 'password'
                          ? getWebFocusRingStyle(theme.colors.accent, true)
                          : webInputResetStyle,
                      ]}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder={
                        mode === 'signup' ? 'At least 6 characters' : 'Enter password'
                      }
                      placeholderTextColor={theme.colors.labelTertiary}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                      returnKeyType="go"
                      onSubmitEditing={handleSubmit}
                      keyboardAppearance={theme.colorScheme}
                      accessibilityLabel="Password"
                    />
                    <PressableScale
                      onPress={() => setShowPassword((prev) => !prev)}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={theme.colors.labelSecondary}
                      />
                    </PressableScale>
                  </View>
                </View>
              </HIGGroupedRow>
            </HIGGroupedSection>

            {errorMsg ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.errorBanner,
                  continuousCurve,
                  { backgroundColor: theme.colors.destructiveTint },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={theme.colors.destructive}
                />
                <Text
                  style={[
                    Typography.footnote,
                    { flex: 1, color: theme.colors.destructive, fontWeight: '500' },
                  ]}
                >
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            <HIGButton
              variant="primary"
              fullWidth
              loading={submitting}
              title={mode === 'signup' ? 'Create Account' : 'Sign In'}
              onPress={handleSubmit}
              style={styles.submitButton}
            />

            <View style={styles.serverSection}>
              <PressableScale
                onPress={() => setServerExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Server settings"
                accessibilityState={{ expanded: serverExpanded }}
                style={[
                  styles.disclosureRow,
                  continuousCurve,
                  {
                    backgroundColor: theme.colors.surfaceCard,
                    borderColor: theme.colors.separator,
                  },
                ]}
              >
                <Ionicons
                  name="server-outline"
                  size={18}
                  color={theme.colors.labelSecondary}
                />
                <Text
                  style={[
                    Typography.subheadline,
                    { color: theme.colors.labelPrimary, flex: 1 },
                  ]}
                >
                  Server Settings
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    Typography.caption,
                    {
                      fontFamily: Typography.monoFontFamily,
                      color: theme.colors.labelSecondary,
                      maxWidth: 160,
                    },
                  ]}
                >
                  {urlInput}
                </Text>
                <Ionicons
                  name={serverExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.colors.labelSecondary}
                />
              </PressableScale>

              {serverExpanded && (
                <View style={styles.serverExpandedBox}>
                  <HIGGroupedSection footer="Use http://localhost:5002 on simulator or web, or your computer's LAN IP on a phone.">
                    <HIGGroupedRow showDivider dividerInset={16}>
                      <View style={styles.fieldRow}>
                        <Text
                          style={[
                            Typography.footnote,
                            { color: theme.colors.labelSecondary },
                          ]}
                        >
                          Server URL
                        </Text>
                        <TextInput
                          style={[
                            styles.serverInput,
                            {
                              fontFamily: Typography.monoFontFamily,
                              color: theme.colors.labelPrimary,
                            },
                            focusedField === 'serverUrl'
                              ? getWebFocusRingStyle(theme.colors.accent, true)
                              : webInputResetStyle,
                          ]}
                          value={urlInput}
                          onChangeText={setUrlInput}
                          onFocus={() => setFocusedField('serverUrl')}
                          onBlur={() => setFocusedField(null)}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                          keyboardAppearance={theme.colorScheme}
                          placeholder="http://localhost:5002"
                          placeholderTextColor={theme.colors.labelTertiary}
                          accessibilityLabel="Backend Server URL"
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
                          {connectionStatusText}
                        </Text>
                      </View>
                    </HIGGroupedRow>
                  </HIGGroupedSection>

                  <HIGButton
                    variant="secondary"
                    fullWidth
                    loading={connectionState === 'testing'}
                    title={
                      connectionState === 'testing'
                        ? 'Testing Connection…'
                        : 'Save & Test Connection'
                    }
                    onPress={handleSaveAndTestServer}
                  />
                </View>
              )}
            </View>

            <Text
              style={[
                Typography.footnote,
                styles.privacyFooter,
                { color: theme.colors.labelSecondary },
              ]}
            >
              Database connection is used only for account sign-in. Books, covers, and audio
              are stored on your device.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );

  if (isWide) {
    return (
      <View style={[styles.desktopBackdrop, { backgroundColor: theme.colors.scrim }]}>
        <Pressable
          accessibilityLabel="Close sign in"
          onPress={handleClose}
          style={StyleSheet.absoluteFillObject}
        />
        {sheetContent}
      </View>
    );
  }

  return sheetContent;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  desktopBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheetBase: {
    width: '100%',
  },
  sheetDesktop: {
    maxWidth: 480,
    height: '90%',
    maxHeight: 760,
    borderRadius: Radii.modalDesktop,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    overflow: 'hidden',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  sheetHeader: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSideRight: {
    flex: 1,
  },
  cancelButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: Spacing.xs,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: 440,
    gap: Spacing.base,
  },
  brandHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  brandSubtitle: {
    textAlign: 'center',
    maxWidth: 340,
  },
  modeControl: {
    marginBottom: Spacing.xs,
  },
  fieldRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  input: {
    minHeight: 44,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pillItem,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radii.control,
  },
  submitButton: {
    marginTop: Spacing.xs,
  },
  serverSection: {
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  disclosureRow: {
    minHeight: 44,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  serverExpandedBox: {
    gap: Spacing.md,
  },
  serverInput: {
    minHeight: 44,
    fontSize: 15,
    paddingVertical: Spacing.xs,
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
  privacyFooter: {
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
