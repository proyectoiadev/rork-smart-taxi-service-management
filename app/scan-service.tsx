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
import { generateText } from '@rork/toolkit-sdk';

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
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const FileSystem = await import('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    }
  };

  const extractDataFromImage = async (imageUri: string) => {
    console.log('Starting OCR extraction...');
    setIsProcessing(true);

    try {
      const base64Image = await convertImageToBase64(imageUri);
      console.log('Image converted to base64, length:', base64Image.length);

      const prompt = `Analiza esta imagen de un despacho o ticket de servicio de taxi/transporte.

Extrae EXACTAMENTE los siguientes datos del texto visible:

1. ORIGEN: La dirección o lugar de recogida (puede estar después de "RECOGIDA:" o "-RECOGIDA:")
2. DESTINO: La dirección o lugar de destino (puede estar después de "-DESTINO:")
3. EMPRESA/CLIENTE: El nombre de la empresa o cliente (puede estar después de "NOMBRE:" o "-NOMBRE:")
4. PRECIO: NO extraer, dejar vacío (el usuario lo introducirá manualmente)
5. FECHA: La fecha del servicio en formato YYYY-MM-DD (busca "FECHA:" o similar)
6. HORA_RECOGIDA: La hora de recogida si está disponible (busca "HORA RECOGIDA" o similar)
7. ABN: El número ABN si está visible (busca "ABN:" o similar)
8. OBSERVACIONES: Cualquier nota adicional relevante (busca "OBSERVACIONES:" o similar, incluye si dice "***CREDITO***" o "ABONADO")

IMPORTANTE:
- Extrae el texto EXACTAMENTE como aparece en la imagen
- Si dice "***CREDITO***" o "ABONADO" en observaciones, inclúyelo
- Si no puedes encontrar algún dato, devuelve un string vacío ""
- Para direcciones largas, copia el texto completo visible
- La fecha debe estar en formato YYYY-MM-DD (ejemplo: 2025-10-11)

Responde ÚNICAMENTE en formato JSON válido:
{
  "origin": "texto exacto del origen",
  "destination": "texto exacto del destino",
  "company": "nombre exacto de la empresa",
  "price": "",
  "date": "YYYY-MM-DD",
  "observations": "texto de observaciones incluyendo CREDITO/ABONADO si aparece",
  "pickupTime": "HH:MM si está disponible",
  "abn": "número ABN si está visible"
}`;

      console.log('Calling generateText API...');
      console.log('Image base64 prefix:', base64Image.substring(0, 50));
      console.log('EXPO_PUBLIC_TOOLKIT_URL:', process.env.EXPO_PUBLIC_TOOLKIT_URL);
      
      let result: string;
      try {
        result = await generateText({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image', image: base64Image },
              ],
            },
          ],
        });
      } catch (fetchError) {
        console.error('generateText failed, error:', fetchError);
        console.error('Error details:', JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError)));
        
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          throw new Error('No se pudo conectar con el servicio de IA. Por favor, verifica tu conexión a internet y que estés usando la aplicación en un entorno compatible.');
        }
        throw fetchError;
      }

      console.log('AI Response received');
      console.log('Response:', result);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', result);
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const extracted: ExtractedData = JSON.parse(jsonMatch[0]);
      console.log('Extracted data:', extracted);

      setExtractedData(extracted);
      setEditOrigin(extracted.origin || '');
      setEditDestination(extracted.destination || '');
      setEditCompany(extracted.company || '');
      setEditPrice(extracted.price || '');
      setEditDate(extracted.date || new Date().toISOString().split('T')[0]);
      setEditObservations(extracted.observations || '');
      setEditDiscount('0');

      setIsConfirming(true);
    } catch (error) {
      console.error('Error extracting data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error type:', error instanceof TypeError ? 'TypeError' : typeof error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      Alert.alert(
        'Error',
        `No se pudo extraer los datos: ${errorMessage}`
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
        mediaTypes: 'images' as any,
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

    if (!editOrigin || !editDestination || !editCompany || !editPrice) {
      Alert.alert('Error', 'Por favor, completa todos los campos requeridos (Origen, Destino, Empresa y Precio)');
      return;
    }

    try {
      setIsProcessing(true);
      console.log('Starting service registration...');
      console.log('Active cycle:', activeCycle);

      if (editCompany) {
        console.log('Adding/updating client:', editCompany);
        await addOrUpdateClient({
          companyName: editCompany,
        });

        console.log('Recording recurring service...');
        await recordService({
          companyName: editCompany,
          origin: editOrigin,
          destination: editDestination,
          price: editPrice,
          discountPercent: editDiscount,
        });
      }

      console.log('Adding service to cycle...');
      const serviceData = {
        date: editDate,
        origin: editOrigin,
        destination: editDestination,
        company: editCompany,
        price: editPrice,
        discountPercent: editDiscount,
        observations: editObservations,
        paymentMethod: 'Abonado' as PaymentMethod,
        clientName: editCompany,
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
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `No se pudo guardar el servicio: ${error}`);
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
        >
          <ScrollView style={styles.flex} contentContainerStyle={styles.confirmContainer}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Datos Extraídos</Text>
              <Text style={styles.confirmSubtitle}>Revisa y edita los datos antes de guardar</Text>

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
                    keyboardType="numeric"
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
                    keyboardType="numeric"
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
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <X size={20} color="#6B7280" />
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
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
            <Text style={styles.infoTitle}>Escaneo Inteligente</Text>
            <Text style={styles.infoText}>
              Toma una foto o selecciona una imagen de un despacho de servicio. La IA extraerá automáticamente los datos del documento:
            </Text>
            <View style={styles.infoList}>
              <Text style={styles.infoListItem}>• Origen y destino</Text>
              <Text style={styles.infoListItem}>• Nombre de la empresa/cliente</Text>
              <Text style={styles.infoListItem}>• Fecha del servicio</Text>
              <Text style={styles.infoListItem}>• Observaciones</Text>
            </View>
            <Text style={styles.infoNote}>
              Nota: El precio deberás introducirlo manualmente después de la extracción.
            </Text>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
              <View style={styles.actionButtonIcon}>
                <Camera size={32} color="#4CAF50" />
              </View>
              <Text style={styles.actionButtonText}>Tomar Foto</Text>
              <Text style={styles.actionButtonSubtext}>Usa la cámara del dispositivo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handlePickImage}>
              <View style={styles.actionButtonIcon}>
                <Upload size={32} color="#4CAF50" />
              </View>
              <Text style={styles.actionButtonText}>Seleccionar Imagen</Text>
              <Text style={styles.actionButtonSubtext}>Desde la galería</Text>
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
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
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
    fontStyle: 'italic' as const,
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
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
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
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
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
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
