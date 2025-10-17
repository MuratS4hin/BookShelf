// screens/AudioBookPlayerScreen.js (Daha önce yaptığımız koyu temalı oynatıcı)

import React from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../utils/ThemeStyles';

const primaryColor = Colors.secondaryPrimary; // FF9800

const AudioBookPlayerScreen = ({ navigation }) => {
    const currentProgress = 50; 

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
            marginTop: 32,
        },
        speedOption: {
            paddingHorizontal: 8,
            paddingVertical: 4,
        }
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="keyboard-arrow-down" size={32} color="white" />
                </TouchableOpacity>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' }}>Now Playing</Text>
                <TouchableOpacity style={styles.headerButton}>
                    <MaterialIcons name="more-vert" size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
                {/* Cover Art */}
                <Image 
                    source={{ uri: "https://picsum.photos/id/7/384/384" }} 
                    style={styles.coverArt}
                    resizeMode="cover"
                />
                
                {/* Book Info */}
                <Text style={styles.title}>The Silent Patient</Text>
                <Text style={styles.author}>Alex Michaelides</Text>
                
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFilled, { width: `${currentProgress}%` }]} />
                        <View style={[styles.progressKnob, { left: `${currentProgress}%`, marginLeft: -8 }]} />
                        <View style={{ height: 6, flex: 1, borderRadius: 3, backgroundColor: Colors.slate600 }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ color: Colors.slate400, fontSize: 12 }}>1:23:45</Text>
                        <Text style={{ color: Colors.slate400, fontSize: 12 }}>3:45:12</Text>
                    </View>
                </View>

                {/* Playback Controls */}
                <View style={styles.controlButtons}>
                    <TouchableOpacity style={styles.skipButton}>
                        <MaterialIcons name="replay-10" size={36} color="rgba(255, 255, 255, 0.8)" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.playPauseButton}>
                        <MaterialIcons name="pause" size={50} color={Colors.backgroundDark} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.skipButton}>
                        <MaterialIcons name="forward-30" size={36} color="rgba(255, 255, 255, 0.8)" />
                    </TouchableOpacity>
                </View>

                {/* Additional Controls */}
                <View style={styles.speedVolumeContainer}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialIcons name="volume-up" size={20} color={Colors.slate400} />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {['0.75x', '1x', '1.5x', '2x'].map((speed, index) => (
                            <TouchableOpacity key={index} style={styles.speedOption}>
                                <Text style={{ fontSize: 14, fontWeight: '500', color: speed === '1x' ? primaryColor : Colors.slate400 }}>{speed}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialIcons name="timer" size={20} color={Colors.slate400} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default AudioBookPlayerScreen;