import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { useToast } from '@/hooks/useToast';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';
import { API_URL } from '@/constants/apiUrl';

// Define user interface
interface User {
  _id: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  designation: string;
  phoneNumber: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Profile() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    designation: '',
    phoneNumber: '',
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Initialize form data when user data is loaded
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        designation: user.designation || '',
        phoneNumber: user.phoneNumber || '',
      });
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get<User>(`${API_URL}/api/profile`, {
        headers: { Authorization: token }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showToast('Please grant permission to access your photos', 'warning');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Check file size (5MB limit)
      const fileInfo = await fetch(result.assets[0].uri).then(res => res.blob());
      const fileSizeInMB = fileInfo.size / (1024 * 1024);
      
      if (fileSizeInMB > 5) {
        showToast('Please select an image smaller than 5MB', 'error');
        return;
      }
      
      uploadImage(result.assets[0].uri);
    }
  };

  const deleteProfileImage = async () => {
    setUploading(true);
    try {
      const response = await axios.delete<User>(
        `${API_URL}/api/profile/image`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      setUser(response.data);
      showToast('Profile image deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting image:', error);
      showToast('Failed to delete profile image', 'error');
    } finally {
      setUploading(false);
      setShowDeleteModal(false);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profile', {
        uri,
        type: 'image/jpeg',
        name: 'profile-image.jpg',
      } as any);

      const response = await axios.post<User>(
        `${API_URL}/api/profile/image`,
        formData,
        {
          headers: {
            Authorization: token,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUser(response.data);
      showToast('Profile image updated successfully', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast('Failed to upload profile image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = async () => {
    // Validate form data
    if (!formData.firstName || !formData.lastName || !formData.designation || !formData.phoneNumber) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    // Phone number length validation
    if (formData.phoneNumber.length !== 11) {
      showToast('Phone number must be 11 digits', 'error');
      return;
    }

    setUpdating(true);
    try {
      const response = await axios.put<User>(
        `${API_URL}/api/profile`,
        formData,
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        }
      );

      setUser(response.data);
      setIsEditing(false);
      showToast('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (['firstName', 'middleName', 'lastName'].includes(field)) {
      // Only allow letters (and spaces for middle name)
      const letterOnly = field === 'middleName'
        ? value.replace(/[^a-zA-Z ]/g, '')
        : value.replace(/[^a-zA-Z]/g, '');
      setFormData(prev => ({
        ...prev,
        [field]: letterOnly
      }));
    } else if (field === 'phoneNumber') {
      // Only allow digits, max 11
      const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 11);
      setFormData(prev => ({
        ...prev,
        [field]: digitsOnly
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.subtitle}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.profileImageContainer}>
          <View style={styles.profileWithButtonContainer}>
            {uploading ? (
              <View style={styles.imageContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
              </View>
            ) : (
              <>
                <View style={styles.imageContainer}>
                  {user?.profileImage ? (
                    <Image
                      source={{ uri: user.profileImage }}
                      style={styles.profileImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.placeholderContainer}>
                      <Text style={styles.placeholderText}>👤</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.editIconContainer}
                  onPress={user?.profileImage ? () => setShowDeleteModal(true) : pickImage}
                  disabled={uploading}
                >
                  <Text style={styles.editIcon}>{user?.profileImage ? '❌' : '✏️'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          <Modal
            animationType="fade"
            transparent={true}
            visible={showDeleteModal}
            onRequestClose={() => setShowDeleteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Delete profile picture?</Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalCancelButton]} 
                    onPress={() => setShowDeleteModal(false)}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.deleteButton]} 
                    onPress={deleteProfileImage}
                  >
                    <Text style={[styles.buttonText, styles.deleteButtonText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>

        <View style={styles.infoContainer}>
          {!isEditing ? (
            // Display mode
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>
                    {user?.firstName} {user?.middleName ? user.middleName + ' ' : ''}{user?.lastName}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Designation</Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>{user?.designation}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>{user?.email}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>{user?.phoneNumber}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.updateButton}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.updateButtonText}>Update Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Edit mode
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(text) => handleInputChange('firstName', text)}
                  placeholder="First Name"
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Middle Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.middleName}
                  onChangeText={(text) => handleInputChange('middleName', text)}
                  placeholder="Middle Name"
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(text) => handleInputChange('lastName', text)}
                  placeholder="Last Name"
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Designation</Text>
                <TextInput
                  style={styles.input}
                  value={formData.designation}
                  onChangeText={(text) => handleInputChange('designation', text)}
                  placeholder="Designation"
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email Address (Cannot be changed)</Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>{user?.email}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phoneNumber}
                  onChangeText={(text) => handleInputChange('phoneNumber', text)}
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  maxLength={11}
                />
              </View>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    // Reset form data and exit edit mode
                    if (user) {
                      setFormData({
                        firstName: user.firstName || '',
                        middleName: user.middleName || '',
                        lastName: user.lastName || '',
                        designation: user.designation || '',
                        phoneNumber: user.phoneNumber || '',
                      });
                    }
                    setIsEditing(false);
                  }}
                  disabled={updating}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={updateProfile}
                  disabled={updating}
                >
                  <Text style={styles.actionButtonText}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
  },
  profileImageContainer: {
    marginTop: 2,
    marginBottom: 1,
    alignItems: 'center',
  },
  profileWithButtonContainer: {
    position: 'relative',
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.3, // border
    borderColor: '#444', // light black color
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
     width: '100%',
     height: '100%',
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: '#e1e1e1',
   },
   placeholderText: {
     fontSize: 50,
   },
  editIconContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2563EB',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    zIndex: 10,
  },
  editIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 10,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  buttonText: {
    fontWeight: 'bold',
  },
  deleteButtonText: {
    color: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
  },
  infoContainer: {
    width: '100%',
    marginTop: 10,
    backgroundColor: '#f0f0f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValueContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  infoValue: {
    fontSize: 16,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  updateButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  saveButton: {
     backgroundColor: '#4CAF50',
   },
   cancelButton: {
     backgroundColor: '#f44336',
   },
   actionButtonText: {
     color: 'white',
     fontSize: 16,
     fontWeight: '500',
   },
});