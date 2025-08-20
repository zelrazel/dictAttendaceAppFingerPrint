import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Linking, Platform, Modal, TouchableOpacity } from 'react-native';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import * as Location from 'expo-location';

export default function BiometricsAuthScreen() {
  const { biometricStatus, loading } = useBiometricAuth();
  const [deviceLocationEnabled, setDeviceLocationEnabled] = useState(true);
  const [appLocationPermission, setAppLocationPermission] = useState(true);
  const [checkingLocation, setCheckingLocation] = useState(true);
  const [showDeviceLocationModal, setShowDeviceLocationModal] = useState(false);

  useEffect(() => {
    const checkLocation = async () => {
      setCheckingLocation(true);
      try {
        const deviceEnabled = await Location.hasServicesEnabledAsync();
        setDeviceLocationEnabled(deviceEnabled);
        if (!deviceEnabled) setShowDeviceLocationModal(true);
        const { status } = await Location.getForegroundPermissionsAsync();
        setAppLocationPermission(status === 'granted');
      } catch {
        setDeviceLocationEnabled(false);
        setAppLocationPermission(false);
      } finally {
        setCheckingLocation(false);
      }
    };
    checkLocation();
  }, []);

  let message = '';
  let biometricColor = '#2e7d32'; // green by default
  if (loading) {
    message = 'Checking biometric status...';
    biometricColor = '#666';
  } else if (!biometricStatus.available) {
    message = 'Biometric authentication is not available on this device.';
    biometricColor = '#c62828';
  } else if (!biometricStatus.enrolled) {
    message = 'No fingerprint is enrolled on this device. Please set up fingerprint in your device settings to use time in/out.';
    biometricColor = '#c62828';
  } else {
    message = 'Your device is ready for fingerprint authentication.';
    biometricColor = '#2e7d32';
  }

  const openLocationSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openURL('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
        Linking.openSettings();
      });
    } else {
      Linking.openSettings();
    }
  };

  const deviceStatusColor = deviceLocationEnabled ? '#2e7d32' : '#c62828';
  const appStatusColor = appLocationPermission ? '#2e7d32' : '#c62828';
  const needsSettings = !deviceLocationEnabled || !appLocationPermission;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication & Location</Text>
      {/* Authentication Status section */}
      <View style={styles.statusSection}>
        <Text style={styles.statusTitle}>Authentication Status</Text>
        <Text style={[styles.info, { color: biometricColor }]}>{message}</Text>
      </View>
      {/* Location section */}
      <View style={styles.locationSection}>
        <Text style={styles.locationTitle}>Location Status</Text>
        {checkingLocation ? (
          <Text style={styles.info}>Checking location status...</Text>
        ) : (
          <>
            <View style={styles.statusItem}>
              <Text style={[styles.statusLabel]}>Device Location:</Text>
              <Text style={[styles.statusValue, { color: deviceStatusColor }]}>{deviceLocationEnabled ? 'Enabled' : 'Disabled'}</Text>
            </View>
            {!deviceLocationEnabled && (
              <Text style={styles.warningLabel}>Please enable device location in your phone's settings for accurate time tracking.</Text>
            )}
            <View style={styles.statusItem}>
              <Text style={[styles.statusLabel]}>App Location Permission:</Text>
              <Text style={[styles.statusValue, { color: appStatusColor }]}>{appLocationPermission ? 'Granted' : 'Denied'}</Text>
            </View>
            {!appLocationPermission && (
              <Text style={styles.warningLabel}>Please allow location permission for this app. For best results, choose "Allow all the time".</Text>
            )}
            {/* Important Location Accuracy Warning */}
            <View style={styles.importantBox}>
              <Text style={styles.importantTitle}>Important:</Text>
              <Text style={styles.importantText}>
                Your location may still be inaccurate due to various factors such as bad weather, being indoors, tall buildings, or signal interference.
              </Text>
              <Text style={styles.importantText}>
                Turning on both <Text style={{ fontWeight: 'bold' }}>WiFi</Text> and <Text style={{ fontWeight: 'bold' }}>Mobile Data</Text> can help improve the accuracy of your location tracking.
              </Text>
            </View>
            {needsSettings && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.settingsButton} onPress={openLocationSettings}>
                  <Text style={styles.settingsButtonText}>Open Location Settings</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
      {/* Device Location Modal */}
      <Modal
        visible={showDeviceLocationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeviceLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>For a better experience, your device will need to use Location Accuracy</Text>
            <Text style={styles.modalSubtitle}>The following settings should be on:</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalIcon}>📍</Text>
              <Text style={styles.modalRowText}>Device location</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalIcon}>🎯</Text>
              <Text style={styles.modalRowText}>
                Location Accuracy, which provides more accurate location for apps and services. To do this, Google periodically processes information about device sensors and wireless signals from your device to crowdsource wireless signal locations. These are used without identifying you to improve location accuracy and location-based services and to improve, provide, and maintain Google’s services based on Google’s and third parties’ legitimate interests to serve users’ needs.
              </Text>
            </View>
            <Text style={styles.modalFooter}>You can change this at any time in location settings.</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowDeviceLocationModal(false)}>
                <Text style={styles.modalButtonText}>No thanks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={openLocationSettings}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Turn on</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  info: { marginTop: 10, color: '#666', fontSize: 16 },
  buttonContainer: { marginTop: 15 },
  statusSection: { 
    marginTop: 16, 
    marginBottom: 16, 
    backgroundColor: '#f0f0f5', 
    borderRadius: 8, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  locationSection: { 
    marginTop: 16, 
    backgroundColor: '#f0f0f5', 
    borderRadius: 8, 
    padding: 16,
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  warningLabel: { color: '#c62828', fontSize: 14, marginTop: 8, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%', maxWidth: 400, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalSubtitle: { fontSize: 16, fontWeight: '500', marginBottom: 10, textAlign: 'center' },
  modalRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  modalIcon: { fontSize: 22, marginRight: 8 },
  modalRowText: { flex: 1, fontSize: 14, color: '#333' },
  modalFooter: { fontSize: 13, color: '#666', marginTop: 10, marginBottom: 16, textAlign: 'center' },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalButton: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center', marginHorizontal: 5, backgroundColor: '#eee' },
  modalButtonPrimary: { backgroundColor: '#3f51b5' },
  modalButtonText: { fontWeight: 'bold', color: '#333', fontSize: 15 },
  modalButtonTextPrimary: { color: '#fff' },
  statusItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusLabel: { 
    fontSize: 16, 
    color: '#333',
    fontWeight: '500',
  },
  statusValue: { 
    fontSize: 16, 
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: '#3f51b5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importantBox: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 5,
    borderLeftColor: '#ff9800',
    padding: 12,
    marginTop: 16,
    borderRadius: 6,
    marginBottom: 4,
  },
  importantTitle: {
    color: '#b26a00',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 4,
  },
  importantText: {
    color: '#7c5a00',
    fontSize: 14,
    marginBottom: 2,
  },
});