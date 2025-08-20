import React, { useEffect, useState, FC } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/apiUrl';
import { MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { formatRecordDate, formatRecordTime, exportToCSV, exportToPDF } from '@/utils/exportUtils';

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

interface TimeRecordsTableProps {
  timeRecords: TimeRecord[];
  loading: boolean;
  formatRecordDate: (dateString: string) => string;
  formatRecordTime: (timeString?: string) => string;
}

interface ExportModalProps {
  visible: boolean;
  filePath: string;
  fileType: 'csv' | 'pdf' | null;
  onClose: () => void;
  onOpenFile: () => void;
}

interface RecordsHeaderProps {
  title: string;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onRefresh: () => void;
  isExporting: boolean;
  isRefreshing: boolean;
}

const RecordsHeader: FC<RecordsHeaderProps> = ({
  title,
  onExportCSV,
  onExportPDF,
  onRefresh,
  isExporting,
  isRefreshing
}) => {
  return (
    <View style={styles.recordsHeader}>
      <Text style={styles.title}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={onExportCSV} disabled={isExporting} style={{ marginRight: 8 }}>
          <MaterialIcons name="grid-on" size={24} color={isExporting ? '#9e9e9e' : '#333'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onExportPDF} disabled={isExporting} style={{ marginRight: 8 }}>
          <MaterialIcons name="picture-as-pdf" size={24} color={isExporting ? '#9e9e9e' : '#333'} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={onRefresh} 
          disabled={isRefreshing || isExporting}
          style={styles.refreshButton}
        >
          <MaterialIcons 
            name="refresh" 
            size={24} 
            color={isRefreshing || isExporting ? "#9e9e9e" : "#333"} 
            style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ExportModal: FC<ExportModalProps> = ({
  visible,
  filePath,
  fileType,
  onClose,
  onOpenFile
}) => {
  if (!visible) return null;
  
  return (
    <View style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: 320, alignItems: 'center' }}>
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>DTR {fileType === 'csv' ? 'CSV' : 'PDF'} File is being exported</Text>
        <Text style={{ marginBottom: 8, textAlign: 'center' }}>The file is being saved to your download folder
          {"\n"}<Text style={{ fontFamily: 'monospace', fontSize: 13 }}>File name: {filePath.split('/').pop()}</Text>
        </Text>
        <Text style={{ color: '#666', marginBottom: 16 }}>Save file?</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <TouchableOpacity onPress={onClose} style={{ flex: 1, alignItems: 'center', padding: 12 }}>
            <Text style={{ color: '#3f51b5', fontWeight: 'bold' }}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenFile} style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#3f51b5', borderRadius: 8 }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Save File</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const TimeRecordsTable: FC<TimeRecordsTableProps> = ({ 
  timeRecords, 
  loading, 
  formatRecordDate, 
  formatRecordTime 
}) => {
  return (
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
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
      ) : timeRecords.length > 0 ? (
        timeRecords.map((record) => (
          <View key={record._id} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.dateCell]}>{formatRecordDate(record.date)}</Text>
            <Text style={[styles.tableCell, styles.timeCell]}>{record.amTimeIn ? formatRecordTime(record.amTimeIn) : '--:--'}</Text>
            <Text style={[styles.tableCell, styles.timeCell]}>{record.amTimeOut ? formatRecordTime(record.amTimeOut) : '--:--'}</Text>
            <Text style={[styles.tableCell, styles.timeCell]}>{record.pmTimeIn ? formatRecordTime(record.pmTimeIn) : '--:--'}</Text>
            <Text style={[styles.tableCell, styles.timeCell]}>{record.pmTimeOut ? formatRecordTime(record.pmTimeOut) : '--:--'}</Text>
            <Text style={[styles.tableCell, styles.hoursCell]}>{record.totalHours.toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.undertimeCell]}>{record.undertime ? record.undertime.toFixed(2) : '0.00'}</Text>
            <Text style={[styles.tableCell, styles.makeupCell]}>{record.makeup ? record.makeup.toFixed(2) : '0.00'}</Text>
            <Text style={[styles.tableCell, styles.makeupDateCell]}>{record.makeupDate ? formatRecordDate(record.makeupDate) : '--'}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noRecordsText}>No time records found. Try refreshing or check your connection.</Text>
      )}
    </View>
  );
};

interface UserInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState<{visible: boolean, filePath: string, fileType: 'csv'|'pdf'|null}>({visible: false, filePath: '', fileType: null});
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetchTimeRecords();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: token }
      });
      
      setUserInfo({
        firstName: response.data.firstName,
        middleName: response.data.middleName,
        lastName: response.data.lastName
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchTimeRecords = async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const response = await axios.get(`${API_URL}/api/time-records`, {
        headers: { Authorization: token }
      });
      const sortedRecords = [...response.data].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setTimeRecords(sortedRecords);
    } catch (error) {
      setTimeRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // No longer needed as these functions are imported from exportUtils

  // Export to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const result = await exportToCSV(timeRecords, userInfo || undefined);
      if (result.success) {
        setExportModal({visible: true, filePath: result.filePath, fileType: 'csv'});
      } else {
        alert('Failed to export CSV: ' + result.error);
      }
    } catch (e) {
      alert('Failed to export CSV: ' + e);
    } finally {
      setExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const result = await exportToPDF(timeRecords, userInfo || undefined);
      if (result.success) {
        setExportModal({visible: true, filePath: result.filePath, fileType: 'pdf'});
      } else {
        alert('Failed to export PDF: ' + result.error);
      }
    } catch (e) {
      alert('Failed to export PDF: ' + e);
    } finally {
      setExporting(false);
    }
  };

  // Open file
  const handleOpenFile = async () => {
    if (exportModal.filePath) {
      await Sharing.shareAsync(exportModal.filePath);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <RecordsHeader 
        title="Daily Time Records"
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        onRefresh={fetchTimeRecords}
        isExporting={exporting}
        isRefreshing={refreshing}
      />
      {exporting && (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <ActivityIndicator size="small" color="#3f51b5" />
          <Text style={{ color: '#3f51b5', marginTop: 4 }}>Exporting...</Text>
        </View>
      )}
      {/* Export Modal */}
      <ExportModal 
        visible={exportModal.visible}
        filePath={exportModal.filePath}
        fileType={exportModal.fileType}
        onClose={() => setExportModal({visible: false, filePath: '', fileType: null})}
        onOpenFile={handleOpenFile}
      />
      <View style={styles.recordsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <TimeRecordsTable 
            timeRecords={timeRecords}
            loading={loading}
            formatRecordDate={formatRecordDate}
            formatRecordTime={formatRecordTime}
          />
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordsContainer: {
    flex: 1,
    marginVertical: 16,
    marginHorizontal: 4,
  },
  recordsTable: {
    width: '100%',
    minWidth: 700,
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
  loadingIndicator: {
    marginTop: 20,
  },
});