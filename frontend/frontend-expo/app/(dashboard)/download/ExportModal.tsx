import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ExportModalProps {
  visible: boolean;
  filePath: string;
  fileType: 'csv' | 'pdf' | null;
  onClose: () => void;
  onOpenFile: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  filePath,
  fileType,
  onClose,
  onOpenFile,
}) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>DTR {fileType === 'csv' ? 'CSV' : 'PDF'} File is being exported</Text>
          <Text style={styles.modalMessage}>The file is being saved to your download folder
            {"\n"}<Text style={styles.filePath}>File name: {filePath.split('/').pop()}</Text>
          </Text>
          <Text style={styles.modalSubtext}>Save file?</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenFile} style={styles.openButton}>
              <Text style={styles.openButtonText}>Save File</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  modalMessage: {
    marginBottom: 8,
    textAlign: 'center',
  },
  filePath: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  modalSubtext: {
    color: '#666',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  closeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  closeButtonText: {
    color: '#666',
  },
  openButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#3f51b5',
    borderRadius: 8,
  },
  openButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ExportModal;