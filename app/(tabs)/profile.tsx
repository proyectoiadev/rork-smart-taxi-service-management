import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '@/contexts/SettingsContext';
import { User } from 'lucide-react-native';
import VoiceInput from '@/components/VoiceInput';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();
  
  const [formData, setFormData] = useState({
    userName: settings.userName,
    cooperativeName: settings.cooperativeName,
    vehicleId: settings.vehicleId,
    observations: settings.observations,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      Alert.alert('Éxito', 'Datos guardados correctamente', [
        { text: 'OK', onPress: () => {} }
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo guardar los datos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Perfil del Conductor</Text>
        <Text style={styles.headerSubtitle}>Gestiona tu información personal</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <User size={48} color="#4CAF50" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre del Conductor</Text>
            <TextInput
              style={styles.input}
              value={formData.userName}
              onChangeText={(text) => setFormData({ ...formData, userName: text })}
              placeholder="Tu nombre completo"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Cooperativa</Text>
            <TextInput
              style={styles.input}
              value={formData.cooperativeName}
              onChangeText={(text) => setFormData({ ...formData, cooperativeName: text })}
              placeholder="Nombre de la cooperativa"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>ID del Vehículo</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleId}
              onChangeText={(text) => setFormData({ ...formData, vehicleId: text })}
              placeholder="Ej: MOVIL Z-41"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Observaciones</Text>
            <VoiceInput
              value={formData.observations}
              onChangeText={(text) => setFormData({ ...formData, observations: text })}
              placeholder="Notas adicionales sobre el conductor o vehículo"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    flexGrow: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1F2937',
  },

  saveButton: {
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
});
