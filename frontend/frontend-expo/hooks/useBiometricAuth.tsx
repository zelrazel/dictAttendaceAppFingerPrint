import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/apiUrl';

interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  enabled: boolean;
}

export function useBiometricAuth() {
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({
    available: false,
    enrolled: false,
    enabled: false,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    try {
      setLoading(true);
      
      // Check if hardware is available
      const compatible = await LocalAuthentication.hasHardwareAsync();
      
      // Check if biometrics are enrolled in the device
      const enrolled = compatible ? await LocalAuthentication.isEnrolledAsync() : false;
      
      // Get token for API request
      const token = await AsyncStorage.getItem('userToken');
      
      // Check if biometrics are enabled from the backend
      let enabled = false;
      if (token) {
        try {
          const response = await fetch(`${API_URL}/api/biometrics`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.ok) {
            const data = await response.json();
            enabled = data.biometricsEnabled || false;
            
            // Update local storage to match backend
            await AsyncStorage.setItem('biometricsEnabled', enabled ? 'true' : 'false');
          }
        } catch (err) {
          console.error('Error fetching biometric status from backend:', err);
          // Fallback to local storage if API fails
          const enabledStr = await AsyncStorage.getItem('biometricsEnabled');
          enabled = enabledStr === 'true';
        }
      } else {
        // Fallback to local storage if no token
        const enabledStr = await AsyncStorage.getItem('biometricsEnabled');
        enabled = enabledStr === 'true';
      }
      
      setBiometricStatus({
        available: compatible,
        enrolled,
        enabled,
      });
    } catch (error) {
      console.error('Error checking biometric status:', error);
    } finally {
      setLoading(false);
    }
  };

  const authenticate = async (promptMessage: string = 'Authenticate to continue', forceAuth: boolean = false): Promise<boolean> => {
    try {
      // Check if biometrics are available and enrolled
      if (!biometricStatus.available || !biometricStatus.enrolled) {
        return false;
      }

      // If this is a time tracking operation or force authentication is requested,
      // always require biometric authentication regardless of app settings
      const isTimeTrackingOperation = promptMessage.includes('time in') || promptMessage.includes('time out');
      
      // Check if biometrics are enabled for the app
      if (!biometricStatus.enabled && !isTimeTrackingOperation && !forceAuth) {
        // If not enabled and not a time tracking operation, allow the action without biometric authentication
        return true;
      }

      // Authenticate with biometrics
      // We disable device passcode fallback to ensure only the registered biometric (fingerprint/face)
      // is used for authentication, preventing authentication with device passcode when biometric fails
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: '', // Empty string disables fallback to device passcode
        disableDeviceFallback: true, // Explicitly disable device fallback
      });

      return result.success;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return false;
    }
  };

  const enableBiometrics = async (enable: boolean) => {
    try {
      await AsyncStorage.setItem('biometricsEnabled', enable ? 'true' : 'false');
      setBiometricStatus(prev => ({ ...prev, enabled: enable }));
      return true;
    } catch (error) {
      console.error('Error setting biometrics enabled status:', error);
      return false;
    }
  };

  // Generate a unique biometric ID for authentication
  const generateBiometricId = (): string => {
    // Generate a unique ID using timestamp and random string
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `bio_${timestamp}_${randomStr}`;
  };

  return {
    biometricStatus,
    loading,
    authenticate,
    enableBiometrics,
    checkBiometricStatus,
    generateBiometricId,
  };
}