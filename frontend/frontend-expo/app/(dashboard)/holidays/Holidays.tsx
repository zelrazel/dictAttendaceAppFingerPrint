import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, Button, Alert, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/apiUrl';
import { Ionicons } from '@expo/vector-icons';

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Holiday {
  date: string;
  localName?: string;
  name?: string;
}

interface EventItem {
  _id: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  description?: string;
}

interface MarkedDates {
  [date: string]: any;
}

export default function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState<{ title: string; startTime: string; endTime: string; location: string; endDate: string; description: string }>({ title: '', startTime: '', endTime: '', location: '', endDate: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [endDateObj, setEndDateObj] = useState(new Date());
  const [showHolidayList, setShowHolidayList] = useState(false);
  const [showAllEventsModal, setShowAllEventsModal] = useState(false);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [allEventsForCalendar, setAllEventsForCalendar] = useState<EventItem[]>([]);

  useEffect(() => {
    fetchHolidays();
    fetchAllEventsForCalendar();
  }, []);

  useEffect(() => {
    fetchEvents(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    markCalendar();
  }, [holidays, allEventsForCalendar, selectedDate]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const year = new Date().getFullYear();
      const res = await axios.get(`${API_URL}/api/holidays/${year}`, { headers: { Authorization: token } });
      setHolidays(res.data);
    } catch (e) {
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (date: string) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_URL}/api/events/${date}`, { headers: { Authorization: token } });
      setEvents(res.data);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEvents = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_URL}/api/events`, { headers: { Authorization: token } });
      setAllEvents(res.data);
    } catch (e) {
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all events for calendar marking
  const fetchAllEventsForCalendar = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_URL}/api/events`, { headers: { Authorization: token } });
      setAllEventsForCalendar(res.data);
    } catch (e) {
      setAllEventsForCalendar([]);
    }
  };

  const addEvent = async () => {
    // Prevent adding events on past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      Alert.alert('Error', 'Cannot add an event on a past date');
      return;
    }
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime || !newEvent.endDate || !newEvent.location) {
      Alert.alert('Error', 'Please fill in all required fields (title, dates, times, and location)');
      return;
    }

    // Validate end date is not before start date
    const startDateObj = new Date(selectedDate);
    const endDateObj = new Date(newEvent.endDate);
    
    if (endDateObj < startDateObj) {
      Alert.alert('Error', 'End date cannot be before start date');
      return;
    }

    // Validate end time is not before start time on the same day
    if (endDateObj.toDateString() === startDateObj.toDateString()) {
      // Parse times (assuming format like "1:30 PM")
      const parseTime = (timeStr: string) => {
        const [timePart, ampm] = timeStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        return { hours, minutes };
      };
      
      const startTime = parseTime(newEvent.startTime);
      const endTime = parseTime(newEvent.endTime);
      
      // Compare times
      if (startTime.hours > endTime.hours || 
          (startTime.hours === endTime.hours && startTime.minutes >= endTime.minutes)) {
        Alert.alert('Error', 'End time must be after start time');
        return;
      }
    }
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(`${API_URL}/api/events`, {
        ...newEvent,
        date: selectedDate
      }, { headers: { Authorization: token } });
      setShowAddModal(false);
      setNewEvent({ title: '', startTime: '', endTime: '', location: '', endDate: '', description: '' });
      fetchEvents(selectedDate);
      fetchAllEventsForCalendar(); // <-- add this
    } catch (e) {
      Alert.alert('Error', 'Failed to add event');
    } finally {
      setLoading(false);
    }
  };
  
  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      // Check if selected date is in the past compared to current date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for date comparison
      
      if (selectedDate < today) {
        Alert.alert('Error', 'Cannot select a past date');
        return;
      }
      
      setEndDateObj(selectedDate);
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setNewEvent({ ...newEvent, endDate: formattedDate });
    }
  };
  
  const onStartTimeChange = (event: any, selectedDateObj?: Date) => {
    setShowStartTimePicker(false);
    if (selectedDateObj) {
      // Combine selected calendar date and picked time
      const [year, month, day] = selectedDate.split('-').map(Number);
      const combinedDate = new Date(year, month - 1, day, selectedDateObj.getHours(), selectedDateObj.getMinutes(), 0, 0);
      const now = new Date();
      const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      // Only block past times if the selected date is today
      if (selectedDate === todayStr && combinedDate < now) {
        Alert.alert('Error', 'Cannot select a past time');
        return;
      }
      setStartDate(combinedDate);
      const hours = selectedDateObj.getHours();
      const minutes = selectedDateObj.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedTime = `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      setNewEvent({ ...newEvent, startTime: formattedTime });
    }
  };

  const onEndTimeChange = (event: any, selectedDateObj?: Date) => {
    setShowEndTimePicker(false);
    if (selectedDateObj) {
      // Combine selected calendar date and picked time
      const [year, month, day] = selectedDate.split('-').map(Number);
      const combinedDate = new Date(year, month - 1, day, selectedDateObj.getHours(), selectedDateObj.getMinutes(), 0, 0);
      const now = new Date();
      const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      // Only block past times if the selected date is today
      if (selectedDate === todayStr && combinedDate < now) {
        Alert.alert('Error', 'Cannot select a past time');
        return;
      }
      setEndDate(combinedDate);
      const hours = selectedDateObj.getHours();
      const minutes = selectedDateObj.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedTime = `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      setNewEvent({ ...newEvent, endTime: formattedTime });
    }
  };

  const deleteEvent = async (id: string) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.delete(`${API_URL}/api/events/${id}`, { headers: { Authorization: token } });
      fetchEvents(selectedDate);
      fetchAllEventsForCalendar(); // <-- add this
    } catch (e) {
      Alert.alert('Error', 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  const markCalendar = () => {
    const marks: MarkedDates = {};
    holidays.forEach((h: Holiday) => {
      marks[h.date] = { marked: true, dotColor: 'green', customStyles: { container: { backgroundColor: '#f0f0f5' } } };
    });
    // Mark all event dates
    allEventsForCalendar.forEach((ev: EventItem) => {
      const d = ev.date ? ev.date.slice(0, 10) : '';
      if (d) {
        marks[d] = marks[d] ? { ...marks[d], dotColor: 'green' } : { marked: true, dotColor: 'green' };
      }
    });
    if (selectedDate) {
      marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: '#f0f0f5', selectedTextColor: '#333' };
    }
    setMarkedDates(marks);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header removed as requested */}
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, !showHolidayList && styles.activeTab]} 
          onPress={() => setShowHolidayList(false)}
        >
          <Text style={[styles.tabText, !showHolidayList && styles.activeTabText]}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, showHolidayList && styles.activeTab]} 
          onPress={() => setShowHolidayList(true)}
        >
          <Text style={[styles.tabText, showHolidayList && styles.activeTabText]}>Holidays</Text>
        </TouchableOpacity>
      </View>

      {!showHolidayList ? (
        <View style={{ flex: 1 }}>
          <Calendar
            markedDates={markedDates}
            onDayPress={day => {
              setSelectedDate(day.dateString);
              // Fetch events before showing modal to prevent delay
              fetchEvents(day.dateString).then(() => {
                setShowEventModal(true);
              });
            }}
            theme={{
              todayTextColor: '#333',
              selectedDayBackgroundColor: '#f0f0f5',
              selectedDayTextColor: '#333',
              dotColor: 'green',
              arrowColor: '#333',
              monthTextColor: '#333',
              textMonthFontWeight: 'bold',
              textDayFontSize: 14,
              textMonthFontSize: 16,
            }}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ Add Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => { fetchAllEvents(); setShowAllEventsModal(true); }}>
            <Text style={styles.addBtnText}>See All Events Added</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {holidays.map((item: Holiday) => (
            <View key={item.date} style={styles.holidayItemCard}>
              <Text style={styles.holidayNameCard}>{item.localName || item.name}</Text>
              <Text style={styles.holidayDateCard}>{item.date}</Text>
            </View>
          ))}
          {holidays.length === 0 && (
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No holidays</Text>
          )}
        </ScrollView>
      )}

      {/* Event Modal */}
      <Modal visible={showEventModal} transparent animationType="slide" onRequestClose={() => setShowEventModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Events on {selectedDate}</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={events}
              keyExtractor={(item: EventItem) => item._id}
              renderItem={({ item }: { item: EventItem }) => (
                <View style={styles.eventItem}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventTime}>
                    <Ionicons name="time-outline" size={14} color="#424242" /> {item.startTime} - {item.endTime}
                  </Text>
                  <Text style={styles.eventDate}>
                    <Ionicons name="calendar-outline" size={14} color="#424242" /> {new Date(item.date).toLocaleDateString()}
                    {item.endDate && ` - ${new Date(item.endDate).toLocaleDateString()}`}
                  </Text>
                  {item.location && <Text style={styles.eventLocation}><Ionicons name="location-outline" size={14} color="#424242" /> {item.location}</Text>}
                  {item.description && <Text style={styles.eventDescription}><Ionicons name="document-text-outline" size={14} color="#424242" /> {item.description}</Text>}
                  <TouchableOpacity onPress={() => deleteEvent(item._id)} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={18} color="red" />
                    <Text style={styles.deleteBtn}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No events</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Event</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Event Details</Text>
                
                <Text style={styles.inputLabel}>Title <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput 
                  placeholder="Enter event title" 
                  style={styles.input} 
                  value={newEvent.title} 
                  onChangeText={t => setNewEvent({ ...newEvent, title: t })} 
                />
                
                <Text style={styles.inputLabel}>Location <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput 
                  placeholder="Enter location" 
                  style={styles.input} 
                  value={newEvent.location} 
                  onChangeText={t => setNewEvent({ ...newEvent, location: t })} 
                />
                
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput 
                  placeholder="Enter event description" 
                  style={[styles.input, styles.textArea]} 
                  value={newEvent.description} 
                  onChangeText={t => setNewEvent({ ...newEvent, description: t })} 
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Date & Time</Text>
                
                <Text style={styles.inputLabel}>Start Date <Text style={styles.requiredStar}>*</Text></Text>
                <View style={styles.dateDisplay}>
                  <Ionicons name="calendar-outline" size={20} color="#1976d2" />
                  <Text style={styles.dateText}>{selectedDate}</Text>
                </View>
                
                <Text style={styles.inputLabel}>Start Time <Text style={styles.requiredStar}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.timePickerButton} 
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text>{newEvent.startTime || 'Select start time'}</Text>
                  <Ionicons name="time-outline" size={20} color="#1976d2" />
                </TouchableOpacity>
                {showStartTimePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={onStartTimeChange}
                  />
                )}
                
                <Text style={styles.inputLabel}>End Date <Text style={styles.requiredStar}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.timePickerButton} 
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text>{newEvent.endDate || 'Select end date'}</Text>
                  <Ionicons name="calendar-outline" size={20} color="#1976d2" />
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDateObj}
                    mode="date"
                    display="calendar"
                    onChange={onEndDateChange}
                  />
                )}
                
                <Text style={styles.inputLabel}>End Time <Text style={styles.requiredStar}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.timePickerButton} 
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text>{newEvent.endTime || 'Select end time'}</Text>
                  <Ionicons name="time-outline" size={20} color="#1976d2" />
                </TouchableOpacity>
                {showEndTimePicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={onEndTimeChange}
                  />
                )}
              </View>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.saveButton]} 
                  onPress={addEvent} 
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.requiredFieldsNote}>* Required fields</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* All Events Modal */}
      <Modal visible={showAllEventsModal} transparent animationType="slide" onRequestClose={() => setShowAllEventsModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Events</Text>
              <TouchableOpacity onPress={() => setShowAllEventsModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={allEvents}
              keyExtractor={(item: EventItem) => item._id}
              renderItem={({ item }: { item: EventItem }) => (
                <View style={styles.eventItem}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventTime}>
                    <Ionicons name="time-outline" size={14} color="#424242" /> {item.startTime} - {item.endTime}
                  </Text>
                  <Text style={styles.eventDate}>
                    <Ionicons name="calendar-outline" size={14} color="#424242" /> {new Date(item.date).toLocaleDateString()}
                    {item.endDate && ` - ${new Date(item.endDate).toLocaleDateString()}`}
                  </Text>
                  {item.location && <Text style={styles.eventLocation}><Ionicons name="location-outline" size={14} color="#424242" /> {item.location}</Text>}
                  {item.description && <Text style={styles.eventDescription}><Ionicons name="document-text-outline" size={14} color="#424242" /> {item.description}</Text>}
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No events</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  tabText: {
    fontSize: 16,
    color: '#757575',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  addBtn: {
    backgroundColor: '#f0f0f5',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addBtnText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxHeight: '90%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  formContainer: {
    paddingBottom: 20,
  },
  formSection: {
    marginBottom: 20,
    backgroundColor: '#f0f0f5',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    color: '#424242',
  },
  requiredStar: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#ffffff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#f0f0f5',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#757575',
    fontWeight: 'bold',
    fontSize: 16,
  },
  requiredFieldsNote: {
    color: '#757575',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  eventItem: {
    backgroundColor: '#f0f0f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  eventTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
    color: '#212121',
  },
  eventTime: {
    fontSize: 15,
    color: '#424242',
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 15,
    color: '#424242',
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventLocation: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDescription: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    fontStyle: 'italic',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  deleteBtn: {
    color: 'red',
    marginLeft: 5,
    fontWeight: '500',
  },
  holidayItemCard: {
    backgroundColor: '#f0f0f5',
    padding: 15,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  holidayNameCard: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#212121',
    marginBottom: 5,
  },
  holidayDateCard: {
    fontSize: 15,
    color: '#757575',
  },
});