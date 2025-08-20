import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, AccessibilityInfo, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

interface CustomSliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * A custom slider component with debounced value changes and improved UX
 * 
 * Features:
 * - Debounced value changes to prevent rapid state updates
 * - Immediate value update on sliding complete
 * - Accessibility support with screen reader announcements
 * - Cleanup of timeouts on component unmount
 * - Consistent styling across the application
 * - Platform-specific accessibility improvements
 * - Memoized to prevent unnecessary re-renders
 * 
 * @param label - The label to display above the slider
 * @param value - The current value of the slider
 * @param onValueChange - Callback function when the value changes
 * @param minimumValue - The minimum value of the slider (default: 0)
 * @param maximumValue - The maximum value of the slider (default: 8)
 * @param step - The step value of the slider (default: 0.25)
 * @param minimumTrackTintColor - The color of the track to the left of the thumb
 * @param maximumTrackTintColor - The color of the track to the right of the thumb
 * @param thumbTintColor - The color of the thumb
 * @param disabled - Whether the slider is disabled (default: false)
 * @param testID - Optional test ID for testing frameworks (default: generated from label)
 */
const CustomSlider: React.FC<CustomSliderProps> = ({
  label,
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 8,
  step = 0.25,
  minimumTrackTintColor = '#007bff',
  maximumTrackTintColor = '#d3d3d3',
  thumbTintColor = '#007bff',
  disabled = false,
  testID,
}) => {
  // Use a ref to store the timeout ID
  const timeoutRef = useRef<number | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle value change with debounce
  const handleValueChange = (val: number) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout to update the value
    timeoutRef.current = setTimeout(() => {
      onValueChange(val);
    }, 50);
  };

  // Handle sliding complete - immediately update the value
  const handleSlidingComplete = (val: number) => {
    onValueChange(val);
  };
  
  // Calculate the percentage for accessibility announcement
  const percentage = Math.round(((value - minimumValue) / (maximumValue - minimumValue)) * 100);
  
  // Announce value changes to screen readers on iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(
        `${label} value changed to ${value.toFixed(2)}, ${percentage}% of maximum`
      );
    }
  }, [value, label, percentage]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}: {value.toFixed(2)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={minimumTrackTintColor}
        maximumTrackTintColor={maximumTrackTintColor}
        thumbTintColor={thumbTintColor}
        tapToSeek={false}
        disabled={disabled}
        testID={testID || `${label.toLowerCase().replace(/\s+/g, '-')}-slider`}
        accessible={true}
        accessibilityLabel={`${label} slider. Current value: ${value.toFixed(2)} out of ${maximumValue}. ${percentage}% of maximum.`}
        accessibilityHint={`Slide left or right to adjust the ${label.toLowerCase()} value`}
        accessibilityRole="adjustable"
        accessibilityActions={[
          { name: 'increment', label: 'Increase value' },
          { name: 'decrement', label: 'Decrease value' },
        ]}
        onAccessibilityAction={(event) => {
          const stepValue = step || 1;
          if (event.nativeEvent.actionName === 'increment') {
            const newValue = Math.min(value + stepValue, maximumValue);
            onValueChange(newValue);
          } else if (event.nativeEvent.actionName === 'decrement') {
            const newValue = Math.max(value - stepValue, minimumValue);
            onValueChange(newValue);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 20,
    marginTop: 5,
  },
});

// Memoize the component to prevent unnecessary re-renders
export default React.memo(CustomSlider);