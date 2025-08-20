import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { API_URL } from '@/constants/apiUrl';
import { getToken } from '@/utils/token';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';

interface BackendBiometricRecord {
  biometricId: string;
  name: string;
  createdAt: string;
}

interface BiometricRecord {
  id: string;
  name: string;
  createdAt: string;
  biometricId: string; // Adding this to match usage in the component
}

const BiometricsAuthentication = () => {
  const [loading, setLoading] = useState(false);
  const [biometrics, setBiometrics] = useState<BiometricRecord[]>([]);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const { biometricStatus, authenticate, enableBiometrics, checkBiometricStatus, generateBiometricId } = useBiometricAuth();

  // Fetch user's biometrics data
  const fetchBiometrics = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await axios.get(`${API_URL}/api/biometrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const backendRecords = response.data.biometrics || [] as BackendBiometricRecord[];
      setBiometrics(backendRecords.map((record: BackendBiometricRecord) => ({
        id: record.biometricId,
        name: record.name,
        createdAt: record.createdAt,
        biometricId: record.biometricId
      })));
      setBiometricsEnabled(response.data.biometricsEnabled || false);
    } catch (error: unknown) {
      console.error('Error fetching biometrics:', error);
      Alert.alert('Error', 'Failed to load biometrics data');
    } finally {
      setLoading(false);
    }
  };

  // Toggle biometrics enabled status
  const toggleBiometricsEnabled = async (value: boolean) => {
    try {
      setLoading(true);
      const token = await getToken();
      
      // If trying to enable biometrics but none are registered
      if (value && biometrics.length === 0) {
        Alert.alert('Error', 'You must add at least one fingerprint before enabling biometric authentication');
        return;
      }
      
      console.log('Toggling biometrics enabled to:', value);
      
      const response = await axios.put(
        `${API_URL}/api/biometrics/toggle`,
        { enabled: value },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      console.log('Backend response:', response.data);
      
      // Update local state
      setBiometricsEnabled(response.data.biometricsEnabled);
      
      // Update local storage via the hook
      await enableBiometrics(response.data.biometricsEnabled);
      
      // Force a refresh of biometric status
      await checkBiometricStatus();
      
      // Verify the toggle was successful
      if (response.data.biometricsEnabled === value) {
        Alert.alert('Success', `Biometric authentication ${value ? 'enabled' : 'disabled'} successfully`);
      } else {
        console.error('Biometrics toggle failed, backend returned:', response.data.biometricsEnabled);
        Alert.alert('Error', 'Failed to update biometrics settings. The server returned an unexpected value.');
      }
    } catch (error: unknown) {
      console.error('Error toggling biometrics:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Server response:', error.response.data);
        Alert.alert('Error', `Failed to update biometrics settings: ${error.response.data.error || 'Unknown error'}`);
      } else {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update biometrics settings');
      }
    } finally {
      setLoading(false);
    }
  };

  // Add a new biometric
  const addBiometric = async () => {
    try {
      // Check if biometrics are available on the device
      if (!biometricStatus.available) {
        Alert.alert('Error', 'Biometric authentication is not available on this device');
        return;
      }
      
      // Check if biometrics are enrolled on the device
      if (!biometricStatus.enrolled) {
        Alert.alert('Error', 'No biometrics are enrolled on this device. Please set up fingerprint in your device settings first.');
        return;
      }
      
      // Authenticate the user - force authentication for adding biometrics
      const authenticated = await authenticate('Scan your fingerprint to add it to your account', true);
      if (!authenticated) {
        Alert.alert('Authentication Failed', 'Failed to authenticate or authentication was cancelled');
        return;
      }
      
      // Generate a unique biometric ID with more entropy
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const biometricId = `bio_${timestamp}_${randomStr}`;
      
      // We'll use a simple default name since Alert.prompt is not available in all React Native platforms
      const name = `Fingerprint ${biometrics.length + 1}`;
      
      setLoading(true);
      const token = await getToken();
          
      try {
        console.log('Sending biometric data to backend:', { biometricId, name });
        
        const response = await axios.post(
          `${API_URL}/api/biometrics`,
          { biometricId, name },
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        console.log('Backend response:', response.data);
        
        if (response.data && response.data.biometrics) {
          const backendRecords = response.data.biometrics || [] as BackendBiometricRecord[];
          setBiometrics(backendRecords.map((record: BackendBiometricRecord) => ({
            id: record.biometricId,
            name: record.name,
            createdAt: record.createdAt,
            biometricId: record.biometricId
          })));
          
          // Ensure biometricsEnabled is updated
          setBiometricsEnabled(response.data.biometricsEnabled);
          
          // Verify the biometric was actually added
          if (backendRecords.some((record: { biometricId: string; }) => record.biometricId === biometricId)) {
            Alert.alert('Success', 'Fingerprint added successfully');
            
            // Force a refresh of biometric status
            await checkBiometricStatus();
          } else {
            console.error('Biometric ID not found in backend response');
            Alert.alert('Error', 'Fingerprint was not properly saved. Please try again.');
          }
        } else {
          console.error('Invalid response format from backend');
          Alert.alert('Error', 'Failed to add fingerprint due to server response format');
        }
      } catch (error: unknown) {
        console.error('Error adding biometric:', error);
        if (axios.isAxiosError(error) && error.response) {
          console.error('Server response:', error.response.data);
          Alert.alert('Error', `Failed to add fingerprint: ${error.response.data.error || 'Unknown error'}`);
        } else {
          Alert.alert('Error', 'Failed to add fingerprint. Please check your connection.');
        }
      } finally {
        setLoading(false);
      }
    } catch (error: unknown) {
      console.error('Error in biometric process:', error);
      Alert.alert('Error', 'Failed to process biometric authentication');
    }
  };

  // Remove a biometric
  const removeBiometric = async (biometricId: string, name: string) => {
    Alert.alert(
      'Remove Fingerprint',
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const token = await getToken();
              
              const response = await axios.delete(
                `${API_URL}/api/biometrics/${biometricId}`,
                { headers: { Authorization: `Bearer ${token}` }}
              );
              
              const backendRecords = response.data.biometrics || [] as BackendBiometricRecord[];
          setBiometrics(backendRecords.map((record: BackendBiometricRecord) => ({
            id: record.biometricId,
            name: record.name,
            createdAt: record.createdAt,
            biometricId: record.biometricId
          })));
              setBiometricsEnabled(response.data.biometricsEnabled);
              Alert.alert('Success', 'Fingerprint removed successfully');
            } catch (error: unknown) {
              console.error('Error removing biometric:', error);
              Alert.alert('Error', 'Failed to remove fingerprint');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Refresh data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchBiometrics();
    }, [])
  );

  // Initial load
  useEffect(() => {
    fetchBiometrics();
  }, []);

  if (loading && biometrics.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Biometrics Authentication</Text>
        <Text style={styles.subtitle}>
          Add and manage your fingerprints for secure time tracking
        </Text>
      </View>

      <View style={styles.enableContainer}>
        <View style={styles.enableTextContainer}>
          <Text style={styles.enableTitle}>Enable Biometric Authentication</Text>
          <Text style={styles.enableDescription}>
            When enabled, you'll need to scan your fingerprint for time tracking
          </Text>
        </View>
        <Switch
          value={biometricsEnabled}
          onValueChange={toggleBiometricsEnabled}
          trackColor={{ false: '#767577', true: '#4F46E5' }}
          thumbColor="#f4f3f4"
          disabled={loading}
        />
      </View>

      <View style={styles.fingerprintSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Fingerprints</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={addBiometric}
            disabled={loading}
          >
            <MaterialIcons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>Add Fingerprint</Text>
          </TouchableOpacity>
        </View>

        {biometrics.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="fingerprint" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No fingerprints added yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add your fingerprint to enable biometric authentication
            </Text>
          </View>
        ) : (
          <View style={styles.fingerprintList}>
            {biometrics.map((biometric) => (
              <View key={biometric.biometricId} style={styles.fingerprintItem}>
                <View style={styles.fingerprintInfo}>
                  <MaterialIcons name="fingerprint" size={32} color="#4F46E5" />
                  <View>
                    <Text style={styles.fingerprintName}>{biometric.name}</Text>
                    <Text style={styles.fingerprintDate}>
                      Added on {new Date(biometric.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => removeBiometric(biometric.biometricId, biometric.name)}
                  disabled={loading}
                >
                  <MaterialIcons name="delete" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>About Biometric Authentication</Text>
        <Text style={styles.infoText}>
          • Biometric data is stored securely on your device
        </Text>
        <Text style={styles.infoText}>
          • Your fingerprint is required for time in and time out actions
        </Text>
        <Text style={styles.infoText}>
          • You can add multiple fingerprints for convenience
        </Text>
        <Text style={styles.infoText}>
          • Biometric authentication adds an extra layer of security
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4b5563',
  },
  header: {
    padding: 20,
    backgroundColor: '#4F46E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  enableContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  enableTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  enableTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  enableDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  fingerprintSection: {
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fingerprintList: {
    marginTop: 8,
  },
  fingerprintItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  fingerprintInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fingerprintName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  fingerprintDate: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
  },
  infoSection: {
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default BiometricsAuthentication;