import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useToast } from '@/hooks/useToast';
import { API_URL } from '@/constants/apiUrl';

export default function SignUp() {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    designation: '',
    phoneNumber: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleChange = (key: string, value: string) => {
    if (key === 'phoneNumber') {
      // Only allow digits, max 11
      const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 11);
      setForm({ ...form, [key]: digitsOnly });
    } else {
      setForm({ ...form, [key]: value });
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      showToast('Please enter a valid email address.', 'error');
      setLoading(false);
      return;
    }
    // Password length validation
    if (form.password.length < 7) {
      showToast('Password must be at least 7 characters long.', 'error');
      setLoading(false);
      return;
    }
    // Phone number length validation
    if (form.phoneNumber.length !== 11) {
      showToast('Phone number must be 11 digits.', 'error');
      setLoading(false);
      return;
    }
    // Check for required fields before sending request
    if (!form.email || !form.firstName || !form.lastName || !form.designation || !form.phoneNumber || !form.password) {
      showToast('Please fill all required fields.', 'error');
      setLoading(false);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/auth/signup`, form);
      showToast('Account created! Please sign in.', 'success');
      router.replace('./');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Sign up failed';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (text: string) => {
    handleChange('email', text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (text && !emailRegex.test(text)) {
      setEmailError('Invalid email format');
    } else {
      setEmailError('');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image 
        source={require('../../logo/dict-logo.png')} 
        style={styles.logo} 
        resizeMode="contain"
      />
      
      <View style={styles.formContainer}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="youremail@example.com"
              value={form.email}
              onChangeText={validateEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>First Name</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your first name"
              value={form.firstName}
              onChangeText={v => handleChange('firstName', v)}
            />
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Middle Name (Optional)</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your middle name"
              value={form.middleName}
              onChangeText={v => handleChange('middleName', v)}
            />
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Last Name</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your last name"
              value={form.lastName}
              onChangeText={v => handleChange('lastName', v)}
            />
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Designation</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="work" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your designation"
              value={form.designation}
              onChangeText={v => handleChange('designation', v)}
            />
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="phone" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              value={form.phoneNumber}
              onChangeText={v => handleChange('phoneNumber', v)}
              keyboardType="phone-pad"
            />
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              value={form.password}
              onChangeText={v => handleChange('password', v)}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.signUpButton, loading && styles.disabledButton]} 
          onPress={handleSignUp} 
          disabled={loading}
        >
          <Text style={styles.signUpButtonText}>{loading ? 'Signing Up...' : 'Sign Up'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => router.replace('./')} style={styles.linkContainer}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkHighlight}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f7fa',
    paddingVertical: 60, // increased top and bottom padding
    paddingHorizontal: 16,
  },
  logo: {
    width: '100%',
    height: 120,
    alignSelf: 'center',
    marginBottom: 20,
  },
  formContainer: {
    backgroundColor: '#f0f0f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2a4d9b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    height: 50,
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
  signUpButton: {
    backgroundColor: '#2a4d9b',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  link: {
    color: '#666',
    fontSize: 14,
  },
  linkHighlight: {
    color: '#2a4d9b',
    fontWeight: 'bold',
  },
});