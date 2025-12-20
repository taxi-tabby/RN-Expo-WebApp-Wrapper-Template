/**
 * Camera View Component
 * Real-time camera preview for app-embedded camera control
 */

import { setCameraRef } from '@/lib/bridges/camera';
import { CameraType, CameraView } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface CameraViewProps {
  visible: boolean;
  facing?: CameraType;
  onClose?: () => void;
}

export function AppCameraView({ visible, facing = 'back', onClose }: CameraViewProps) {
  const [cameraRef, setCameraRefState] = useState<CameraView | null>(null);

  useEffect(() => {
    // Set camera ref for bridge handlers
    if (cameraRef) {
      setCameraRef(cameraRef);
    }
    return () => {
      setCameraRef(null);
    };
  }, [cameraRef]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <CameraView
          ref={(ref) => setCameraRefState(ref)}
          style={styles.camera}
          facing={facing}
        />
        
        {onClose && (
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
