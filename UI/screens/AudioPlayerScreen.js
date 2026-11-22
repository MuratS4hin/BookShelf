import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { RotateCcw, RotateCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HIGButton from '../components/hig/HIGButton';
import HIGSegmentedControl from '../components/hig/HIGSegmentedControl';
import PressableScale from '../components/hig/PressableScale';
import AudiobookGenerator, { STAGE_LABELS } from '../services/AudiobookGenerator';
import LocalLibraryStorage from '../services/LocalLibraryStorage';
import useAppStore from '../store/UseAppStore';
import {
  continuousCurve,
  Radii,
  Spacing,
  Typography,
  useHIGTheme,
} from '../theme/hig';
import { formatBytes } from '../utils/helpers';

const SKIP_INTERVAL_MS = 10000;
const PROGRESS_SAVE_INTERVAL_MS = 5000;

const SPEED_OPTIONS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2x' },
];

export default function AudioPlayerScreen({ route, navigation }) {
  const theme = useHIGTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const paramBook = route.params?.bookData || {};
  const storedBook = useAppStore((state) =>
    state.audiobooks.find((b) => String(b.id) === String(paramBook.id))
  );
  const serverUrl = useAppStore((state) => state.serverUrl);
  const updateAudiobook = useAppStore((state) => state.updateAudiobook);
  const book = storedBook || paramBook;

  const soundRef = useRef(null);
  const latestPositionRef = useRef(book.lastPositionMs || 0);
  const lastSavedAtRef = useRef(0);

  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadInitial, setIsLoadInitial] = useState(Boolean(book?.audioPath));
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(book.lastPositionMs || 0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [trackWidth, setTrackWidth] = useState(0);

  // Local cover resolution
  const [coverUri, setCoverUri] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Cleaned text reader state (read directly from local device storage)
  const [showText, setShowText] = useState(false);
  const [cleanedText, setCleanedText] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  const hasAudio = Boolean(book?.audioPath);
  const isProcessing = book?.status === 'processing';
  const isFailed = book?.status === 'failed';

  const persistPosition = (positionMs) => {
    if (!book?.id) return;
    updateAudiobook(book.id, { lastPositionMs: Math.max(0, Math.round(positionMs || 0)) });
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setDuration(status.durationMillis || 0);
    const pos = status.positionMillis || 0;
    setPosition(pos);
    latestPositionRef.current = pos;
    setIsBuffering(status.isBuffering);

    if (status.isPlaying) {
      const now = Date.now();
      if (now - lastSavedAtRef.current >= PROGRESS_SAVE_INTERVAL_MS) {
        lastSavedAtRef.current = now;
        persistPosition(pos);
      }
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      latestPositionRef.current = 0;
      persistPosition(0);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let revokeCover = () => {};
    setImageError(false);

    if (!book?.imageUrl) {
      setCoverUri(null);
      return undefined;
    }

    LocalLibraryStorage.resolveCoverUri(book)
      .then((res) => {
        if (!isMounted) {
          res.revoke?.();
          return;
        }
        revokeCover = res.revoke || (() => {});
        setCoverUri(res.uri || null);
      })
      .catch(() => {
        if (isMounted) setCoverUri(null);
      });

    return () => {
      isMounted = false;
      revokeCover();
    };
  }, [book?.id, book?.imageUrl]);

  useEffect(() => {
    let isMounted = true;
    let revokeAudio = () => {};

    if (!book?.audioPath) {
      setIsLoadInitial(false);
      return undefined;
    }

    const loadAudio = async () => {
      setIsLoadInitial(true);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        const resolved = await LocalLibraryStorage.resolveAudioUri(book);
        if (!isMounted) {
          resolved.revoke?.();
          return;
        }
        revokeAudio = resolved.revoke || (() => {});

        const initialPos = book.lastPositionMs || 0;
        const { sound: createdSound } = await Audio.Sound.createAsync(
          { uri: resolved.uri },
          {
            shouldPlay: false,
            positionMillis: initialPos,
            rate: playbackSpeed,
            isMuted: false,
            volume: 1.0,
          },
          onPlaybackStatusUpdate
        );

        if (!isMounted) {
          await createdSound.unloadAsync();
          return;
        }
        soundRef.current = createdSound;
        setSound(createdSound);
        setIsLoadInitial(false);
      } catch (error) {
        console.error('Error loading local audio:', error);
        if (isMounted) {
          Alert.alert(
            'Playback Error',
            error.message || 'Could not load audiobook from device storage.'
          );
          setIsLoadInitial(false);
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (book?.audioPath) {
        persistPosition(latestPositionRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      revokeAudio();
    };
  }, [book?.id, book?.audioPath]);

  const handleCreateAudio = async () => {
    try {
      await AudiobookGenerator.generateForBook(book.id);
    } catch (err) {
      Alert.alert(
        'Conversion Failed',
        `${err.message || 'Could not create audio.'}\n\nServer: ${serverUrl}`
      );
    }
  };

  const handleToggleText = async () => {
    const nextState = !showText;
    setShowText(nextState);
    if (nextState && !cleanedText) {
      setLoadingText(true);
      try {
        const txt = await LocalLibraryStorage.readCleanedText(book);
        setCleanedText(txt);
      } catch (err) {
        setCleanedText(`Cleaned text unavailable: ${err.message}`);
      } finally {
        setLoadingText(false);
      }
    }
  };

  const disabled = isLoadInitial || !hasAudio;

  const handlePlayPause = async () => {
    if (!sound || isLoadInitial || isBuffering) return;
    try {
      if (isPlaying) {
        await sound.pauseAsync();
        persistPosition(latestPositionRef.current);
      } else {
        await sound.playAsync();
      }
    } catch (e) {
      console.error('Playback Error:', e);
    }
  };

  const handleSkip = async (direction) => {
    if (!sound || disabled) return;
    const newPosition = position + direction * SKIP_INTERVAL_MS;
    const finalPosition = Math.min(Math.max(0, newPosition), duration);
    try {
      await sound.setPositionAsync(finalPosition);
      latestPositionRef.current = finalPosition;
      persistPosition(finalPosition);
    } catch (e) {
      console.error('Seek Error:', e);
    }
  };

  const handleSpeedChange = async (rate) => {
    setPlaybackSpeed(rate);
    if (sound) {
      try {
        await sound.setRateAsync(rate, true);
      } catch (e) {
        console.error('Rate Error:', e);
      }
    }
  };

  const handleSeekPress = async (e) => {
    if (!sound || disabled || duration <= 0 || trackWidth <= 0) return;
    const x = e?.nativeEvent?.locationX ?? 0;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const targetMs = Math.round(ratio * duration);
    try {
      await sound.setPositionAsync(targetMs);
      latestPositionRef.current = targetMs;
      persistPosition(targetMs);
    } catch (err) {
      console.error('Seek Error:', err);
    }
  };

  const formatTime = (millis) => {
    if (!millis || millis <= 0) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    if (hours > 0) {
      const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    }
    return `${minutes}:${paddedSeconds}`;
  };

  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const thumbLeft =
    trackWidth > 14 ? Math.max(0, Math.min(trackWidth - 14, progressRatio * trackWidth - 7)) : 0;
  const showCover = Boolean(coverUri) && !imageError;
  const fileLabel = (book.fileType || 'PDF').toUpperCase();
  const sizeStr = book.localSizeBytes > 0 ? formatBytes(book.localSizeBytes) : null;
  const isPdfOnly = fileLabel === 'PDF' && !hasAudio;
  const stageLabel = STAGE_LABELS[book.stage] || 'Processing…';

  const sheetContent = (
    <View
      style={[
        styles.sheetBase,
        isWide
          ? [
              styles.sheetDesktop,
              continuousCurve,
              {
                backgroundColor: theme.colors.surfaceSheet,
                borderColor: theme.colors.separator,
              },
            ]
          : {
              flex: 1,
              backgroundColor: theme.colors.surfaceSheet,
              paddingTop: insets.top + Spacing.sm,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
      ]}
    >
      <View
        style={[
          styles.grabber,
          { backgroundColor: theme.colors.labelTertiary },
        ]}
      />

      <View accessibilityRole="header" style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close player"
          style={styles.headerButton}
        >
          <Ionicons name="chevron-down" size={26} color={theme.colors.labelPrimary} />
        </PressableScale>

        <Text
          numberOfLines={1}
          style={[Typography.headline, { color: theme.colors.labelPrimary }]}
        >
          {hasAudio ? 'Now Playing' : 'Document'}
        </Text>

        {hasAudio || book.textPath ? (
          <PressableScale
            onPress={handleToggleText}
            accessibilityLabel={showText ? 'Show cover art' : 'Show cleaned text'}
            accessibilityState={{ selected: showText }}
            style={styles.headerButton}
          >
            <Ionicons
              name={showText ? 'document-text' : 'document-text-outline'}
              size={22}
              color={showText ? theme.colors.accent : theme.colors.labelPrimary}
            />
          </PressableScale>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <View style={styles.mainContent}>
        {showText ? (
          <View style={styles.readerWrapper}>
            <View style={styles.compactMeta}>
              <Text
                numberOfLines={1}
                style={[Typography.headline, { color: theme.colors.labelPrimary }]}
              >
                {book.title || 'Untitled Book'}
              </Text>
              <Text
                numberOfLines={1}
                style={[Typography.footnote, { color: theme.colors.labelSecondary }]}
              >
                {book.author || 'AI Narrator'}
              </Text>
            </View>

            <View
              style={[
                styles.readerBox,
                continuousCurve,
                {
                  backgroundColor: theme.isDark
                    ? theme.colors.surfaceElevated
                    : theme.colors.surfaceSecondary,
                  borderColor: theme.colors.separator,
                },
              ]}
            >
              <Text
                style={[
                  Typography.footnote,
                  {
                    fontWeight: '600',
                    color: theme.colors.accent,
                    marginBottom: Spacing.md,
                  },
                ]}
              >
                DNN-Cleaned Transcript (Stored on Device)
              </Text>

              {loadingText ? (
                <View style={styles.readerLoading}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                </View>
              ) : (
                <ScrollView
                  style={styles.readerScroll}
                  contentContainerStyle={styles.readerScrollContent}
                >
                  <Text
                    style={[
                      Typography.body,
                      {
                        lineHeight: 26,
                        color: theme.colors.labelPrimary,
                        maxWidth: 600,
                        width: '100%',
                      },
                    ]}
                  >
                    {cleanedText || 'No cleaned text stored for this book.'}
                  </Text>
                </ScrollView>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.coverSection}>
            <View style={styles.coverCentered}>
              <View
                style={[
                  styles.coverFrame,
                  continuousCurve,
                  !theme.isDark && styles.coverLightShadow,
                  {
                    backgroundColor: theme.colors.surfaceInset,
                    borderColor: theme.colors.separator,
                  },
                ]}
              >
                {showCover ? (
                  <Image
                    source={{ uri: coverUri }}
                    style={styles.coverArt}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <Ionicons
                    name={isPdfOnly ? 'document-text-outline' : 'book-outline'}
                    size={56}
                    color={theme.colors.labelSecondary}
                  />
                )}
              </View>
            </View>

            <View style={styles.titleMetaBlock}>
              <Text
                numberOfLines={2}
                style={[
                  Typography.title2,
                  styles.bookTitle,
                  { color: theme.colors.labelPrimary },
                ]}
              >
                {book.title || 'Untitled Book'}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  Typography.callout,
                  styles.bookAuthor,
                  { color: theme.colors.labelSecondary },
                ]}
              >
                {book.author || (hasAudio ? 'AI Narrator' : `${fileLabel} Document`)}
              </Text>
              {!hasAudio && (
                <>
                  <Text
                    style={[
                      Typography.footnote,
                      Typography.tabularNums,
                      styles.docSizeLine,
                      { color: theme.colors.labelSecondary },
                    ]}
                  >
                    {[fileLabel, sizeStr].filter(Boolean).join(' · ')}
                  </Text>
                  <Text
                    style={[
                      Typography.subheadlineRegular,
                      styles.docPromptNote,
                      { color: theme.colors.labelSecondary },
                    ]}
                  >
                    Saved on this device. Run the DNN cleaner and Neural TTS to generate an offline audiobook.
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {hasAudio ? (
          <View style={styles.controlsSection}>
            <View style={styles.scrubberBlock}>
              <Pressable
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                onPress={handleSeekPress}
                disabled={disabled || duration <= 0}
                accessibilityRole="adjustable"
                accessibilityLabel="Playback position"
                accessibilityValue={{
                  min: 0,
                  max: Math.round(duration / 1000),
                  now: Math.round(position / 1000),
                  text: formatTime(position),
                }}
                style={styles.scrubberHitArea}
              >
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: theme.colors.surfaceInset },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFilled,
                      {
                        backgroundColor: theme.colors.accent,
                        width: `${progressRatio * 100}%`,
                      },
                    ]}
                  />
                  {duration > 0 && (
                    <View
                      style={[
                        styles.progressThumb,
                        {
                          backgroundColor: theme.colors.accent,
                          left: thumbLeft,
                        },
                      ]}
                    />
                  )}
                </View>
              </Pressable>

              <View style={styles.timeRow}>
                <Text
                  style={[
                    Typography.caption,
                    Typography.tabularNums,
                    { color: theme.colors.labelSecondary },
                  ]}
                >
                  {formatTime(position)}
                </Text>
                <Text
                  style={[
                    Typography.caption,
                    Typography.tabularNums,
                    { color: theme.colors.labelSecondary },
                  ]}
                >
                  {formatTime(duration)}
                </Text>
              </View>
            </View>

            <View style={styles.transportRow}>
              <PressableScale
                onPress={() => handleSkip(-1)}
                disabled={disabled}
                accessibilityLabel="Rewind 10 seconds"
                style={styles.skipButton}
              >
                <View style={styles.skipIconWrap}>
                  <RotateCcw
                    size={30}
                    strokeWidth={1.75}
                    color={disabled ? theme.colors.labelTertiary : theme.colors.labelPrimary}
                  />
                  <Text
                    style={[
                      Typography.caption,
                      Typography.tabularNums,
                      styles.skipLabel,
                      {
                        color: disabled ? theme.colors.labelTertiary : theme.colors.labelPrimary,
                      },
                    ]}
                  >
                    10
                  </Text>
                </View>
              </PressableScale>

              <PressableScale
                onPress={handlePlayPause}
                disabled={disabled}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                style={[
                  styles.playPauseButton,
                  {
                    backgroundColor: disabled
                      ? theme.colors.fillSecondary
                      : theme.colors.accent,
                  },
                ]}
              >
                {isLoadInitial || isBuffering ? (
                  <ActivityIndicator size="large" color={theme.colors.accentOnFill} />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={34}
                    color={theme.colors.accentOnFill}
                    style={!isPlaying ? styles.playIconOffset : undefined}
                  />
                )}
              </PressableScale>

              <PressableScale
                onPress={() => handleSkip(1)}
                disabled={disabled}
                accessibilityLabel="Skip forward 10 seconds"
                style={styles.skipButton}
              >
                <View style={styles.skipIconWrap}>
                  <RotateCw
                    size={30}
                    strokeWidth={1.75}
                    color={disabled ? theme.colors.labelTertiary : theme.colors.labelPrimary}
                  />
                  <Text
                    style={[
                      Typography.caption,
                      Typography.tabularNums,
                      styles.skipLabel,
                      {
                        color: disabled ? theme.colors.labelTertiary : theme.colors.labelPrimary,
                      },
                    ]}
                  >
                    10
                  </Text>
                </View>
              </PressableScale>
            </View>

            <HIGSegmentedControl
              tabular
              options={SPEED_OPTIONS}
              value={playbackSpeed}
              onChange={handleSpeedChange}
              disabled={disabled}
              accessibilityLabel="Playback speed"
            />
          </View>
        ) : (
          <View style={styles.docGenerateSection}>
            {isProcessing && (
              <View style={styles.docProgressBlock}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: theme.colors.surfaceInset },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFilled,
                      {
                        backgroundColor: theme.colors.accent,
                        width: `${Math.max(0, Math.min(100, book.progress || 0))}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.docProgressTextRow}>
                  <Text
                    numberOfLines={2}
                    style={[
                      Typography.footnote,
                      { flex: 1, color: theme.colors.labelPrimary },
                    ]}
                  >
                    {stageLabel}
                  </Text>
                  <Text
                    style={[
                      Typography.footnote,
                      Typography.tabularNums,
                      { fontWeight: '600', color: theme.colors.accent },
                    ]}
                  >
                    {book.progress || 0}%
                  </Text>
                </View>
              </View>
            )}

            {isFailed && book.error ? (
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
                  {book.error}
                </Text>
              </View>
            ) : null}

            <HIGButton
              variant="primary"
              fullWidth
              loading={isProcessing}
              title={
                isProcessing
                  ? 'Creating Audiobook…'
                  : isFailed
                  ? 'Retry Audiobook'
                  : 'Clean with DNN & Create Audio'
              }
              icon={
                !isProcessing ? (
                  <Ionicons
                    name="sparkles-outline"
                    size={20}
                    color={theme.colors.accentOnFill}
                  />
                ) : null
              }
              onPress={handleCreateAudio}
            />
          </View>
        )}
      </View>
    </View>
  );

  if (isWide) {
    return (
      <View style={[styles.desktopBackdrop, { backgroundColor: theme.colors.scrim }]}>
        <Pressable
          accessibilityLabel="Close player"
          onPress={() => navigation.goBack()}
          style={StyleSheet.absoluteFillObject}
        />
        {sheetContent}
      </View>
    );
  }

  return sheetContent;
}

const styles = StyleSheet.create({
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
    maxWidth: 520,
    height: '88%',
    maxHeight: 740,
    borderRadius: Radii.modalDesktop,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    height: 48,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
  },
  coverSection: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: Spacing.base,
  },
  coverCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  coverFrame: {
    width: '100%',
    maxWidth: 280,
    aspectRatio: 1,
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLightShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  coverArt: {
    width: '100%',
    height: '100%',
  },
  titleMetaBlock: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  bookTitle: {
    textAlign: 'center',
  },
  bookAuthor: {
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  docSizeLine: {
    marginTop: Spacing.xs,
  },
  docPromptNote: {
    textAlign: 'center',
    maxWidth: 340,
    marginTop: Spacing.sm,
  },
  readerWrapper: {
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  compactMeta: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 2,
  },
  readerBox: {
    flex: 1,
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  readerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerScroll: {
    flex: 1,
  },
  readerScrollContent: {
    alignItems: 'center',
    paddingBottom: Spacing.base,
  },
  controlsSection: {
    paddingTop: Spacing.sm,
  },
  docGenerateSection: {
    paddingTop: Spacing.base,
    gap: Spacing.base,
  },
  docProgressBlock: {
    gap: Spacing.sm,
  },
  docProgressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radii.control,
  },
  scrubberBlock: {
    width: '100%',
  },
  scrubberHitArea: {
    height: 44,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    justifyContent: 'center',
    position: 'relative',
  },
  progressFilled: {
    height: 6,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    marginVertical: Spacing.base,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '700',
    paddingTop: 2,
  },
  playPauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconOffset: {
    marginLeft: 3,
  },
});
