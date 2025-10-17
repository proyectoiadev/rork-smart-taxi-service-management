import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X, Check, AlertCircle } from 'lucide-react-native';
import { Service } from '@/contexts/ServicesContext';


interface ExtractedTicketData {
  date: string;
  origin: string;
  destination: string;
  company: string;
  observations: string;
}

interface TicketScannerProps {
  visible: boolean;
  onClose: () => void;
  onServicesExtracted: (services: Omit<Service, 'id'>[]) => void;
}

export default function TicketScanner({ visible, onClose, onServicesExtracted }: TicketScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedTicketData[]>([]);
  const [priceInput, setPriceInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [editableDate, setEditableDate] = useState('');
  const [editableDestination, setEditableDestination] = useState('');
  const cameraRef = useRef<CameraView>(null);

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo && photo.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
        setShowCamera(false);
        await processImage(`data:image/jpeg;base64,${photo.base64}`);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as ImagePicker.MediaTypeOptions,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0] && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setCapturedImage(base64Image);
        await processImage(base64Image);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const processImage = async (imageBase64: string) => {
    setIsProcessing(true);
    
    try {
      console.log('Starting image processing...');
      console.log('Image data length:', imageBase64.length);
      
      if (!imageBase64.startsWith('data:image')) {
        console.error('Invalid image format - missing data URI prefix');
        throw new Error('Formato de imagen inválido');
      }


      const prompt = `Analiza este ticket de taxi y extrae la siguiente información en formato JSON. Si hay múltiples servicios en la imagen, devuelve un array con cada uno:

FORMATO DE RESPUESTA (IMPORTANTE: Devuelve SOLO el JSON, sin texto adicional):
{
  "services": [
    {
      "date": "YYYY-MM-DD",
      "origin": "ubicación de origen",
      "destination": "ubicación de destino",
      "company": "nombre de la empresa/cooperativa",
      "observations": "cualquier observación relevante del ticket"
    }
  ]
}

INSTRUCCIONES:
- Extrae FECHA del campo "FECHA:" del ticket
- Extrae ORIGEN del campo "-RECOGIDA:" o similar
- Extrae DESTINO del campo "-DESTINO:" o similar  
- Extrae COMPANY del campo "-NOMBRE:" o similar
- IMPORTANTE: NO extraigas el precio, el usuario lo ingresará manualmente
- Extrae observaciones relevantes del ticket (si las hay)
- Si no encuentras un campo, usa cadena vacía ""
- Si hay múltiples servicios, añádelos al array "services"
- IMPORTANTE: Responde SOLO con el JSON, sin markdown ni texto adicional`;

      console.log('Calling Gemini API...');
      console.log('Image preview:', imageBase64.substring(0, 100));
      
      const base64Data = imageBase64.split(',')[1];
      
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyAFIHOK7S_okuLeJATDBDwCNJmasOrnOXE',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              topK: 32,
              topP: 1,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API error:', errorData);
        throw new Error(`Error de API: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('Gemini API response:', data);
      
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error('No se recibió respuesta válida de la API');
      }
      
      console.log('Successfully received response from AI');
      console.log('Raw response:', textResponse);
      
      let cleanedText = textResponse.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      cleanedText = cleanedText.trim();
      
      console.log('Cleaned response:', cleanedText);
      
      try {
        const parsed = JSON.parse(cleanedText);
        
        if (parsed.services && Array.isArray(parsed.services)) {
          console.log('Successfully parsed services:', parsed.services.length);
          setExtractedData(parsed.services);
          if (parsed.services[0]) {
            setEditableDate(parsed.services[0].date || '');
            setEditableDestination(parsed.services[0].destination || '');
          }
        } else if (parsed.date) {
          console.log('Successfully parsed single service');
          setExtractedData([parsed]);
          setEditableDate(parsed.date || '');
          setEditableDestination(parsed.destination || '');
        } else {
          throw new Error('Formato de respuesta inválido');
        }
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        console.error('Text that failed to parse:', cleanedText);
        Alert.alert('Error', 'No se pudo procesar la información del ticket. Por favor, verifica que la imagen sea clara y contenga un ticket válido.');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        if (error.message.includes('fetch') || error.message.includes('Network') || error.message.includes('Failed to fetch')) {
          Alert.alert(
            'Error de Conexión',
            'No se pudo conectar con el servicio de IA. Verifica que tengas conexión a internet.'
          );
        } else {
          Alert.alert('Error', `No se pudo procesar la imagen: ${error.message}`);
        }
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'Ocurrió un error desconocido al procesar la imagen');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (extractedData.length === 0) {
      Alert.alert('Error', 'No hay datos extraídos para confirmar');
      return;
    }

    if (!editableDate) {
      Alert.alert('Error', 'Por favor, ingresa la fecha del servicio');
      return;
    }

    if (!editableDestination) {
      Alert.alert('Error', 'Por favor, ingresa el destino del servicio');
      return;
    }

    if (!priceInput || parseFloat(priceInput) <= 0) {
      Alert.alert('Error', 'Por favor, ingresa el importe del servicio');
      return;
    }

    if (!discountInput) {
      Alert.alert('Error', 'Por favor, ingresa el descuento (usa 0 si no hay descuento)');
      return;
    }

    const discount = parseFloat(discountInput);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      Alert.alert('Error', 'El descuento debe ser un número entre 0 y 100');
      return;
    }

    const services: Omit<Service, 'id'>[] = extractedData.map(data => ({
      date: editableDate,
      origin: data.origin || '',
      destination: editableDestination,
      company: data.company || '',
      price: priceInput,
      discountPercent: discountInput,
      observations: data.observations || '',
      paymentMethod: 'Tarjeta',
    }));

    onServicesExtracted(services);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setCapturedImage(null);
    setExtractedData([]);
    setShowCamera(false);
    setPriceInput('');
    setDiscountInput('');
    setEditableDate('');
    setEditableDestination('');
  };

  const handleOpenCamera = async () => {
    if (!permission) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
        return;
      }
    }

    setShowCamera(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!showCamera && !capturedImage && (
          <View style={styles.menuContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Escanear Ticket</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.infoText}>
                Captura o selecciona una imagen del ticket para extraer automáticamente los datos del servicio
              </Text>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleOpenCamera}
              >
                <Camera size={24} color="#4CAF50" />
                <Text style={styles.optionButtonText}>Tomar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handlePickImage}
              >
                <ImageIcon size={24} color="#4CAF50" />
                <Text style={styles.optionButtonText}>Seleccionar Imagen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showCamera && (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            >
              <View style={styles.cameraOverlay}>
                <TouchableOpacity
                  style={styles.cameraCloseButton}
                  onPress={() => setShowCamera(false)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.cameraControls}>
                  <TouchableOpacity
                    style={styles.captureButton}
                    onPress={handleTakePicture}
                  >
                    <View style={styles.captureButtonInner} />
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>
          </View>
        )}

        {capturedImage && (
          <View style={styles.resultContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {isProcessing ? 'Procesando...' : 'Datos Extraídos'}
              </Text>
              <TouchableOpacity onPress={handleReset} style={styles.closeButton}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.resultContent}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />

              {isProcessing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                  <Text style={styles.loadingText}>Extrayendo datos del ticket...</Text>
                </View>
              ) : extractedData.length > 0 ? (
                <>
                  <View style={styles.successBanner}>
                    <Check size={20} color="#4CAF50" />
                    <Text style={styles.successText}>
                      {extractedData.length} servicio(s) detectado(s)
                    </Text>
                  </View>

                  {extractedData.map((data, index) => (
                    <View key={index} style={styles.dataCard}>
                      <Text style={styles.dataCardTitle}>Servicio {index + 1}</Text>
                      
                      <View style={styles.dataFieldContainer}>
                        <Text style={styles.dataLabel}>Fecha: *</Text>
                        <TextInput
                          style={[styles.dataInput, !editableDate && styles.dataInputMissing]}
                          value={editableDate}
                          onChangeText={setEditableDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={styles.dataFieldContainer}>
                        <Text style={styles.dataLabel}>Origen:</Text>
                        <Text style={styles.dataValue}>{data.origin || 'No detectado'}</Text>
                      </View>

                      <View style={styles.dataFieldContainer}>
                        <Text style={styles.dataLabel}>Destino: *</Text>
                        <TextInput
                          style={[styles.dataInput, !editableDestination && styles.dataInputMissing]}
                          value={editableDestination}
                          onChangeText={setEditableDestination}
                          placeholder="Ej: Barcelona"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={styles.dataFieldContainer}>
                        <Text style={styles.dataLabel}>Empresa:</Text>
                        <Text style={styles.dataValue}>{data.company || 'No detectada'}</Text>
                      </View>

                      {data.observations && (
                        <View style={styles.dataFieldContainer}>
                          <Text style={styles.dataLabel}>Observaciones:</Text>
                          <Text style={styles.dataValue}>{data.observations}</Text>
                        </View>
                      )}
                    </View>
                  ))}

                  <View style={styles.inputsContainer}>
                    <View style={styles.priceInputSection}>
                      <Text style={styles.priceInputLabel}>Importe (€) *</Text>
                      <TextInput
                        style={styles.priceInputField}
                        value={priceInput}
                        onChangeText={setPriceInput}
                        placeholder="Ej: 55"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.discountInputSection}>
                      <Text style={styles.discountInputLabel}>Descuento (%) *</Text>
                      <TextInput
                        style={styles.discountInputField}
                        value={discountInput}
                        onChangeText={setDiscountInput}
                        placeholder="Ej: 0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.retryButton]}
                      onPress={handleReset}
                    >
                      <Text style={styles.retryButtonText}>Escanear Otro</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        styles.confirmButton,
                        (!editableDate || !editableDestination || !priceInput || !discountInput) && styles.confirmButtonDisabled
                      ]}
                      onPress={handleConfirm}
                      disabled={!editableDate || !editableDestination || !priceInput || !discountInput}
                    >
                      <Text style={[
                        styles.confirmButtonText,
                        (!editableDate || !editableDestination || !priceInput || !discountInput) && styles.confirmButtonTextDisabled
                      ]}>
                        Guardar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.errorContainer}>
                  <AlertCircle size={48} color="#EF4444" />
                  <Text style={styles.errorText}>
                    No se pudieron extraer datos del ticket
                  </Text>
                  <TouchableOpacity
                    style={styles.retryFullButton}
                    onPress={handleReset}
                  >
                    <Text style={styles.retryButtonText}>Intentar de Nuevo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  menuContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#4CAF50',
    marginLeft: 12,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4CAF50',
  },
  resultContainer: {
    flex: 1,
  },
  resultContent: {
    flex: 1,
    padding: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4CAF50',
    marginLeft: 8,
  },
  dataCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dataCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dataFieldContainer: {
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 6,
  },
  dataValue: {
    fontSize: 14,
    color: '#111827',
  },
  dataInput: {
    height: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
  },
  dataInputMissing: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  retryButton: {
    backgroundColor: '#F3F4F6',
    marginLeft: 0,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    marginRight: 0,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  confirmButtonTextDisabled: {
    color: '#D1D5DB',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryFullButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  inputsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 12,
    gap: 12,
  },
  priceInputSection: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 8,
  },
  priceInputField: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
  },
  discountInputSection: {
    flex: 1,
  },
  discountInputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 8,
  },
  discountInputField: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
  },
});
