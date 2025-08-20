import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import Slider from '@react-native-community/slider';
import CustomSlider from '../../../components/CustomSlider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
// Import OpenStreetMap components
import { WebView } from 'react-native-webview';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/apiUrl';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useFocusEffect } from '@react-navigation/native';

interface TimeRecord {
  _id: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  amTimeIn?: string;
  amTimeOut?: string;
  pmTimeIn?: string;
  pmTimeOut?: string;
  undertime?: number;
  makeup?: number;
  makeupDate?: string;
  location: {
    coordinates: number[];
    distance: number;
  };
  isWithinOfficeRange: boolean;
  totalHours: number;
  sessionType?: 'AM' | 'PM' | 'FULL';
}

interface OfficeLocation {
  _id: string;
  name: string;
  location: {
    coordinates: number[];
  };
  radius: number;
  address: string;
}

export default function TimeTracking() {
  const router = useRouter();
  const { showToast } = useToast();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [activeSession, setActiveSession] = useState<'AM' | 'PM'>('AM');
  const [activeTimeRecord, setActiveTimeRecord] = useState<TimeRecord | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rawTimeRecords, setRawTimeRecords] = useState<any>(null);
  const [showAMDropdown, setShowAMDropdown] = useState(false);
  const [showPMDropdown, setShowPMDropdown] = useState(false);
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TimeRecord | null>(null);
  const [undertime, setUndertime] = useState<number>(0);
  const [makeup, setMakeup] = useState<number>(0);
  const [makeupDate, setMakeupDate] = useState<string>('');
  const [showUndertimeDatePicker, setShowUndertimeDatePicker] = useState<boolean>(false);
  const [showMakeupDatePicker, setShowMakeupDatePicker] = useState<boolean>(false);
  const [undertimeDate, setUndertimeDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  // Removed slider timeout refs as they're now handled in the CustomSlider component
  // Add biometricsEnabled state and fetch from profile
  // Remove biometricsEnabled state and all related fetch/useEffect/useFocusEffect

  // Function to get current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time as HH:MM:SS
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Get day of week
  const getDayOfWeek = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Request location permission
  const requestLocationPermission = async () => {
    try {
      console.log('Requesting location permission...');
      
      // First check current permission status
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
      console.log('Current location permission status:', currentStatus);
      
      if (currentStatus === 'granted') {
        console.log('Location permission already granted');
        setLocationPermission(true);
        return true;
      }
      
      // Request permission if not already granted
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Location permission request result:', status);
      
      if (status === 'granted') {
        console.log('Location permission granted');
        setLocationPermission(true);
        return true;
      } else {
        console.log('Location permission denied');
        showToast('You need to grant location permission to use time tracking features. Please enable location in your device settings.', 'warning');
        setLocationPermission(false);
        return false;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      showToast('Failed to request location permission. Please check your device settings.', 'error');
      return false;
    }
  };

  // Get current location
  const getCurrentLocation = async () => {
    try {
      console.log('Getting current location...');
      
      // Try to get the actual location with a timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // Use high accuracy
        mayShowUserSettingsDialog: true
      });
      
      // Set a timeout for location retrieval
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), 10000); // Increase timeout to 10 seconds
      });
      
      // Race between location retrieval and timeout
      const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
      
      console.log('Location received:', location);
      setCurrentLocation(location);
      await checkOfficeRange(location);
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      
      // Try again with lower accuracy if high accuracy fails
      try {
        console.log('Retrying with lower accuracy...');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true
        });
        
        console.log('Location received on retry:', location);
        setCurrentLocation(location);
        await checkOfficeRange(location);
        return location;
      } catch (retryError) {
        console.error('Error getting location on retry:', retryError);
        showToast('Unable to get your current location. Please check your device settings and ensure location services are enabled.', 'error');
        return null;
      }
    }
  };
  
  // Function to update user location in the WebView map
  const updateMapUserLocation = (latitude: number, longitude: number) => {
    if (webViewRef.current) {
      const updateScript = `
        try {
          // Update stored user location
          userLocation = [${latitude}, ${longitude}];
          
          // Update user marker position
          if (typeof userMarker !== 'undefined') {
            userMarker.setLatLng([${latitude}, ${longitude}]);
          }
        } catch (e) {
          console.error('Error updating location:', e);
        }
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }
  };

  // Set up location tracking
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    if (locationPermission) {
      // Get location immediately
      getCurrentLocation();

      // Fetch office location if not already available
      if (!officeLocation) {
        fetchOfficeLocation();
      }

      // Set up real-time location tracking using watchPositionAsync
      (async () => {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000, // 5 seconds
            distanceInterval: 0, // update on any movement
          },
          async (location) => {
            // Only update if accuracy is good
            if (location.coords.accuracy && location.coords.accuracy < 30) {
              setCurrentLocation(location);
              // Update the user's location on the map
              updateMapUserLocation(location.coords.latitude, location.coords.longitude);
              
              if (officeLocation) {
                await checkOfficeRange(location);
              } else {
                await fetchOfficeLocation();
              }
            } else {
              console.log('Ignored location update due to low accuracy:', location.coords.accuracy);
            }
          }
        );
      })();

      return () => {
        if (locationSubscription) {
          locationSubscription.remove();
        }
      };
    }
  }, [locationPermission, officeLocation]);

  // Check if user is within office range
  const checkOfficeRange = async (location: Location.LocationObject) => {
    if (!officeLocation || !location) return;
    
    const [officeLong, officeLat] = officeLocation.location.coordinates;
    const userLat = location.coords.latitude;
    const userLong = location.coords.longitude;

    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = userLat * Math.PI/180;
    const φ2 = officeLat * Math.PI/180;
    const Δφ = (officeLat-userLat) * Math.PI/180;
    const Δλ = (officeLong-userLong) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = Math.round(R * c); // Distance in meters

    setDistance(distance);
    // Check if user is within the office radius
    const isWithin = distance <= officeLocation.radius;
    setIsWithinRange(isWithin);
    
    console.log(`Distance from office: ${distance}m, Within range: ${isWithin}, Office radius: ${officeLocation.radius}m`);
    
    return { distance, isWithin };
  };

  // Fetch the actual office location from the server
  const fetchOfficeLocation = async () => {
    try {
      console.log('Fetching office location from server...');
      
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('No token found in fetchOfficeLocation');
        router.replace('/');
        return;
      }
      
      const response = await axios.get(`${API_URL}/api/office-location`, {
        headers: { Authorization: token }
      });
      
      const fetchedOfficeLocation = response.data;
      console.log('Fetched office location from server:', fetchedOfficeLocation);
      
      setOfficeLocation(fetchedOfficeLocation);
      
      // If we have current location, check if within range
      if (currentLocation) {
        await checkOfficeRange(currentLocation);
      } else {
        setIsWithinRange(false);
        setDistance(null);
      }
      
      // Use setTimeout to ensure we log after state updates are processed
      setTimeout(() => {
        console.log('After fetching office location - isWithinRange:', isWithinRange, 'distance:', distance);
      }, 100);
      
      return fetchedOfficeLocation;
      
    } catch (error) {
      console.error('Error fetching office location:', error);
      
      // Create a default office location if fetch fails
      const defaultOfficeLocation = {
        _id: 'default_office_id',
        name: 'Default Office',
        location: {
          type: 'Point',
          coordinates: [120.59097690306716, 18.20585558594641] 
        },
        radius: 30, // 30 meters radius
        address: 'Default Office Address',
        isActive: true
      };
      console.log('Using default office location due to error:', defaultOfficeLocation);
      setOfficeLocation(defaultOfficeLocation);
      setIsWithinRange(false);
      return defaultOfficeLocation;
    }
  };

  // Fetch time records
  const fetchTimeRecords = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('No token found in fetchTimeRecords');
        router.replace('/');
        return;
      }
  
      console.log('Making API request to fetch time records...');
      const response = await axios.get(`${API_URL}/api/time-records`, {
        headers: { Authorization: token }
      });
  
      // Debug log for API response
      console.log('Fetched time records response:', response.data);
      setRawTimeRecords(response.data); // Store raw response for debug UI

      // Sort time records by date (newest first)
      const sortedRecords = [...response.data].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      setTimeRecords(sortedRecords);
  
      // Check for active time record (time-in without time-out)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find today's records
      const todayRecords = sortedRecords.filter((record: TimeRecord) => {
        const recordDate = new Date(record.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === today.getTime();
      });
      
      // Check for active AM session record
      const activeAMRecord = todayRecords.find((record: TimeRecord) => 
        (record.amTimeIn && !record.amTimeOut) || 
        (record.timeIn && !record.timeOut)
      );
      
      // Check for active PM session record
      const activePMRecord = todayRecords.find((record: TimeRecord) => 
        (record.pmTimeIn && !record.pmTimeOut) || 
        (record.timeIn && !record.timeOut)
      );
      
      // Set active record based on current session
      if (activeSession === 'AM' && activeAMRecord) {
        setActiveTimeRecord(activeAMRecord);
      } else if (activeSession === 'PM' && activePMRecord) {
        setActiveTimeRecord(activePMRecord);
      } else if (activeAMRecord) {
        setActiveTimeRecord(activeAMRecord);
        setActiveSession('AM');
      } else if (activePMRecord) {
        setActiveTimeRecord(activePMRecord);
        setActiveSession('PM');
      } else {
        setActiveTimeRecord(null);
        // Set active session based on time of day if no active record
        const currentHour = new Date().getHours();
        setActiveSession(currentHour < 12 ? 'AM' : 'PM');
      }
    } catch (error) {
      console.error('Error fetching time records:', error);
      showToast('Failed to fetch time records. Please check your connection or try again.', 'error');
      setTimeRecords([]); // Ensure the table still renders
      setRawTimeRecords(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Use biometric authentication hook
  const { authenticate, biometricStatus, generateBiometricId } = useBiometricAuth();

  // Add biometricsEnabled state and fetch from profile
  // Remove biometricsEnabled state and all related fetch/useEffect/useFocusEffect

  // Update handleTimeIn
  const handleTimeIn = async () => {
    if (!currentLocation) {
      showToast('Unable to get your current location', 'error');
      return;
    }
    if (!isWithinRange) {
      showToast(`You must be within office range to time in. You are currently ${distance} meters away from the office.`, 'warning');
      return;
    }
    // Always require biometrics
    if (!biometricStatus.available || !biometricStatus.enrolled) {
      showToast('Biometric authentication is not set up on this device. Please enroll your fingerprint in device settings.', 'error');
      return;
    }
    const authenticated = await authenticate('Authenticate to time in', true);
    if (!authenticated) {
      showToast('Biometric authentication failed or was cancelled', 'error');
      return;
    }
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/');
        return;
      }
      const coordinates = [currentLocation.coords.longitude, currentLocation.coords.latitude];
      const response = await axios.post(
        `${API_URL}/api/time-records/time-in`,
        { coordinates, session: activeSession, biometricAuthenticated: true },
        { headers: { Authorization: token } }
      );
      showToast(response.data.message, 'success');
      await fetchTimeRecords();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to record time-in', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update handleTimeOut
  const handleTimeOut = async () => {
    if (!activeTimeRecord) {
      showToast('No active time record found', 'error');
      return;
    }
    if (!currentLocation) {
      showToast('Unable to get your current location', 'error');
      return;
    }
    if (!isWithinRange) {
      showToast(`You must be within office range to time out. You are currently ${distance} meters away from the office.`, 'warning');
      return;
    }
    // Always require biometrics
    if (!biometricStatus.available || !biometricStatus.enrolled) {
      showToast('Biometric authentication is not set up on this device. Please enroll your fingerprint in device settings.', 'error');
      return;
    }
    const authenticated = await authenticate('Authenticate to time out', true);
    if (!authenticated) {
      showToast('Biometric authentication failed or was cancelled', 'error');
      return;
    }
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/');
        return;
      }
      const coordinates = [currentLocation.coords.longitude, currentLocation.coords.latitude];
      const response = await axios.post(
        `${API_URL}/api/time-records/${activeTimeRecord._id}/time-out`,
        { coordinates, session: activeSession, biometricAuthenticated: true },
        { headers: { Authorization: token } }
      );
      showToast(response.data.message, 'success');
      setActiveTimeRecord(null);
      fetchTimeRecords();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to record time-out', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTimeRecords();
  }, []);

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Starting initial data loading...');
        
        // First request location permission
        const permissionGranted = await requestLocationPermission();
        console.log('Location permission granted:', permissionGranted);
        
        if (permissionGranted) {
          // Get current location if permission granted
          const location = await getCurrentLocation();
          console.log('Initial location fetched:', location ? 'success' : 'failed');
          console.log('Current location state after fetch:', currentLocation ? 'exists' : 'null');
          
          // Add a small delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Fetch office location data after getting current location
          const office = await fetchOfficeLocation();
          
          // If we have both location and office, check if within range
          if (location && office) {
            await checkOfficeRange(location);
          }
          
          // Log the state after setting office location - use setTimeout to ensure state updates are processed
          setTimeout(() => {
            console.log('After fetchOfficeLocation - Office location:', 
              officeLocation ? officeLocation._id : 'null', 
              'isWithinRange:', isWithinRange, 
              'distance:', distance);
          }, 100);
        } else {
          // Even if permission is not granted, try to fetch office location
          await fetchOfficeLocation();
          console.log('Office location fetched without location permission');
        }
        
        // Fetch time records
        await fetchTimeRecords();
        
        // Final state check - use setTimeout to ensure state updates are processed
        setTimeout(() => {
          console.log('Final state - Office location:', 
            officeLocation ? officeLocation._id : 'null', 
            'isWithinRange:', isWithinRange, 
            'distance:', distance,
            'Current location:', currentLocation ? 'exists' : 'null');
        }, 100);
        
        console.log('Initial data loading complete');
      } catch (error) {
        console.error('Error during initial data loading:', error);
        showToast('There was a problem loading your data. Please check your connection and try again.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Format time record date for display
  const formatRecordDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Format time record time for display
  const formatRecordTime = (timeString: string) => {
    if (!timeString) return '--:--';
    const time = new Date(timeString);
    return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  };
  
  // Get appropriate time in/out based on session
  const getSessionTimeIn = (record: TimeRecord, session: 'AM' | 'PM') => {
    if (session === 'AM') {
      return record.amTimeIn || (record.timeIn);
    } else {
      return record.pmTimeIn || (record.timeIn);
    }
  };
  
  const getSessionTimeOut = (record: TimeRecord, session: 'AM' | 'PM') => {
    if (session === 'AM') {
      return record.amTimeOut || (record.timeOut);
    } else {
      return record.pmTimeOut || (record.timeOut);
    }
  };

  // Function to close all dropdowns
  const closeAllDropdowns = () => {
    setShowAMDropdown(false);
    setShowPMDropdown(false);
  };

  // Handle offset modal open
  const handleOffsetModalOpen = (record: TimeRecord) => {
    setSelectedRecord(record);
    setUndertime(record.undertime || 0);
    setMakeup(record.makeup || 0);
    setMakeupDate(record.makeupDate ? formatRecordDate(record.makeupDate) : '');
    
    // Set the undertime date to the selected record's date
    setUndertimeDate(formatRecordDate(record.date));
    
    // Get all available dates from time records
    const dates = timeRecords.map(record => formatRecordDate(record.date));
    setAvailableDates([...new Set(dates)]); // Remove duplicates
    
    setShowOffsetModal(true);
  };

  // Handle offset submission
  const handleOffsetSubmit = async () => {
    if (!selectedRecord) {
      showToast('No record selected', 'error');
      return;
    }

    // Validate makeup date format if provided
    if (makeupDate && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(makeupDate)) {
      showToast('Makeup date must be in YYYY-MM-DD format', 'error');
      return;
    }
    
    // Validate undertime date exists in records
    const recordExists = availableDates.includes(undertimeDate);

    if (!recordExists) {
      showToast('Undertime date must exist in daily records', 'error');
      return;
    }
    
    // Find the record for the selected undertime date
    const undertimeRecord = timeRecords.find(record => 
      formatRecordDate(record.date) === undertimeDate
    );
    
    if (!undertimeRecord) {
      showToast('Could not find the selected undertime date record', 'error');
      return;
    }
    
    // Check for incomplete sessions in the selected undertime record
    // const hasIncompleteSession = (
    //   (undertimeRecord.amTimeIn && !undertimeRecord.amTimeOut) || 
    //   (undertimeRecord.pmTimeIn && !undertimeRecord.pmTimeOut) ||
    //   (undertimeRecord.timeIn && !undertimeRecord.timeOut)
    // );
    //
    // if (hasIncompleteSession) {
    //   showToast('Cannot offset with incomplete sessions. Please complete all timed-in sessions first.', 'error');
    //   return;
    // }

    // Validate makeup date is present or future
    if (makeupDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of day for comparison
      const makeupDateObj = new Date(makeupDate);
      makeupDateObj.setHours(0, 0, 0, 0);

      if (makeupDateObj < today) {
        showToast('Makeup date must be today or a future date', 'error');
        return;
      }
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/');
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/time-records/${undertimeRecord._id}/offset`,
        { 
          undertimeDate: undertimeDate,
          undertime: undertime,
          makeup: makeup,
          makeupDate: makeupDate || undefined
        },
        { headers: { Authorization: token } }
      );

      showToast(response.data.message, 'success');
      setShowOffsetModal(false);
      fetchTimeRecords();
    } catch (error: any) {
      console.error('Error during offset submission:', error);
      showToast(error.response?.data?.error || 'Failed to submit offset', 'error');
    } finally {
      setLoading(false);
    }
  };
  


  return (
    <TouchableWithoutFeedback onPress={closeAllDropdowns}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3f51b5']}
            tintColor={'#3f51b5'}
          />
        }
      >
        <View style={styles.container}>
        {/* Current Time Display - Moved above status banner */}
        <View style={styles.timeContainer}>
          <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
          <Text style={styles.currentDate}>
            {`${getDayOfWeek(currentTime)}, ${currentTime.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}`}
          </Text>
        </View>

        {/* Status Banner */}
        <View style={[styles.statusBanner, isWithinRange ? styles.inRangeBanner : styles.outOfRangeBanner]}>
          <View style={styles.statusIconContainer}>
            {isWithinRange ? (
              <FontAwesome5 name="check-circle" size={20} color="#2e7d32" />
            ) : (
              <MaterialIcons name="location-off" size={20} color="#c62828" />
            )}
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusText}>
              {isWithinRange ? 'You are within office range' : 'You are outside office range or maybe your network is unstable'}
            </Text>
            <Text style={styles.statusSubtext}>
              {isWithinRange ? 'Time In/Out enabled' : 'Time In/Out disabled'}
              {distance !== null && ` • Distance from office: ${distance} meters`}
            </Text>
          </View>
        </View>
        
        {/* Outside office range warning - removed as requested */}

        {/* Map View - OpenStreetMap */}
        <View style={styles.mapContainer}>
          {currentLocation && officeLocation ? (
            <View style={{flex: 1, position: 'relative'}}>
              <WebView
                style={styles.map}
                ref={webViewRef}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
                        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
                        <style>
                          body { margin: 0; padding: 0; }
                          #map { 
                            width: 100%; 
                            height: 100vh; 
                            transition: transform 0.3s ease; /* Smooth transition for any transforms */
                          }
                          .map-button {
                            padding: 8px;
                            background-color: white;
                            border: 1px solid #ccc;
                            border-radius: 50%;
                            cursor: pointer;
                            margin: 0 4px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 36px;
                            height: 36px;
                          }
                          .map-button:hover {
                            background-color: #f0f0f0;
                            box-shadow: 0 3px 7px rgba(0,0,0,0.3);
                            transform: translateY(-1px);
                          }
                          .map-button:active {
                            background-color: #e0e0e0;
                            transform: translateY(1px);
                            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                          }
                          /* Position controls at top-right */
                          .nav-buttons {
                            display: flex;
                            flex-direction: row;
                            gap: 8px;
                          }
                          /* Enhanced pulse animation for office radius */
                          @keyframes pulse {
                            0% { opacity: 0.15; stroke-width: 3px; }
                            50% { opacity: 0.25; stroke-width: 4px; }
                            100% { opacity: 0.15; stroke-width: 3px; }
                          }
                          .pulse-animation {
                            animation: pulse 2s infinite ease-in-out;
                          }
                          .google-maps-btn {
                            padding: 10px 12px;
                            background-color: white;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                            cursor: pointer;
                            margin-bottom: 8px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                            font-weight: bold;
                            font-family: Arial, sans-serif;
                            font-size: 14px;
                            color: #333;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-width: 120px;
                          }
                          .google-maps-btn:hover {
                            background-color: #f0f0f0;
                            box-shadow: 0 3px 7px rgba(0,0,0,0.3);
                            transform: translateY(-1px);
                          }
                          .google-maps-btn:active {
                            background-color: #e0e0e0;
                            transform: translateY(1px);
                            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                          }
                          /* Improve marker and popup styles */
                          .leaflet-popup-content-wrapper {
                            border-radius: 8px;
                            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                          }
                          .leaflet-popup-content {
                            margin: 12px 16px;
                            font-family: Arial, sans-serif;
                          }
                          /* Improve controls appearance */
                          .leaflet-control-zoom {
                            border-radius: 4px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                          }
                          .leaflet-touch .leaflet-control-layers, .leaflet-touch .leaflet-bar {
                            border: none;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                          }
                          /* Hide attribution control */
                          .leaflet-control-attribution {
                            display: none;
                          }
                        </style>
                      </head>
                      <body>
                        <div id="map"></div>
                        <script>
                          // Initialize the map with smooth options
                          var map = L.map('map', {
                            // Enable smooth wheel zoom
                            scrollWheelZoom: true,
                            // Enable smooth panning
                            inertia: true,
                            inertiaDeceleration: 3000, // Higher value = smoother panning
                            inertiaMaxSpeed: 3000,
                            // Smooth zoom animation
                            zoomAnimation: true,
                            zoomAnimationThreshold: 4,
                            fadeAnimation: true,
                            // Improve touch behavior for mobile
                            tap: true,
                            tapTolerance: 15,
                            touchZoom: true,
                            bounceAtZoomLimits: false
                          }).setView([${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}], 16);
                          
                          // Add OpenStreetMap tile layer with better performance options
                          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '', // Removed attribution text
                            updateWhenIdle: true,
                            updateWhenZooming: false,
                            // Improve tile loading
                            keepBuffer: 4,
                            // Improve performance
                            maxZoom: 19,
                            minZoom: 2
                          }).addTo(map);
                          
                          // Store locations for easy access
                          var userLocation = [${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}];
                          var officeLocation = [${officeLocation.location.coordinates[1]}, ${officeLocation.location.coordinates[0]}];
                          
                          // Create custom icons for better visibility
                          var userIcon = L.divIcon({
                            className: 'custom-div-icon',
                            html: '<div style="background-color:#4285F4; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
                            iconSize: [26, 26],
                            iconAnchor: [13, 13]
                          });
                          
                          var officeIcon = L.divIcon({
                            className: 'custom-div-icon',
                            html: '<div style="background-color:#DB4437; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
                            iconSize: [26, 26],
                            iconAnchor: [13, 13]
                          });
                          
                          // Add user marker with custom icon
                          var userMarker = L.marker([${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}], {
                            title: 'Your Location',
                            icon: userIcon,
                            zIndexOffset: 1000 // Ensure user marker is on top
                          }).addTo(map);
                          userMarker.bindPopup('<strong>Your Location</strong>').openPopup();
                          
                          // Add office marker with custom icon
                          var officeMarker = L.marker([${officeLocation.location.coordinates[1]}, ${officeLocation.location.coordinates[0]}], {
                            title: '${officeLocation.name}',
                            icon: officeIcon
                          }).addTo(map);
                          officeMarker.bindPopup('<strong>${officeLocation.name}</strong><br>${officeLocation.address}');
                          
                          // Add office radius circle with enhanced styling
                          var circle = L.circle([${officeLocation.location.coordinates[1]}, ${officeLocation.location.coordinates[0]}], {
                            color: '#DB4437',
                            weight: 3,
                            fillColor: '#DB4437',
                            fillOpacity: 0.15,
                            radius: ${officeLocation.radius},
                            className: 'pulse-animation'
                          }).addTo(map);
                          
                          // Add navigation buttons control in top-right position
                          var navButtons = L.control({position: 'topright'});
                          navButtons.onAdd = function(map) {
                            var div = L.DomUtil.create('div', 'nav-buttons');
                            
                            // User location button with icon only
                            var userButton = document.createElement('button');
                            userButton.className = 'map-button';
                            userButton.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;"><div style="background-color:#4285F4;width:16px;height:16px;border-radius:50%;border:2px solid white;"></div></div>';
                            userButton.onclick = function() {
                              // Use flyTo for smooth animation instead of setView
                              map.flyTo(userLocation, 16, {
                                duration: 1.5, // Animation duration in seconds
                                easeLinearity: 0.25 // Makes animation smoother
                              });
                              window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'centerOnUser'
                              }));
                            };
                            div.appendChild(userButton);
                            
                            // Office location button with icon only
                            var officeButton = document.createElement('button');
                            officeButton.className = 'map-button';
                            officeButton.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;"><div style="background-color:#DB4437;width:16px;height:16px;border-radius:50%;border:2px solid white;"></div></div>';
                            officeButton.onclick = function() {
                              // Use flyTo for smooth animation instead of setView
                              map.flyTo(officeLocation, 16, {
                                duration: 1.5, // Animation duration in seconds
                                easeLinearity: 0.25 // Makes animation smoother
                              });
                              window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'centerOnOffice'
                              }));
                            };
                            div.appendChild(officeButton);
                            
                            return div;
                          };
                          navButtons.addTo(map);
                          
                          // Add button to open in Google Maps
                          var googleMapsButton = L.control({position: 'bottomright'});
                          googleMapsButton.onAdd = function(map) {
                            var div = L.DomUtil.create('div', 'google-maps-button');
                            div.innerHTML = '<button class="google-maps-btn">Open in Google Maps</button>';
                            div.onclick = function() {
                              window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'openGoogleMaps',
                                userLat: ${currentLocation.coords.latitude},
                                userLng: ${currentLocation.coords.longitude},
                                officeLat: ${officeLocation.location.coordinates[1]},
                                officeLng: ${officeLocation.location.coordinates[0]}
                              }));
                            };
                            return div;
                          };
                          googleMapsButton.addTo(map);
                        </script>
                      </body>
                    </html>
                  `
                }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'openGoogleMaps') {
                      const { userLat, userLng, officeLat, officeLng } = data;
                      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${officeLat},${officeLng}`;
                      Linking.openURL(url);
                    } else if (data.type === 'centerOnUser') {
                      console.log('Centering map on user location');
                      // Additional actions if needed when user centers on their location
                    } else if (data.type === 'centerOnOffice') {
                      console.log('Centering map on office location');
                      // Additional actions if needed when user centers on office location
                    }
                  } catch (error) {
                    console.error('Error parsing WebView message:', error);
                  }
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
              />

            {/* Button to navigate to office location - Removed as it's now handled in the WebView */}
            </View>
          ) : (
            <View style={[styles.map, styles.mapPlaceholder]}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
        </View>

        {/* Session Buttons with Dropdown */}
        <View style={styles.sessionContainer}>
          <View style={{ flex: 1, marginHorizontal: 4 }}>
            {/* AM Session Button */}
            {(() => {
              const isAM = currentTime.getHours() < 12;
              const hasActiveAM = timeRecords.some(record => {
                const recordDate = new Date(record.date);
                const today = new Date();
                return recordDate.toDateString() === today.toDateString() &&
                  ((record.amTimeIn && !record.amTimeOut) ||
                   (record.timeIn && !record.timeOut));
              });
              const amDisabled = !isAM && !hasActiveAM;
              return (
                <TouchableOpacity
                  style={[
                    styles.sessionButton,
                    activeSession === 'AM' && styles.activeSessionButton,
                    amDisabled && styles.disabledSessionButton
                  ]}
                  onPress={() => {
                    setActiveSession('AM');
                    setShowAMDropdown(!showAMDropdown);
                    setShowPMDropdown(false);
                    // If there's an active time record with AM time in but no time out, show it
                    const amRecord = timeRecords.find(record => {
                      const recordDate = new Date(record.date);
                      const today = new Date();
                      return recordDate.toDateString() === today.toDateString() && 
                             ((record.amTimeIn && !record.amTimeOut) || 
                              (record.timeIn && !record.timeOut));
                    });
                    if (amRecord) {
                      setActiveTimeRecord(amRecord);
                    } else {
                      setActiveTimeRecord(null);
                    }
                  }}
                  disabled={amDisabled}
                >
                  <Text style={[
                    styles.sessionButtonText,
                    activeSession === 'AM' && styles.activeSessionText,
                    amDisabled && styles.disabledSessionText
                  ]}>
                    AM Session
                  </Text>
                </TouchableOpacity>
              );
            })()}
            {/* AM Dropdown */}
            {showAMDropdown && (
              <TouchableWithoutFeedback>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTimeIn();
                      setShowAMDropdown(false);
                    }}
                    disabled={!!activeTimeRecord || loading || !isWithinRange}
                  >
                    <Text style={[styles.dropdownText, (!!activeTimeRecord || loading || !isWithinRange) && styles.disabledDropdownText]}>Time In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTimeOut();
                      setShowAMDropdown(false);
                    }}
                    disabled={!activeTimeRecord || loading || !isWithinRange}
                  >
                    <Text style={[styles.dropdownText, (!activeTimeRecord || loading || !isWithinRange) && styles.disabledDropdownText]}>Time Out</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
          <View style={{ flex: 1, marginHorizontal: 4 }}>
            {/* PM Session Button */}
            {(() => {
              const isPM = currentTime.getHours() >= 12;
              const hasActivePM = timeRecords.some(record => {
                const recordDate = new Date(record.date);
                const today = new Date();
                return recordDate.toDateString() === today.toDateString() &&
                  ((record.pmTimeIn && !record.pmTimeOut) ||
                   (record.timeIn && !record.timeOut));
              });
              const pmDisabled = !isPM && !hasActivePM;
              return (
                <TouchableOpacity
                  style={[
                    styles.sessionButton,
                    activeSession === 'PM' && styles.activeSessionButton,
                    pmDisabled && styles.disabledSessionButton
                  ]}
                  onPress={() => {
                    setActiveSession('PM');
                    setShowPMDropdown(!showPMDropdown);
                    setShowAMDropdown(false);
                    // If there's an active time record with PM time in but no time out, show it
                    const pmRecord = timeRecords.find(record => {
                      const recordDate = new Date(record.date);
                      const today = new Date();
                      return recordDate.toDateString() === today.toDateString() && 
                             ((record.pmTimeIn && !record.pmTimeOut) || 
                              (record.timeIn && !record.timeOut));
                    });
                    if (pmRecord) {
                      setActiveTimeRecord(pmRecord);
                    } else {
                      setActiveTimeRecord(null);
                    }
                  }}
                  disabled={pmDisabled}
                >
                  <Text style={[
                    styles.sessionButtonText,
                    activeSession === 'PM' && styles.activeSessionText,
                    pmDisabled && styles.disabledSessionText
                  ]}>
                    PM Session
                  </Text>
                </TouchableOpacity>
              );
            })()}
            {/* PM Dropdown */}
            {showPMDropdown && (
              <TouchableWithoutFeedback>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTimeIn();
                      setShowPMDropdown(false);
                    }}
                    disabled={!!activeTimeRecord || loading || !isWithinRange}
                  >
                    <Text style={[styles.dropdownText, (!!activeTimeRecord || loading || !isWithinRange) && styles.disabledDropdownText]}>Time In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTimeOut();
                      setShowPMDropdown(false);
                    }}
                    disabled={!activeTimeRecord || loading || !isWithinRange}
                  >
                    <Text style={[styles.dropdownText, (!activeTimeRecord || loading || !isWithinRange) && styles.disabledDropdownText]}>Time Out</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </View>

        {/* Time In/Out Buttons - Hidden since functionality moved to dropdowns */}
        {/* <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, !activeTimeRecord && styles.activeActionButton]}
            onPress={handleTimeIn}
            disabled={!!activeTimeRecord || loading || !isWithinRange}
          >
            <Text style={styles.actionButtonText}>
              {loading && !activeTimeRecord ? 'Processing...' : 'Time In'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, !!activeTimeRecord && styles.activeActionButton]}
            onPress={handleTimeOut}
            disabled={!activeTimeRecord || loading || !isWithinRange}
          >
            <Text style={styles.actionButtonText}>
              {loading && activeTimeRecord ? 'Processing...' : 'Time Out'}
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* Offset Button - Moved below AM/PM sessions */}
        {/* Replace offsetButtonRow with sessionContainer for alignment */}
        <View style={styles.sessionContainer}>
          <View style={{ flex: 1, marginHorizontal: 4 }}>
            <TouchableOpacity
              style={[styles.sessionButton, styles.activeSessionButton]}
              onPress={() => {
                // Get today's record if it exists
                const todayRecord = timeRecords.find(record => {
                  const recordDate = new Date(record.date);
                  const today = new Date();
                  return recordDate.toDateString() === today.toDateString();
                });
                if (todayRecord) {
                  handleOffsetModalOpen(todayRecord);
                } else {
                  showToast('No time record found for today', 'warning');
                }
              }}
            >
              <Text style={[styles.sessionButtonText, styles.activeSessionText]}>Offset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Time Records */}
        <View style={styles.recordsContainer}>
          <View style={styles.recordsHeader}>
            <Text style={styles.recordsTitle}>Recent Time Records</Text>
            <TouchableOpacity 
              onPress={onRefresh} 
              disabled={refreshing}
              style={styles.refreshButton}
            >
              <MaterialIcons 
                name="refresh" 
                size={24} 
                color={refreshing ? "#9e9e9e" : "#333"} 
                style={refreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
              />
            </TouchableOpacity>
          </View>
          {/* Wrap the table in a horizontal ScrollView */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.recordsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.dateCell]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.timeCell]}>AM In</Text>
                <Text style={[styles.tableHeaderCell, styles.timeCell]}>AM Out</Text>
                <Text style={[styles.tableHeaderCell, styles.timeCell]}>PM In</Text>
                <Text style={[styles.tableHeaderCell, styles.timeCell]}>PM Out</Text>
                <Text style={[styles.tableHeaderCell, styles.hoursCell]}>Hours</Text>
                <Text style={[styles.tableHeaderCell, styles.undertimeCell]}>Undertime</Text>
                <Text style={[styles.tableHeaderCell, styles.makeupCell]}>Makeup</Text>
                <Text style={[styles.tableHeaderCell, styles.makeupDateCell]}>Makeup Date</Text>
              </View>
              {loading && timeRecords.length === 0 ? (
                <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
              ) : timeRecords.length > 0 ? (
                timeRecords.map((record) => (
                  <View key={record._id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.dateCell]}>
                      {formatRecordDate(record.date)}
                    </Text>
                    <Text style={[styles.tableCell, styles.timeCell]}>
                      {record.amTimeIn ? formatRecordTime(record.amTimeIn) : '--:--'}
                    </Text>
                    <Text style={[styles.tableCell, styles.timeCell]}>
                      {record.amTimeOut ? formatRecordTime(record.amTimeOut) : '--:--'}
                    </Text>
                    <Text style={[styles.tableCell, styles.timeCell]}>
                      {record.pmTimeIn ? formatRecordTime(record.pmTimeIn) : '--:--'}
                    </Text>
                    <Text style={[styles.tableCell, styles.timeCell]}>
                      {record.pmTimeOut ? formatRecordTime(record.pmTimeOut) : '--:--'}
                    </Text>
                    <Text style={[styles.tableCell, styles.hoursCell]}>
                      {record.totalHours.toFixed(2)}
                    </Text>
                    <Text style={[styles.tableCell, styles.undertimeCell]}>
                      {record.undertime ? record.undertime.toFixed(2) : '0.00'}
                    </Text>
                    <Text style={[styles.tableCell, styles.makeupCell]}>
                      {record.makeup ? record.makeup.toFixed(2) : '0.00'}
                    </Text>
                    <Text style={[styles.tableCell, styles.makeupDateCell]}>
                      {record.makeupDate ? formatRecordDate(record.makeupDate) : '--'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noRecordsText}>No time records found for today. Try refreshing or check your connection.</Text>
              )}
            </View>
          </ScrollView>
        </View>
        </View>
        {showOffsetModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Offset Time</Text>
              
              <View style={styles.modalForm}>
                <Text style={styles.modalLabel}>Record Date:</Text>
                <Text style={styles.modalText}>
                  {selectedRecord ? formatRecordDate(selectedRecord.date) : ''}
                </Text>
                
                <Text style={styles.modalLabel}>Undertime Date:</Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={() => setShowUndertimeDatePicker(true)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {undertimeDate || 'Select Date'}
                  </Text>
                </TouchableOpacity>
                {showUndertimeDatePicker && (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showUndertimeDatePicker}
                  >
                    <View style={styles.datePickerModalOverlay}>
                      <View style={styles.datePickerModalContainer}>
                        <Text style={styles.datePickerModalTitle}>Select Undertime Date</Text>
                        <Calendar
                          onDayPress={(day) => {
                            // Only allow selection from available dates
                            if (availableDates.includes(day.dateString)) {
                              setUndertimeDate(day.dateString);
                              // Don't close the modal immediately to prevent accidental dismissal
                            }
                          }}
                          markedDates={{
                            ...(undertimeDate ? { [undertimeDate]: { selected: true, selectedColor: '#dc3545' } } : {}),
                            // Mark available dates
                            ...availableDates.reduce((acc, date) => ({
                              ...acc,
                              [date]: { marked: true, dotColor: '#007bff' }
                            }), {})
                          }}
                          theme={{
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#b6c1cd',
                            selectedDayBackgroundColor: '#dc3545',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#dc3545',
                            dayTextColor: '#2d4150',
                            textDisabledColor: '#d9e1e8',
                            arrowColor: '#dc3545',
                            monthTextColor: '#2d4150',
                            indicatorColor: '#dc3545'
                          }}
                        />
                        <View style={styles.calendarButtonContainer}>
                          <TouchableOpacity 
                            style={[styles.calendarButton, styles.calendarCancelButton]}
                            onPress={() => setShowUndertimeDatePicker(false)}
                          >
                            <Text style={styles.calendarButtonText}>CANCEL</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.calendarButton, styles.calendarOkButton]}
                            onPress={() => setShowUndertimeDatePicker(false)}
                          >
                            <Text style={styles.calendarButtonText}>OK</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Modal>
                )}
                
                <CustomSlider
                  label="Undertime (hours)"
                  value={undertime}
                  onValueChange={setUndertime}
                  minimumValue={0}
                  maximumValue={8}
                  step={0.25}
                  minimumTrackTintColor="#007bff"
                  maximumTrackTintColor="#d3d3d3"
                  thumbTintColor="#007bff"
                  disabled={false}
                  testID="undertime-slider"
                />
                
                <CustomSlider
                  label="Makeup (hours)"
                  value={makeup}
                  onValueChange={setMakeup}
                  minimumValue={0}
                  maximumValue={8}
                  step={0.25}
                  minimumTrackTintColor="#28a745"
                  maximumTrackTintColor="#d3d3d3"
                  thumbTintColor="#28a745"
                  disabled={false}
                  testID="makeup-slider"
                />
                
                <Text style={styles.modalLabel}>Makeup Date:</Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={() => setShowMakeupDatePicker(true)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {makeupDate || 'Select Date'}
                  </Text>
                </TouchableOpacity>
                {showMakeupDatePicker && (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showMakeupDatePicker}
                  >
                    <View style={styles.datePickerModalOverlay}>
                      <View style={styles.datePickerModalContainer}>
                        <Text style={styles.datePickerModalTitle}>Select Makeup Date</Text>
                        <Calendar
                          onDayPress={(day) => {
                            setMakeupDate(day.dateString);
                            // Don't close the modal immediately to prevent accidental dismissal
                          }}
                          markedDates={{
                            ...(makeupDate ? { [makeupDate]: { selected: true, selectedColor: '#28a745' } } : {})
                          }}
                          minDate={new Date().toISOString().split('T')[0]}
                          theme={{
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#b6c1cd',
                            selectedDayBackgroundColor: '#28a745',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#28a745',
                            dayTextColor: '#2d4150',
                            textDisabledColor: '#d9e1e8',
                            arrowColor: '#28a745',
                            monthTextColor: '#2d4150',
                            indicatorColor: '#28a745'
                          }}
                        />
                        <View style={styles.calendarButtonContainer}>
                          <TouchableOpacity 
                            style={[styles.calendarButton, styles.calendarCancelButton]}
                            onPress={() => setShowMakeupDatePicker(false)}
                          >
                            <Text style={styles.calendarButtonText}>CANCEL</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.calendarButton, styles.calendarOkButton]}
                            onPress={() => setShowMakeupDatePicker(false)}
                          >
                            <Text style={styles.calendarButtonText}>OK</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Modal>
                )}
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowOffsetModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalSubmitButton]}
                  onPress={handleOffsetSubmit}
                  disabled={loading}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBanner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  inRangeBanner: {
    backgroundColor: '#90ee90', // Light green color for in-range banner
  },
  outOfRangeBanner: {
    backgroundColor: '#ffebee',
  },
  statusIconContainer: {
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Slider styles moved to CustomSlider component
  datePickerButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '70%',
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  datePickerScrollView: {
    maxHeight: 300,
  },
  datePickerItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  datePickerItemSelected: {
    backgroundColor: '#e6f7ff',
  },
  datePickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerItemTextSelected: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  datePickerCloseButton: {
    marginTop: 15,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  datePickerCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  calendarButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  calendarButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  calendarCancelButton: {
    backgroundColor: '#dc3545',
  },
  calendarOkButton: {
    backgroundColor: '#28a745',
  },
  calendarButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timeContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  currentTime: {
    fontSize: 42, // Increased from 36
    fontWeight: 'bold',
    color: '#333',
  },
  currentDate: {
    fontSize: 18, // Increased from 16
    color: '#666',
    marginTop: 4,
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#e0e0e0',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  officeLocationButton: {
    position: 'absolute',
    top: 64,
    right: 14, 
    backgroundColor: 'white',
    borderRadius: 1, // Keep it a square
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  sessionContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sessionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  activeSessionButton: {
    backgroundColor: '#3f51b5',
  },
  disabledSessionButton: {
    backgroundColor: '#bdbdbd',
    opacity: 0.7,
  },
  sessionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeSessionText: {
    color: '#fff',
  },
  disabledSessionText: {
    color: '#9e9e9e',
  },
  actionContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  activeActionButton: {
    backgroundColor: '#4caf50',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  recordsContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  recordsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  recordsList: {
    flex: 1,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  recordsTable: {
    width: '100%',
    minWidth: 700, // Ensure table is wide enough for all columns including offset
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f5',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  tableCell: {
    textAlign: 'center',
    color: '#333',
    paddingHorizontal: 5,
  },
  dateCell: {
    width: 100,
  },
  sessionCell: {
    width: 70,
  },
  timeCell: {
    width: 80,
  },
  hoursCell: {
    width: 60,
  },
  undertimeCell: {
    width: 80,
  },
  makeupCell: {
    width: 80,
  },
  makeupDateCell: {
    width: 100,
  },
  actionCell: {
    width: 80,
  },
  amSessionText: {
    color: '#3f51b5',
    fontWeight: '600',
  },
  pmSessionText: {
    color: '#f57c00',
    fontWeight: '600',
  },
  noRecordsText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  sessionTimeContainer: {
    marginTop: 4,
  },
  sessionTimeLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 2,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 4,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  disabledDropdownText: {
    color: '#9e9e9e',
    opacity: 0.7,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offsetButton: {
    color: '#3f51b5',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalForm: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#f44336',
  },
  modalSubmitButton: {
    backgroundColor: '#4caf50',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  offsetButtonContainer: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  offsetMainButton: {
    backgroundColor: '#3f51b5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  offsetMainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  offsetButtonRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
});
