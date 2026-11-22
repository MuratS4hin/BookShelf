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

/**
 * Format byte size into compact human-readable storage readout.
 */
export function formatBytes(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  if (num < 1024) return `${Math.round(num)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = num / 1024;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

/**
 * Derive up to two uppercase initials from a user's display name, username, or email.
 */
export function getInitials(user) {
  const source = (user?.full_name || user?.username || user?.email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
