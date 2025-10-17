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
import { ArrowLeft, Upload, Camera, Check, X, Loader2 } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useServices, type PaymentMethod } from '@/contexts/ServicesContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useRecurringClients } from '@/contexts/RecurringClientsContext';
import { useRecurringServices } from '@/contexts/RecurringServicesContext';
import { generateObject } from '@rork/toolkit-sdk';
import { z } from 'zod';


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

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para seleccionar imágenes.');
      return false;
    }
    return true;
  };

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const FileSystem = await import('expo-file-system');
        const base64 = await FileSystem.default.readAsStringAsync(uri, {
          encoding: FileSystem.default.EncodingType.Base64,
        });
        return base64;
      }
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('No se pudo convertir la imagen');
    }
  };



  const validateDate = (dateString: string): string => {
    // Valida formato YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return new Date().toISOString().split('T')[0];
    }
    return dateString;
  };

  const extractDataFromImage = async (imageUri: string) => {
    console.log('Starting AI extraction from image...');
    setIsProcessing(true);

    try {
      if (!process.env.EXPO_PUBLIC_TOOLKIT_URL) {
        throw new Error('La función de IA no está configurada. Por favor, contacta al soporte o usa la entrada manual.');
      }

      console.log('Image URI:', imageUri);
      
      const base64Image = await convertImageToBase64(imageUri);
      console.log('Image converted to base64, length:', base64Image.length);

      const schema = z.object({
        origin: z.string().describe('Dirección completa de origen del servicio de taxi o transporte'),
        destination: z.string().describe('Dirección completa de destino del servicio de taxi o transporte'),
        company: z.string().describe('Nombre de la empresa o cliente'),
        price: z.string().describe('Precio del servicio en euros, solo el número'),
        date: z.string().describe('Fecha del servicio en formato YYYY-MM-DD'),
        observations: z.string().describe('Observaciones o notas adicionales del servicio'),
        discount: z.string().optional().describe('Porcentaje de descuento si existe'),
      });

      console.log('Calling AI to extract data...');
      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: base64Image,
              },
              {
                type: 'text',
                text: 'Extrae la información de este despacho de servicio de taxi/transporte. Incluye origen, destino, empresa/cliente, precio, fecha y cualquier observación. Si no encuentras algún dato, deja el campo vacío.',
              },
            ],
          },
        ],
        schema,
      });

      console.log('AI extraction result:', result);
      
      const validatedDate = validateDate(result.date);
      
      setExtractedData({
        origin: result.origin || '',
        destination: result.destination || '',
        company: result.company || '',
        price: result.price || '',
        date: validatedDate,
        observations: result.observations || '',
      });
      
      setEditOrigin(result.origin || '');
      setEditDestination(result.destination || '');
      setEditCompany(result.company || '');
      setEditPrice(result.price || '');
      setEditDate(validatedDate);
      setEditObservations(result.observations || '');
      setEditDiscount(result.discount || '0');

      setIsConfirming(true);
      
      console.log('Data extraction completed successfully');
    } catch (error) {
      console.error('Error extracting data:', error);
      
      let errorMessage = 'Error desconocido';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          errorMessage = 'No se pudo conectar al servicio de IA. Verifica tu conexión a internet o usa la entrada manual.';
        } else if (error.message.includes('IA no está configurada')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      console.error('Error details:', {
        type: typeof error,
        name: error instanceof Error ? error.name : 'N/A',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'N/A',
      });
      
      Alert.alert(
        'Error al Extraer Datos',
        `${errorMessage}\n\nPuedes ingresar los datos manualmente usando el botón "Entrada Manual".`,
        [
          { 
            text: 'Entrada Manual',
            onPress: () => {
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
            },
          },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await extractDataFromImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara para tomar fotos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await extractDataFromImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

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

      {isProcessing ? (
        <View style={styles.processingContainer}>
          <Loader2 size={48} color="#4CAF50" />
          <Text style={styles.processingText}>Procesando imagen...</Text>
          <Text style={styles.processingSubtext}>Extrayendo datos del documento</Text>
        </View>
      ) : isConfirming && extractedData ? (
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
              Toma una foto o selecciona una imagen del despacho de servicio. La IA extraerá automáticamente:
            </Text>
            <View style={styles.infoList}>
              <Text style={styles.infoListItem}>• Origen y destino</Text>
              <Text style={styles.infoListItem}>• Nombre de la empresa/cliente</Text>
              <Text style={styles.infoListItem}>• Precio del servicio</Text>
              <Text style={styles.infoListItem}>• Fecha del servicio</Text>
              <Text style={styles.infoListItem}>• Observaciones</Text>
            </View>
            <Text style={styles.infoNote}>
              Nota: Después de la extracción automática podrás revisar y editar los datos antes de guardar. También puedes registrar servicios sin foto usando &quot;Entrada Manual&quot;.
            </Text>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
              <View style={styles.actionButtonIcon}>
                <Camera size={32} color="#4CAF50" />
              </View>
              <Text style={styles.actionButtonText}>Tomar Foto</Text>
              <Text style={styles.actionButtonSubtext}>IA extrae datos automáticamente</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handlePickImage}>
              <View style={styles.actionButtonIcon}>
                <Upload size={32} color="#4CAF50" />
              </View>
              <Text style={styles.actionButtonText}>Seleccionar Imagen</Text>
              <Text style={styles.actionButtonSubtext}>IA extrae datos automáticamente</Text>
            </TouchableOpacity>

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
              <Text style={styles.actionButtonSubtext}>Sin foto, solo formulario</Text>
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
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
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
});