import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BiometricsAuthentication from '../../../screens/dashboard/biometrics-authentication';

export default function BiometricsAuthenticationScreen() {
  return (
    <View style={styles.container}>
      <BiometricsAuthentication />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});