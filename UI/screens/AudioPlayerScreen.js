import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av'; // Ses oynatmak için expo-av'yi içeri aktar
import { Colors } from '../utils/ThemeStyles';

const primaryColor = Colors.secondaryPrimary; // FF9800
const SKIP_INTERVAL_MS = 10000; // 10 saniye (milisananiye cinsinden)

// route prop'u ile HomeScreen'den gelen veriyi alıyoruz
const AudioPlayerScreen = ({ route, navigation }) => {
    // Navigasyondan gelen kitap verisini veya varsayılan veriyi al
    const book = route.params?.bookData;

    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // İlk yükleme, sesin belleğe alınması
    const [isLoadInitial, setIsLoadInitial] = useState(true);
    // Sesin arabelleğe alınması
    const [isBuffering, setIsBuffering] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Oynatma hızı

    // Oynatma Durumunu Güncelleme
    const onPlaybackStatusUpdate = (status) => {
        setIsPlaying(status.isPlaying);
        setDuration(status.durationMillis || 0);
        setPosition(status.positionMillis || 0);
        setIsBuffering(status.isBuffering);

        if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
        }
    };

    // Ses yükleme ve başlatma (Component yüklendiğinde çalışır)
    useEffect(() => {
        // Ses yolu yoksa oynatıcıyı yüklemeyi durdur
        if (!book?.audioPath) {
            setIsLoadInitial(false);
            Alert.alert("Hata", "Bu kitap için ses dosyası bulunamadı.");
            return;
        }

        const loadAudio = async () => {
            setIsLoadInitial(true);
            try {
                // Playback modunu ayarlama
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    staysActiveInBackground: false,
                    playThroughEarpieceAndroid: false,
                });

                // Audio.Sound objesi oluştur ve yükle
                const { sound } = await Audio.Sound.createAsync(
                    { uri: book.audioPath },
                    { shouldPlay: false, rate: playbackSpeed, isMuted: false, volume: 1.0 },
                    onPlaybackStatusUpdate
                );
                setSound(sound);
                setIsLoadInitial(false);
            } catch (error) {
                console.error('Ses yüklenirken hata oluştu:', error);
                Alert.alert("Yükleme Hatası", "Ses dosyası yüklenemedi. Dosya yolu geçersiz olabilir.");
                setIsLoadInitial(false);
            }
        };

        loadAudio();

        // Temizleme: Component kapatıldığında sesi bellekten sil
        return sound
            ? () => {
                console.log('Unloading Sound');
                sound.unloadAsync();
            }
            : undefined;
    }, [book?.audioPath]); // book?.audioPath'i dependency olarak ekledim

    // Oynatma/Durdurma İşlevi
    const handlePlayPause = async () => {
        if (!sound || isLoadInitial || isBuffering) return;

        try {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
        } catch (e) {
            console.error("Oynatma Hatası:", e);
        }
    };

    // ✅ YENİ: İleri/Geri Sarma İşlevi
    const handleSkip = async (direction) => {
        if (!sound || disabled) return;

        const newPosition = position + (direction * SKIP_INTERVAL_MS);

        // Zaman sınırlarını kontrol et
        const finalPosition = Math.min(Math.max(0, newPosition), duration);

        try {
            await sound.setPositionAsync(finalPosition);
        } catch (e) {
            console.error("Sarma Hatası:", e);
        }
    };

    // Hız Değiştirme İşlevi
    const handleSpeedChange = async (rate) => {
        setPlaybackSpeed(rate);
        if (sound) {
            await sound.setRateAsync(rate, true);
        }
    };

    // Zaman Formatlama
    const formatTime = (millis) => {
        if (millis === 0) return "0:00";
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

    // İlerleme çubuğu pozisyonu
    const currentProgressPercent = duration > 0 ? (position / duration) * 100 : 0;
    const playIcon = isPlaying ? "pause" : "play-arrow";
    // Ses dosyası ve başlangıç yüklemesi kontrolü
    const disabled = isLoadInitial || !book?.audioPath;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="keyboard-arrow-down" size={32} color="white" />
                </TouchableOpacity>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' }}>Now Playing</Text>
                <TouchableOpacity style={styles.headerButton}>
                    {/* <MaterialIcons name="more-vert" size={24} color="white" /> */}
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
                {/* Cover Art */}
                <Image
                    source={{ uri: book.imageUrl }}
                    style={styles.coverArt}
                    resizeMode="cover"
                />

                {/* Book Info */}
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.author}>{book.author}</Text>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    {(isLoadInitial || isBuffering) && duration === 0 ? (
                        <ActivityIndicator size="small" color={primaryColor} />
                    ) : (
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFilled, { width: `${currentProgressPercent}%` }]} />
                            <View style={[styles.progressKnob, { left: `${currentProgressPercent}%`, marginLeft: -8 }]} />
                            <View style={{ height: 6, flex: 1, borderRadius: 3, backgroundColor: Colors.slate600 }} />
                        </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ color: Colors.slate400, fontSize: 12 }}>{formatTime(position)}</Text>
                        <Text style={{ color: Colors.slate400, fontSize: 12 }}>{formatTime(duration)}</Text>
                    </View>
                </View>

                {/* Playback Controls */}
                <View style={styles.controlButtons}>
                    {/* ✅ Geri Sarma (-10 saniye) */}
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => handleSkip(-1)} // -1, geri sarma yönünü belirtir
                        disabled={disabled}
                    >
                        <MaterialIcons name="replay-10" size={36} color={disabled ? Colors.slate700 : "rgba(255, 255, 255, 0.8)"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.playPauseButton}
                        onPress={handlePlayPause}
                        disabled={disabled}
                    >
                        {isLoadInitial || isBuffering ? (
                            <ActivityIndicator size="large" color={Colors.backgroundDark} />
                        ) : (
                            <MaterialIcons name={playIcon} size={50} color={Colors.backgroundDark} />
                        )}
                    </TouchableOpacity>
                    {/* ✅ İleri Sarma (+10 saniye) */}
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => handleSkip(1)} // 1, ileri sarma yönünü belirtir
                        disabled={disabled}
                    >
                        <MaterialIcons name="forward-10" size={36} color={disabled ? Colors.slate700 : "rgba(255, 255, 255, 0.8)"} />
                    </TouchableOpacity>
                </View>

                {/* Additional Controls */}
                <View style={styles.speedVolumeContainer}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                        {/* <MaterialIcons name="volume-up" size={20} color={Colors.slate400} /> */}
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                        {[{ rate: 0.75, label: '0.75x' }, { rate: 1.0, label: '1x' }, { rate: 1.5, label: '1.5x' }, { rate: 2.0, label: '2x' }].map((speedOption, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.speedOption, speedOption.rate === playbackSpeed && { backgroundColor: Colors.slate700 }]}
                                onPress={() => handleSpeedChange(speedOption.rate)}
                                disabled={disabled}
                            >
                                <Text style={[styles.speedText, { color: speedOption.rate === playbackSpeed ? primaryColor : Colors.slate400 }]}>
                                    {speedOption.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                        {/* <MaterialIcons name="timer" size={20} color={Colors.slate400} /> */}
                    </TouchableOpacity>
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
        paddingTop: 32,
        paddingBottom: 16,
    },
    coverArt: {
        width: '100%',
        maxWidth: 384,
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: Colors.slate600,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    title: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 32,
        textAlign: 'center',
    },
    author: {
        color: Colors.slate400,
        fontSize: 16,
        marginTop: 4,
        textAlign: 'center',
    },
    progressBarContainer: {
        width: '100%',
        maxWidth: 384,
        marginTop: 32,
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
        marginTop: 32,
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
        marginTop: 16,
    },
    speedOption: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    speedText: {
        fontSize: 14,
        fontWeight: '500',
    }
});