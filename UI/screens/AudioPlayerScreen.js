import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Colors } from '../utils/ThemeStyles';
import ApiService from '../services/ApiService';
import useAppStore from '../store/UseAppStore';

const primaryColor = Colors.secondaryPrimary;
const SKIP_INTERVAL_MS = 10000;

const AudioPlayerScreen = ({ route, navigation }) => {
  const book = route.params?.bookData || {};
  const serverUrl = useAppStore((state) => state.serverUrl);

  const soundRef = useRef(null);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadInitial, setIsLoadInitial] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Cleaned text reader state
  const [showText, setShowText] = useState(false);
  const [cleanedText, setCleanedText] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setDuration(status.durationMillis || 0);
    setPosition(status.positionMillis || 0);
    setIsBuffering(status.isBuffering);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!book?.audioPath) {
      setIsLoadInitial(false);
      Alert.alert('Audio Not Ready', 'No audio file is available for this book yet.');
      return;
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

        const { sound: createdSound } = await Audio.Sound.createAsync(
          { uri: book.audioPath },
          { shouldPlay: false, rate: playbackSpeed, isMuted: false, volume: 1.0 },
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
        console.error('Error loading audio:', error);
        if (isMounted) {
          Alert.alert('Playback Error', 'Could not load audiobook stream.');
          setIsLoadInitial(false);
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [book?.audioPath]);

  const handleToggleText = async () => {
    const nextState = !showText;
    setShowText(nextState);
    const targetBookId = book.bookId || book.id;
    if (nextState && !cleanedText && targetBookId) {
      setLoadingText(true);
      try {
        const txt = await ApiService.getCleanedText(targetBookId, serverUrl);
        setCleanedText(txt);
      } catch (err) {
        setCleanedText(`Cleaned text unavailable: ${err.message}`);
      } finally {
        setLoadingText(false);
      }
    }
  };

  const disabled = isLoadInitial || !book?.audioPath;

  const handlePlayPause = async () => {
    if (!sound || isLoadInitial || isBuffering) return;
    try {
      if (isPlaying) {
        await sound.pauseAsync();
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
    } catch (e) {
      console.error('Seek Error:', e);
    }
  };

  const handleSpeedChange = async (rate) => {
    setPlaybackSpeed(rate);
    if (sound) {
      await sound.setRateAsync(rate, true);
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

  const currentProgressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const playIcon = isPlaying ? 'pause' : 'play-arrow';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="keyboard-arrow-down" size={32} color="white" />
        </TouchableOpacity>
        <Text
          style={{
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
            flex: 1,
            textAlign: 'center',
          }}
        >
          Now Playing
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleToggleText}
        >
          <MaterialIcons
            name={showText ? 'album' : 'subject'}
            size={24}
            color={showText ? primaryColor : 'white'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {showText ? (
          <View style={styles.readerBox}>
            <Text style={styles.readerHeader}>
              DNN-Cleaned Book Text (Page numbers & noise removed)
            </Text>
            {loadingText ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.readerText}>
                  {cleanedText || 'No cleaned text available for this book.'}
                </Text>
              </ScrollView>
            )}
          </View>
        ) : (
          <Image
            source={{ uri: book.imageUrl }}
            style={styles.coverArt}
            resizeMode="cover"
          />
        )}

        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.author}>{book.author}</Text>

        <View style={styles.progressBarContainer}>
          {(isLoadInitial || isBuffering) && duration === 0 ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFilled,
                  { width: `${currentProgressPercent}%` },
                ]}
              />
              <View
                style={[
                  styles.progressKnob,
                  { left: `${currentProgressPercent}%`, marginLeft: -8 },
                ]}
              />
              <View
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 3,
                  backgroundColor: Colors.slate600,
                }}
              />
            </View>
          )}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <Text style={{ color: Colors.slate400, fontSize: 12 }}>
              {formatTime(position)}
            </Text>
            <Text style={{ color: Colors.slate400, fontSize: 12 }}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => handleSkip(-1)}
            disabled={disabled}
          >
            <MaterialIcons
              name="replay-10"
              size={36}
              color={disabled ? Colors.slate700 : 'rgba(255, 255, 255, 0.8)'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playPauseButton}
            onPress={handlePlayPause}
            disabled={disabled}
          >
            {isLoadInitial || isBuffering ? (
              <ActivityIndicator size="large" color={Colors.backgroundDark} />
            ) : (
              <MaterialIcons
                name={playIcon}
                size={50}
                color={Colors.backgroundDark}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => handleSkip(1)}
            disabled={disabled}
          >
            <MaterialIcons
              name="forward-10"
              size={36}
              color={disabled ? Colors.slate700 : 'rgba(255, 255, 255, 0.8)'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.speedVolumeContainer}>
          <TouchableOpacity onPress={handleToggleText}>
            <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>
              {showText ? 'Show Cover' : 'View Cleaned Text'}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {[
              { rate: 0.75, label: '0.75x' },
              { rate: 1.0, label: '1x' },
              { rate: 1.5, label: '1.5x' },
              { rate: 2.0, label: '2x' },
            ].map((speedOption, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.speedOption,
                  speedOption.rate === playbackSpeed && {
                    backgroundColor: Colors.slate700,
                  },
                ]}
                onPress={() => handleSpeedChange(speedOption.rate)}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.speedText,
                    {
                      color:
                        speedOption.rate === playbackSpeed
                          ? primaryColor
                          : Colors.slate400,
                    },
                  ]}
                >
                  {speedOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AudioPlayerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  headerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  mainContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  coverArt: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.slate600,
  },
  readerBox: {
    width: '100%',
    maxWidth: 384,
    height: 300,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  readerHeader: {
    color: primaryColor,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  readerText: {
    color: Colors.slate100,
    fontSize: 14,
    lineHeight: 21,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    textAlign: 'center',
  },
  author: {
    color: Colors.slate400,
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    maxWidth: 384,
    marginTop: 24,
  },
  progressBar: {
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressFilled: {
    height: 6,
    borderRadius: 3,
    backgroundColor: primaryColor,
  },
  progressKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: primaryColor,
    borderWidth: 4,
    borderColor: Colors.backgroundDark,
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 24,
    width: '100%',
    maxWidth: 384,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    width: 48,
    height: 48,
  },
  playPauseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    width: 80,
    height: 80,
    backgroundColor: primaryColor,
  },
  speedVolumeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 384,
    marginTop: 18,
  },
  speedOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  speedText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
