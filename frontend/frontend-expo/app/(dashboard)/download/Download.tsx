import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/apiUrl';
import { useAuth } from '@/hooks/useAuth';
import * as Sharing from 'expo-sharing';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import ExportModal from './ExportModal';

interface User {
  _id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

interface TimeRecord {
  _id: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  amTimeIn?: string;
  amTimeOut?: string;
  pmTimeIn?: string;
  pmTimeOut?: string;
  totalHours: number;
  undertime: number;
  makeup: number;
  makeupDate?: string;
}

export default function Download() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState<{visible: boolean, filePath: string, fileType: 'csv'|'pdf'|null}>({visible: false, filePath: '', fileType: null});

  
  // Date range state
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchTimeRecords();
    }
  }, [selectedUser, startDate, endDate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Get current user's profile instead of all users
      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: token }
      });
      
      // Create a users array with just the current user
      const currentUser = {
        _id: response.data._id,
        firstName: response.data.firstName,
        middleName: response.data.middleName,
        lastName: response.data.lastName
      };
      
      setUsers([currentUser]);
      setSelectedUser(currentUser);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeRecords = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      // Format dates for API request
      const formattedStartDate = formatDateForAPI(startDate);
      const formattedEndDate = formatDateForAPI(endDate);
      
      console.log(`Fetching records for user ${selectedUser._id} from ${formattedStartDate} to ${formattedEndDate}`);
      
      const response = await axios.get(
        `${API_URL}/api/time-records/user/${selectedUser._id}?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
        { headers: { Authorization: token } }
      );
      
      console.log('API Response:', response.data);
      
      // Sort time records by date (newest first)
      const sortedRecords = [...response.data].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      setTimeRecords(sortedRecords);
    } catch (error) {
      console.error('Error fetching time records:', error);
      setTimeRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForAPI = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Change formatDisplayDate to show full date
  const formatDisplayDate = (date: Date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatRecordDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatRecordTime = (timeString?: string) => {
    if (!timeString) return '--:--';
    const time = new Date(timeString);
    return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  // Export to CSV
  const handleExportCSV = async () => {
    if (!selectedUser || timeRecords.length === 0) return;
    
    setExporting(true);
    try {
      const userInfo = {
        firstName: selectedUser.firstName,
        middleName: selectedUser.middleName,
        lastName: selectedUser.lastName
      };
      
      // Include date range information
      const dateRange = {
        startDate: formatDisplayDate(startDate),
        endDate: formatDisplayDate(endDate)
      };
      
      const result = await exportToCSV(timeRecords, userInfo, dateRange);
      if (result.success) {
        setExportModal({visible: true, filePath: result.filePath, fileType: 'csv'});
      } else {
        Alert.alert('Export Failed', 'Failed to export CSV: ' + result.error);
      }
    } catch (e) {
      Alert.alert('Export Failed', 'Failed to export CSV: ' + e);
    } finally {
      setExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (!selectedUser || timeRecords.length === 0) return;
    
    setExporting(true);
    try {
      const userInfo = {
        firstName: selectedUser.firstName,
        middleName: selectedUser.middleName,
        lastName: selectedUser.lastName
      };
      
      // Include date range information
      const dateRange = {
        startDate: formatDisplayDate(startDate),
        endDate: formatDisplayDate(endDate)
      };
      
      const result = await exportToPDF(timeRecords, userInfo, dateRange);
      if (result.success) {
        setExportModal({visible: true, filePath: result.filePath, fileType: 'pdf'});
      } else {
        Alert.alert('Export Failed', 'Failed to export PDF: ' + result.error);
      }
    } catch (e) {
      Alert.alert('Export Failed', 'Failed to export PDF: ' + e);
    } finally {
      setExporting(false);
    }
  };

  const renderUserDropdown = () => {
    return (
      <View style={styles.dropdownContainer}>
        <View style={styles.dropdownButton}>
          <Text style={styles.dropdownButtonText}>
            {selectedUser ? `${selectedUser.firstName}${selectedUser.middleName ? ' ' + selectedUser.middleName : ''} ${selectedUser.lastName}` : 'Loading...'}
          </Text>
        </View>
      </View>
    );
  };

  const renderDatePicker = () => {
    return (
      <View style={styles.datePickerContainer}>
        <TouchableOpacity 
          style={styles.datePickerButton} 
          onPress={() => setShowStartDatePicker(true)}
        >
          <Text style={styles.datePickerButtonText}>{formatDisplayDate(startDate)}</Text>
          <Ionicons name="calendar-outline" size={20} color="#333" />
        </TouchableOpacity>
        
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={onStartDateChange}
          />
        )}
        
        <TouchableOpacity 
          style={styles.datePickerButton} 
          onPress={() => setShowEndDatePicker(true)}
        >
          <Text style={styles.datePickerButtonText}>{formatDisplayDate(endDate)}</Text>
          <Ionicons name="calendar-outline" size={20} color="#333" />
        </TouchableOpacity>
        
        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={onEndDateChange}
          />
        )}
      </View>
    );
  };

  // Handle opening the exported file
  const handleOpenFile = async () => {
    if (exportModal.filePath) {
      try {
        await Sharing.shareAsync(exportModal.filePath);
      } catch (error) {
        Alert.alert('Error', 'Failed to open the file: ' + error);
      }
    }
    // Close the modal after opening the file
    setExportModal({visible: false, filePath: '', fileType: null});
  };

  return (
    <View style={styles.container}>
      <View style={styles.selectionContainer}>
        <View style={styles.selectionContent}>
          {renderUserDropdown()}
        </View>
        <Text style={styles.sectionTitleWithMargin}>Select Date Range</Text>
        <View style={styles.selectionContent}>
          {renderDatePicker()}
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#003366" style={styles.loader} />
      ) : (
        <>
        <View style={styles.exportButtonRow}>
          <TouchableOpacity 
            style={[styles.exportButton, { paddingVertical: 7, paddingHorizontal: 13 }]}
            onPress={handleExportCSV}
            disabled={loading || timeRecords.length === 0}
          > 
            <MaterialIcons name="grid-on" size={24} color="#333" style={{ marginRight: 5 }} />
            <Text style={[styles.exportButtonText, { fontSize: 13 }]}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.exportButton, { paddingVertical: 7, paddingHorizontal: 13 }]}
            onPress={handleExportPDF}
            disabled={loading || timeRecords.length === 0}
          > 
            <MaterialIcons name="picture-as-pdf" size={24} color="#333" style={{ marginRight: 5 }} />
            <Text style={[styles.exportButtonText, { fontSize: 13 }]}>Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: 'transparent', elevation: 0 }}
            onPress={fetchTimeRecords}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#111" />
            ) : (
              <Ionicons name="refresh" size={18} color="#111" />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.recordsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
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
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                {timeRecords.length > 0 ? (
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
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No time records found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
        </>
      )}
      
      <ExportModal
        visible={exportModal.visible}
        filePath={exportModal.filePath}
        fileType={exportModal.fileType}
        onClose={() => setExportModal({visible: false, filePath: '', fileType: null})}
        onOpenFile={handleOpenFile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  selectionContainer: {
    backgroundColor: '#f0f0f5',
    padding: 16,
    borderRadius: 8,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionTitleWithMargin: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    marginTop: 24,
  },
  selectionContent: {
    flexDirection: 'column',
    gap: 12,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    zIndex: 20,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  datePickerButtonText: {
    fontSize: 13,
    color: '#333',
  },
  recordsContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 8, // reduce top margin to move table closer to export buttons
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
    textAlign: 'center',
    color: '#333',
    paddingHorizontal: 5,
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    textAlign: 'center',
    color: '#333',
    paddingHorizontal: 5,
  },
  // Cell width styles
  dateCell: {
    width: 90,
  },
  sessionCell: {
    width: 70,
  },
  timeCell: {
    width: 70,
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
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f5',
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exportButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 13,
  },
});