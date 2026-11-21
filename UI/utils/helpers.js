import { Alert, Platform } from 'react-native';

/**
 * Cross-platform destructive confirmation dialog.
 * On Web, Alert.alert buttons are ignored by React Native Web, so fall back to window.confirm.
 */
export function confirmAction(title, message, onConfirm, confirmLabel = 'Delete') {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Format duration in seconds into compact Apple Books style readout.
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
