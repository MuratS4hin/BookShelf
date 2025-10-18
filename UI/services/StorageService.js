// StorageService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export default class StorageService {
  // Save data to storage
  static async setItem(key, value) {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  }

  // Get data from storage
  static async getItem(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error(`Error loading ${key}:`, e);
      return null;
    }
  }

  // Remove data
  static async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(`Error removing ${key}:`, e);
    }
  }

  // Clear all keys (use with caution!)
  static async clearAll() {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error('Error clearing storage:', e);
    }
  }
}
