import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Upload, Camera, Check, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useServices, type PaymentMethod } from '@/contexts/ServicesContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useRecurringClients } from '@/contexts/RecurringClientsContext';
import { useRecurringServices } from '@/contexts/RecurringServicesContext';


interface ExtractedData {
  origin: string;
  destination: string;
  company: string;
  price: string;
  date: string;
  observations: string;
  pickupTime?: string;
  abn?: string;
}

export default function ScanServiceScreen() {
  const insets = useSafeAreaInsets();
  const { addService } = useServices();
  const { getActiveCycle } = useSettings();
  const { addOrUpdateClient } = useRecurringClients();
  const { recordService } = useRecurringServices();

  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [editOrigin, setEditOrigin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editDiscount, setEditDiscount] = useState('0');



  const handleConfirm = async () => {
    const activeCycle = getActiveCycle();
    if (!activeCycle) {
      Alert.alert(
        'Sin ciclo activo',
        'No hay un ciclo de facturación abierto. Por favor, abre un ciclo en Ajustes antes de registrar servicios de abonados.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    if (!editOrigin.trim() || !editDestination.trim() || !editCompany.trim() || !editPrice.trim()) {
      Alert.alert('Campos requeridos', 'Por favor, completa todos los campos requeridos (Origen, Destino, Empresa y Precio)');
      return;
    }

    // Validar que el precio sea un número válido
    const priceNumber = parseFloat(editPrice);
    if (isNaN(priceNumber) || priceNumber < 0) {
      Alert.alert('Precio inválido', 'Por favor, introduce un precio válido');
      return;
    }

    // Validar que el descuento sea un número válido
    const discountNumber = parseFloat(editDiscount);
    if (isNaN(discountNumber) || discountNumber < 0 || discountNumber > 100) {
      Alert.alert('Descuento inválido', 'Por favor, introduce un descuento válido (0-100)');
      return;
    }

    try {
      setIsProcessing(true);
      console.log('Starting service registration...');
      console.log('Active cycle:', activeCycle);

      if (editCompany.trim()) {
        console.log('Adding/updating client:', editCompany);
        await addOrUpdateClient({
          companyName: editCompany.trim(),
        });

        console.log('Recording recurring service...');
        await recordService({
          companyName: editCompany.trim(),
          origin: editOrigin.trim(),
          destination: editDestination.trim(),
          price: editPrice,
          discountPercent: editDiscount,
        });
      }

      console.log('Adding service to cycle...');
      const serviceData = {
        date: editDate,
        origin: editOrigin.trim(),
        destination: editDestination.trim(),
        company: editCompany.trim(),
        price: editPrice,
        discountPercent: editDiscount,
        observations: editObservations.trim(),
        paymentMethod: 'Abonado' as PaymentMethod,
        clientName: editCompany.trim(),
        clientId: undefined,
        clientPhone: undefined,
      };
      console.log('Service data:', serviceData);
      console.log('Billing cycle ID:', activeCycle.id);

      await addService(serviceData, activeCycle.id);
      console.log('Service added successfully!');

      Alert.alert('Éxito', 'Servicio registrado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving service:', error);
      const errorDetails = error instanceof Error ? error.message : String(error);
      Alert.alert('Error al guardar', `No se pudo guardar el servicio: ${errorDetails}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setIsConfirming(false);
    setExtractedData(null);
    setEditOrigin('');
    setEditDestination('');
    setEditCompany('');
    setEditPrice('');
    setEditDate('');
    setEditObservations('');
    setEditDiscount('0');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Escanear Servicio</Text>
        <View style={styles.backButton} />
      </View>

      {isConfirming && extractedData ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.flex} 
            contentContainerStyle={styles.confirmContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Datos del Servicio</Text>
              <Text style={styles.confirmSubtitle}>Completa los datos del servicio</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Fecha del Servicio *</Text>
                <TextInput
                  style={styles.input}
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Empresa/Cliente *</Text>
                <TextInput
                  style={styles.input}
                  value={editCompany}
                  onChangeText={setEditCompany}
                  placeholder="Nombre de la empresa"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Origen *</Text>
                <TextInput
                  style={styles.input}
                  value={editOrigin}
                  onChangeText={setEditOrigin}
                  placeholder="Dirección de origen"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Destino *</Text>
                <TextInput
                  style={styles.input}
                  value={editDestination}
                  onChangeText={setEditDestination}
                  placeholder="Dirección de destino"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.label}>Precio (€) *</Text>
                  <TextInput
                    style={styles.input}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.label}>Descuento (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={editDiscount}
                    onChangeText={setEditDiscount}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Observaciones</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editObservations}
                  onChangeText={setEditObservations}
                  placeholder="Notas adicionales"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleCancel}
                  disabled={isProcessing}
                >
                  <X size={20} color="#6B7280" />
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.confirmButton, isProcessing && styles.confirmButtonDisabled]} 
                  onPress={handleConfirm}
                  disabled={isProcessing}
                >
                  <Check size={20} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>Confirmar y Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Registrar Servicio Rápido</Text>
            <Text style={styles.infoText}>
              Registra servicios de forma manual completando el formulario con:
            </Text>
            <View style={styles.infoList}>
              <Text style={styles.infoListItem}>• Origen y destino</Text>
              <Text style={styles.infoListItem}>• Nombre de la empresa/cliente</Text>
              <Text style={styles.infoListItem}>• Precio del servicio</Text>
              <Text style={styles.infoListItem}>• Fecha del servicio</Text>
              <Text style={styles.infoListItem}>• Observaciones</Text>
            </View>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                📸 Nota: La extracción automática con IA desde fotos requiere que el backend esté habilitado. Actualmente solo está disponible la entrada manual.
              </Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <View style={[styles.actionButton, styles.disabledButton]}>
              <View style={[styles.actionButtonIcon, styles.disabledIcon]}>
                <Camera size={32} color="#9CA3AF" />
              </View>
              <Text style={[styles.actionButtonText, styles.disabledText]}>Tomar Foto</Text>
              <Text style={styles.actionButtonSubtext}>Requiere backend habilitado</Text>
            </View>

            <View style={[styles.actionButton, styles.disabledButton]}>
              <View style={[styles.actionButtonIcon, styles.disabledIcon]}>
                <Upload size={32} color="#9CA3AF" />
              </View>
              <Text style={[styles.actionButtonText, styles.disabledText]}>Seleccionar Imagen</Text>
              <Text style={styles.actionButtonSubtext}>Requiere backend habilitado</Text>
            </View>

            <TouchableOpacity 
              style={[styles.actionButton, styles.manualButton]} 
              onPress={() => {
                setExtractedData({
                  origin: '',
                  destination: '',
                  company: '',
                  price: '',
                  date: new Date().toISOString().split('T')[0],
                  observations: '',
                });
                setEditOrigin('');
                setEditDestination('');
                setEditCompany('');
                setEditPrice('');
                setEditDate(new Date().toISOString().split('T')[0]);
                setEditObservations('');
                setEditDiscount('0');
                setIsConfirming(true);
              }}
            >
              <View style={[styles.actionButtonIcon, styles.manualButtonIcon]}>
                <Check size={32} color="#2563EB" />
              </View>
              <Text style={styles.actionButtonText}>Entrada Manual</Text>
              <Text style={styles.actionButtonSubtext}>Completa el formulario manualmente</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  infoListItem: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  infoNote: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionsContainer: {
    gap: 16,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  actionButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  confirmContainer: {
    padding: 20,
  },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formGroupHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  manualButton: {
    borderColor: '#BFDBFE',
  },
  manualButtonIcon: {
    backgroundColor: '#DBEAFE',
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledIcon: {
    backgroundColor: '#F3F4F6',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});