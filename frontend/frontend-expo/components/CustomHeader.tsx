import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

interface CustomHeaderProps {
  title?: string;
  showMenu?: boolean;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ title, showMenu = true }) => {
  // Use type assertion for navigation to fix TypeScript error
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerContent}>
        {showMenu && (
          <TouchableOpacity 
            onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
            style={styles.menuButton}
          >
            <Ionicons name="menu" size={24} color="#003366" />
          </TouchableOpacity>
        )}
        
        <View style={styles.logoContainer}>
          <Image 
            source={require('../logo/dict-logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <View style={styles.textContainer}>
            <Text style={styles.republicText}>REPUBLIC OF THE PHILIPPINES</Text>
            <View style={styles.underline} />
            <Text style={styles.departmentText}>DEPARTMENT OF INFORMATION AND</Text>
            <Text style={styles.departmentText}>COMMUNICATIONS TECHNOLOGY</Text>
          </View>
        </View>
        </View>
        {/* Screen Title removed as requested */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 10,
    elevation: 0, // Removed elevation
    shadowColor: 'transparent', // Removed shadow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    height: 85, // Reduced height after removing title
    marginTop: Platform.OS === 'android' ? 10 : 0, // Add a small margin on Android
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 2,
  },
  menuButton: {
    marginRight: 15,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 55,
    height: 55,
    marginRight: 12,
  },
  textContainer: {
    flexDirection: 'column',
    alignItems: 'center', // Center the text horizontally
  },
  republicText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 2,
    textAlign: 'center', // Center the text content
  },
  underline: {
    height: 1.5,
    backgroundColor: '#003366',
    width: '100%',
    marginBottom: 3,
  },
  departmentText: {
    fontSize: 10,
    color: '#003366',
    fontWeight: '500',
    textAlign: 'center', // Center the text content
  },
  // Title styles removed as they are no longer needed
});

export default CustomHeader;