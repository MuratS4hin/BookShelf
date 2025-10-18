import { StyleSheet, Dimensions } from 'react-native';

// Tema Renkleri
export const Colors = {
    // Ana Tema
    primary: '#1193d4',
    secondaryPrimary: '#FF9800', // Sesli Kitap Sayfası için özel renk
    backgroundLight: '#f6f7f8',
    backgroundDark: '#101c22',

    // Metin ve Gray Tonları
    textLight: '#f6f7f8',
    textDark: '#101c22',
    slate800: '#1f2937', // koyu mod başlık
    slate900: '#0f172a', // koyu mod başlık
    slate100: '#f1f5f9', // açık mod metin
    slate300: '#cbd5e1', // açık mod metin
    slate400: '#94a3b8', // gri metin
    slate500: '#64748b', // gri metin
    slate600: '#475569', // gri metin
};

// Ortak Stil Fonksiyonu
export const getThemeStyles = (colorScheme) => ({
    container: {
        flex: 1,
        backgroundColor: colorScheme === 'dark' ? Colors.backgroundDark : Colors.backgroundLight,
    },
    headerBackground: {
        backgroundColor: colorScheme === 'dark' ? 'rgba(16, 28, 34, 0.8)' : 'rgba(246, 247, 248, 0.8)',
        // RN'de backdrop-filter yerine blurRadius kullanılır, ancak basitçe arka planı kullanıyorum.
    },
    textPrimary: {
        color: colorScheme === 'dark' ? Colors.textLight : Colors.textDark,
    },
    textSecondary: {
        color: colorScheme === 'dark' ? Colors.slate400 : Colors.slate600,
    },
});