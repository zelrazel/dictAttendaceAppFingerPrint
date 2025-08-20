import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '@/constants/apiUrl';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { showToast } = useToast();
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    setLoading(true);
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      setLoading(false);
      return;
    }
    // Password length validation
    if (password.length < 7) {
      showToast('Password must be at least 7 characters long.', 'error');
      setLoading(false);
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      // Save token using auth context
      await signIn(res.data.token);
      showToast('Logged in successfully!', 'success');
      // Navigation will be handled by the auth context
    } catch (err: any) {
      console.error('Login error:', err?.response?.data || err.message);
      showToast(err?.response?.data?.error || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (text: string) => {
    setEmail(text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (text && !emailRegex.test(text)) {
      setEmailError('Invalid email format');
    } else {
      setEmailError('');
    }
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../logo/dict-logo.png')} 
        style={styles.logo} 
        resizeMode="contain"
      />
      
      <View style={styles.formContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="youremail@example.com"
              value={email}
              onChangeText={validateEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.signInButton, loading && styles.disabledButton]} 
          onPress={handleSignIn} 
          disabled={loading}
        >
          <Text style={styles.signInButtonText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => router.push('/(tabs)/SignUp')} style={styles.linkContainer}>
          <Text style={styles.link}>Don't have an account? <Text style={styles.linkHighlight}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#fff'
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#f0f0f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 20,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 8,
    textAlign: 'center',
    color: '#2a4d9b'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center'
  },
  inputContainer: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden'
  },
  inputIcon: {
    paddingHorizontal: 10
  },
  input: { 
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333'
  },
  eyeIcon: {
    padding: 10
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4
  },
  signInButton: {
    backgroundColor: '#2a4d9b',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500'
  },
  disabledButton: {
    opacity: 0.7
  },
  linkContainer: { 
    marginTop: 20,
    alignItems: 'center'
  },
  link: { 
    color: '#666',
    fontSize: 14
  },
  linkHighlight: {
    color: '#2a4d9b',
    fontWeight: 'bold'
  }
});