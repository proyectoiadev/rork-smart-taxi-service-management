import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Modal,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCard, LogOut, Calendar, Clock, Building2, Plus, X, CheckCircle2, Upload, Download, Info, FileText } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { VALID_ACTIVATION_CODES } from '@/constants/activationCodes';
import { useSettings } from '@/contexts/SettingsContext';
import VoiceInput from '@/components/VoiceInput';
import { useRouter } from 'expo-router';

const LOGO_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vtxu3dykdqnfq7dlmew6n';

interface SubscriptionInfo {
  activationDate: string;
  expirationDate: string;
  type: 'trial' | 'renewal';
  daysRemaining: number;
}

export default function ConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewalCode, setRenewalCode] = useState('');
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const { settings, updateSettings, billingCycles, openBillingCycle, closeBillingCycle, getActiveCycle, deleteBillingCycle, loadSettings } = useSettings();
  const [cooperativeName, setCooperativeName] = useState(settings.cooperativeName);
  const [vehicleId, setVehicleId] = useState(settings.vehicleId);
  const [userName, setUserName] = useState(settings.userName);
  const [observations, setObservations] = useState(settings.observations);
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');
  const [newCycleStartDate, setNewCycleStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCloseCycleModal, setShowCloseCycleModal] = useState(false);
  const [closeCycleEndDate, setCloseCycleEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  useEffect(() => {
    setCooperativeName(settings.cooperativeName);
    setVehicleId(settings.vehicleId);
    setUserName(settings.userName);
    setObservations(settings.observations);
  }, [settings]);

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        cooperativeName,
        vehicleId,
        userName,
        observations,
      });
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch {
      Alert.alert('Error', 'No se pudo guardar la configuración');
    }
  };

  const loadSubscriptionInfo = async () => {
    try {
      const activationDate = await AsyncStorage.getItem('activation_date');
      const expirationDate = await AsyncStorage.getItem('activation_expiration');
      const type = await AsyncStorage.getItem('activation_type');

      if (activationDate && expirationDate && type) {
        const now = new Date();
        const expiration = new Date(expirationDate);
        const daysRemaining = Math.max(0, Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        setSubscriptionInfo({
          activationDate,
          expirationDate,
          type: type as 'trial' | 'renewal',
          daysRemaining,
        });
      }
    } catch (error) {
      console.error('Error loading subscription info:', error);
    }
  };

  const formatCode = (text: string) => {
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join('-').substring(0, 19);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleRenewal = async () => {
    const cleanCode = renewalCode.replace(/-/g, '');
    
    if (cleanCode.length !== 16) {
      Alert.alert('Error', 'Por favor, introduce un código completo');
      return;
    }

    try {
      const isValid = VALID_ACTIVATION_CODES.includes(renewalCode);
      
      if (!isValid) {
        Alert.alert('Error', 'Código no válido');
        return;
      }
      
      let deviceId: string = await AsyncStorage.getItem('device_id') || '';
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await AsyncStorage.setItem('device_id', deviceId);
      }
      
      const storedDeviceId = await AsyncStorage.getItem(`code_device_${renewalCode}`);
      
      if (storedDeviceId && storedDeviceId !== deviceId) {
        Alert.alert('Error', 'Este código ya está siendo usado en otro dispositivo');
        return;
      }
      
      const renewalDate = new Date().toISOString();
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90);
      
      await AsyncStorage.setItem('activation_code', renewalCode);
      await AsyncStorage.setItem('activation_date', renewalDate);
      await AsyncStorage.setItem('activation_expiration', expirationDate.toISOString());
      await AsyncStorage.setItem('activation_type', 'renewal');
      await AsyncStorage.setItem(`code_device_${renewalCode}`, deviceId);
      
      Alert.alert('Éxito', 'Suscripción renovada correctamente por 90 días');
      setRenewalCode('');
      setShowRenewal(false);
      await loadSubscriptionInfo();
    } catch (err) {
      console.error('Renewal error:', err);
      Alert.alert('Error', 'Ocurrió un error al renovar la suscripción');
    }
  };

  const handleOpenCycle = async () => {
    if (!newCycleName.trim()) {
      Alert.alert('Error', 'Por favor, introduce un nombre para el ciclo');
      return;
    }

    try {
      await openBillingCycle(newCycleStartDate, newCycleName.trim());
      setShowNewCycleModal(false);
      setNewCycleName('');
      setNewCycleStartDate(new Date().toISOString().split('T')[0]);
      Alert.alert('Éxito', 'Ciclo de facturación abierto correctamente');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo abrir el ciclo');
    }
  };

  const handleCloseCycle = async () => {
    const activeCycle = getActiveCycle();
    if (!activeCycle) {
      Alert.alert('Error', 'No hay un ciclo activo para cerrar');
      return;
    }

    try {
      await closeBillingCycle(activeCycle.id, closeCycleEndDate);
      setShowCloseCycleModal(false);
      setCloseCycleEndDate(new Date().toISOString().split('T')[0]);
      Alert.alert('Éxito', 'Ciclo de facturación cerrado correctamente');
    } catch {
      Alert.alert('Error', 'No se pudo cerrar el ciclo');
    }
  };

  const handleDeleteCycle = (cycleId: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este ciclo? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBillingCycle(cycleId);
              Alert.alert('Éxito', 'Ciclo eliminado correctamente');
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el ciclo');
            }
          },
        },
      ]
    );
  };

  const handleBackup = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const allData = await AsyncStorage.multiGet(allKeys);
      
      const backupData: Record<string, string> = {};
      allData.forEach(([key, value]) => {
        if (value) {
          backupData[key] = value;
        }
      });

      const backupJson = JSON.stringify(backupData, null, 2);
      const backupDate = new Date().toISOString().split('T')[0];
      const backupFileName = `backup_taxi_${backupDate}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = backupFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Éxito', 'Copia de seguridad creada correctamente');
      } else {
        const fileUri = `${FileSystem.documentDirectory}${backupFileName}`;
        await FileSystem.writeAsStringAsync(fileUri, backupJson, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Share.share({
          url: fileUri,
          title: 'Copia de Seguridad',
          message: 'Copia de seguridad de la aplicación de taxi. Guarda este archivo en un lugar seguro.',
        });

        Alert.alert('Éxito', 'Copia de seguridad creada. Guarda el archivo en un lugar seguro y no lo compartas con nadie.');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      Alert.alert('Error', 'No se pudo crear la copia de seguridad');
    }
  };

  const handleRestore = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event: any) => {
              try {
                const backupData = JSON.parse(event.target.result);
                await restoreBackupData(backupData);
              } catch (error) {
                console.error('Error parsing backup file:', error);
                Alert.alert('Error', 'El archivo de respaldo no es válido');
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (result.canceled) {
          return;
        }

        const fileUri = result.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const backupData = JSON.parse(fileContent);
        await restoreBackupData(backupData);
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      Alert.alert('Error', 'No se pudo restaurar la copia de seguridad');
    }
  };

  const restoreBackupData = async (backupData: Record<string, string>) => {
    Alert.alert(
      'Confirmar Restauración',
      '¿Estás seguro de que quieres restaurar esta copia de seguridad? Esto sobrescribirá todos tus datos actuales.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            try {
              const entries = Object.entries(backupData);
              await AsyncStorage.multiSet(entries);
              
              Alert.alert(
                'Éxito',
                'Copia de seguridad restaurada correctamente. La aplicación se recargará.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      if (Platform.OS === 'web') {
                        window.location.reload();
                      } else {
                        loadSubscriptionInfo();
                        loadSettings();
                      }
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Error restoring data:', error);
              Alert.alert('Error', 'No se pudo restaurar los datos');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir de la aplicación? Tu código de activación se mantendrá guardado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            } else {
              Alert.alert(
                'Información',
                'Para cerrar la aplicación en iOS, presiona el botón de inicio o desliza hacia arriba desde la parte inferior de la pantalla.',
                [{ text: 'Entendido' }]
              );
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Ajustes</Text>
        <Text style={styles.headerSubtitle}>Configuración de la aplicación</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Empresa</Text>
          
          <View style={styles.settingsCard}>
            <View style={styles.settingsCardHeader}>
              <View style={styles.settingsCardIcon}>
                <Building2 size={24} color="#4CAF50" />
              </View>
              <Text style={styles.settingsCardTitle}>Datos de la Empresa</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre de la Cooperativa</Text>
              <TextInput
                style={styles.input}
                value={cooperativeName}
                onChangeText={setCooperativeName}
                placeholder="Nombre de la cooperativa"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ID del Vehículo</Text>
              <TextInput
                style={styles.input}
                value={vehicleId}
                onChangeText={setVehicleId}
                placeholder="ID del vehículo"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre del Usuario</Text>
              <TextInput
                style={styles.input}
                value={userName}
                onChangeText={setUserName}
                placeholder="Nombre del usuario"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={[styles.inputGroup, styles.inputGroupMultiline]}>
              <Text style={styles.inputLabel}>Observaciones</Text>
              <VoiceInput
                value={observations}
                onChangeText={setObservations}
                placeholder="Añade observaciones sobre la empresa..."
                multiline
                numberOfLines={4}
              />
            </View>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveSettings}
            >
              <Text style={styles.saveButtonText}>Guardar Configuración</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suscripción</Text>
          
          {subscriptionInfo && (
            <View style={styles.subscriptionInfoCard}>
              <View style={styles.subscriptionHeader}>
                <View style={styles.subscriptionBadge}>
                  <Text style={styles.subscriptionBadgeText}>
                    {subscriptionInfo.type === 'trial' ? 'Período de Prueba' : 'Suscripción Activa'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.subscriptionDetails}>
                <View style={styles.subscriptionDetailRow}>
                  <View style={styles.subscriptionDetailIcon}>
                    <Calendar size={20} color="#6B7280" />
                  </View>
                  <View style={styles.subscriptionDetailContent}>
                    <Text style={styles.subscriptionDetailLabel}>Fecha de Activación</Text>
                    <Text style={styles.subscriptionDetailValue}>
                      {formatDate(subscriptionInfo.activationDate)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.subscriptionDetailRow}>
                  <View style={styles.subscriptionDetailIcon}>
                    <Clock size={20} color="#6B7280" />
                  </View>
                  <View style={styles.subscriptionDetailContent}>
                    <Text style={styles.subscriptionDetailLabel}>Tiempo Restante</Text>
                    <Text style={[styles.subscriptionDetailValue, subscriptionInfo.daysRemaining <= 5 && styles.subscriptionDetailValueWarning]}>
                      {subscriptionInfo.daysRemaining} {subscriptionInfo.daysRemaining === 1 ? 'día' : 'días'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.subscriptionDetailRow}>
                  <View style={styles.subscriptionDetailIcon}>
                    <Calendar size={20} color="#6B7280" />
                  </View>
                  <View style={styles.subscriptionDetailContent}>
                    <Text style={styles.subscriptionDetailLabel}>Fecha de Expiración</Text>
                    <Text style={styles.subscriptionDetailValue}>
                      {formatDate(subscriptionInfo.expirationDate)}
                    </Text>
                  </View>
                </View>
              </View>
              
              {subscriptionInfo.type === 'trial' && (
                <View style={styles.subscriptionNote}>
                  <Text style={styles.subscriptionNoteText}>💡 Después del período de prueba de 10 días, necesitarás renovar tu suscripción por 90 días (29.99€ por trimestre).</Text>
                </View>
              )}
            </View>
          )}
          
          {!showRenewal ? (
            <>
              <TouchableOpacity
                style={styles.card}
                onPress={() => setShowPricingModal(true)}
              >
                <View style={styles.cardIcon}>
                  <Info size={24} color="#3B82F6" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Información de Precios</Text>
                  <Text style={styles.cardDescription}>
                    Ver detalles de la suscripción y características
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.card, { marginTop: 12 }]}
                onPress={() => setShowRenewal(true)}
              >
                <View style={styles.cardIcon}>
                  <CreditCard size={24} color="#4CAF50" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Renovar Suscripción</Text>
                  <Text style={styles.cardDescription}>
                    Introduce un código de activación para extender tu suscripción
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.renewalCard}>
              <View style={styles.renewalLogoContainer}>
                <Image 
                  source={{ uri: LOGO_URL }}
                  style={styles.renewalLogo}
                  resizeMode="contain"
                  defaultSource={require('@/assets/images/icon.png')}
                />
              </View>
              <Text style={styles.renewalTitle}>Código de Renovación</Text>
              <TextInput
                style={styles.renewalInput}
                value={renewalCode}
                onChangeText={(text) => setRenewalCode(formatCode(text))}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={19}
              />
              <View style={styles.renewalActions}>
                <TouchableOpacity
                  style={[styles.renewalButton, styles.renewalButtonSecondary]}
                  onPress={() => {
                    setShowRenewal(false);
                    setRenewalCode('');
                  }}
                >
                  <Text style={styles.renewalButtonSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renewalButton, styles.renewalButtonPrimary]}
                  onPress={handleRenewal}
                >
                  <Text style={styles.renewalButtonPrimaryText}>Renovar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ciclos de Facturación</Text>
          
          <View style={styles.cyclesCard}>
            <View style={styles.cyclesHeader}>
              <Text style={styles.cyclesHeaderTitle}>Gestionar Ciclos</Text>
              <Text style={styles.cyclesHeaderSubtitle}>
                Los servicios de abonados se registran dentro de ciclos de facturación
              </Text>
            </View>

            {getActiveCycle() ? (
              <View style={styles.activeCycleCard}>
                <View style={styles.activeCycleHeader}>
                  <View style={styles.activeCycleBadge}>
                    <CheckCircle2 size={16} color="#4CAF50" />
                    <Text style={styles.activeCycleBadgeText}>Ciclo Activo</Text>
                  </View>
                </View>
                <View style={styles.activeCycleInfo}>
                  <Text style={styles.activeCycleLabel}>Nombre del ciclo:</Text>
                  <Text style={styles.activeCycleValue}>
                    {getActiveCycle()!.name}
                  </Text>
                </View>
                <View style={styles.activeCycleInfo}>
                  <Text style={styles.activeCycleLabel}>Fecha de inicio:</Text>
                  <Text style={styles.activeCycleValue}>
                    {new Date(getActiveCycle()!.startDate).toLocaleDateString('es-ES', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeCycleButton}
                  onPress={() => setShowCloseCycleModal(true)}
                >
                  <Text style={styles.closeCycleButtonText}>Cerrar Ciclo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.openCycleButton}
                onPress={() => setShowNewCycleModal(true)}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.openCycleButtonText}>Abrir Nuevo Ciclo</Text>
              </TouchableOpacity>
            )}

            {billingCycles.filter(c => c.status === 'closed').length > 0 && (
              <View style={styles.closedCyclesSection}>
                <Text style={styles.closedCyclesTitle}>Ciclos Cerrados</Text>
                {billingCycles
                  .filter(c => c.status === 'closed')
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((cycle) => (
                    <View key={cycle.id} style={styles.closedCycleItem}>
                      <View style={styles.closedCycleInfo}>
                        <Text style={styles.closedCycleName}>{cycle.name}</Text>
                        <View style={styles.closedCycleDates}>
                          <Text style={styles.closedCycleDate}>
                            {new Date(cycle.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </Text>
                          <Text style={styles.closedCycleSeparator}> - </Text>
                          <Text style={styles.closedCycleDate}>
                            {cycle.endDate ? new Date(cycle.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.closedCycleActions}>
                        <TouchableOpacity
                          style={styles.viewReportButton}
                          onPress={() => router.push(`/cycle-report?cycleId=${cycle.id}`)}
                        >
                          <FileText size={16} color="#4CAF50" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteCycleButton}
                          onPress={() => handleDeleteCycle(cycle.id)}
                        >
                          <X size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Copia de Seguridad</Text>
          
          <View style={styles.backupCard}>
            <Text style={styles.backupCardTitle}>Respalda tus datos</Text>
            <Text style={styles.backupCardDescription}>Guarda una copia de seguridad de tus servicios, configuración y código de activación</Text>
            <View style={styles.backupButtonsContainer}>
              <TouchableOpacity
                style={styles.backupButton}
                onPress={handleBackup}
              >
                <Download size={20} color="#FFFFFF" />
                <Text style={styles.backupButtonText}>Crear Backup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.backupButton, styles.restoreButton]}
                onPress={handleRestore}
              >
                <Upload size={20} color="#FFFFFF" />
                <Text style={styles.backupButtonText}>Restaurar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          
          <TouchableOpacity
            style={[styles.card, styles.dangerCard]}
            onPress={handleLogout}
          >
            <View style={[styles.cardIcon, styles.dangerIcon]}>
              <LogOut size={24} color="#EF4444" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, styles.dangerText]}>Salir de la Aplicación</Text>
              <Text style={styles.cardDescription}>
                Cerrar la aplicación. Tu suscripción permanecerá activa
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showNewCycleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewCycleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Abrir Nuevo Ciclo</Text>
              <TouchableOpacity onPress={() => setShowNewCycleModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Nombre del ciclo</Text>
              <TextInput
                style={styles.modalInput}
                value={newCycleName}
                onChangeText={setNewCycleName}
                placeholder="Ej: Ciclo Enero 2025, Quincena 1, etc."
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.modalLabel}>Fecha de inicio del ciclo</Text>
              <TextInput
                style={styles.modalInput}
                value={newCycleStartDate}
                onChangeText={setNewCycleStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.modalNote}>
                Los servicios de abonados se registrarán en este ciclo hasta que lo cierres.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowNewCycleModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleOpenCycle}
              >
                <Text style={styles.modalButtonPrimaryText}>Abrir Ciclo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCloseCycleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCloseCycleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cerrar Ciclo Activo</Text>
              <TouchableOpacity onPress={() => setShowCloseCycleModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Fecha de cierre del ciclo</Text>
              <TextInput
                style={styles.modalInput}
                value={closeCycleEndDate}
                onChangeText={setCloseCycleEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.modalNote}>
                Después de cerrar este ciclo, deberás abrir uno nuevo para registrar más servicios de abonados.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowCloseCycleModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCloseCycle}
              >
                <Text style={styles.modalButtonPrimaryText}>Cerrar Ciclo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPricingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPricingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pricingModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suscripción Premium</Text>
              <TouchableOpacity onPress={() => setShowPricingModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.pricingModalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.pricingHeader}>
                <View style={styles.pricingBadge}>
                  <Text style={styles.pricingBadgeText}>PLAN TRIMESTRAL</Text>
                </View>
                <Text style={styles.pricingAmount}>29.99€</Text>
                <Text style={styles.pricingPeriod}>por 90 días</Text>
              </View>
              
              <View style={styles.featuresSection}>
                <Text style={styles.featuresSectionTitle}>Características Incluidas</Text>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <CheckCircle2 size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>Registro Ilimitado de Servicios</Text>
                    <Text style={styles.featureDescription}>Registra todos tus servicios sin límites</Text>
                  </View>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <CheckCircle2 size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>Gestión de Abonados</Text>
                    <Text style={styles.featureDescription}>Control completo de clientes y ciclos de facturación</Text>
                  </View>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <CheckCircle2 size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>Reportes y Estadísticas</Text>
                    <Text style={styles.featureDescription}>Genera reportes detallados en PDF y CSV</Text>
                  </View>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <CheckCircle2 size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>Entrada por Voz</Text>
                    <Text style={styles.featureDescription}>Registra servicios usando comandos de voz</Text>
                  </View>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <CheckCircle2 size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>Copia de Seguridad</Text>
                    <Text style={styles.featureDescription}>Respalda y restaura todos tus datos</Text>
                  </View>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <CheckCircle2 size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>Soporte Prioritario</Text>
                    <Text style={styles.featureDescription}>Asistencia rápida cuando la necesites</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.renewalInfoSection}>
                <View style={styles.renewalInfoCard}>
                  <Text style={styles.renewalInfoTitle}>📞 Cómo Renovar</Text>
                  <Text style={styles.renewalInfoText}>
                    Para renovar tu suscripción, contacta a soporte y solicita un código de activación. Cada código es único y válido por 90 días.
                  </Text>
                </View>
                
                <View style={styles.renewalInfoCard}>
                  <Text style={styles.renewalInfoTitle}>🔒 Seguridad</Text>
                  <Text style={styles.renewalInfoText}>
                    Cada código de activación está vinculado a tu dispositivo. No compartas tu código con nadie.
                  </Text>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.pricingModalActions}>
              <TouchableOpacity
                style={styles.pricingModalButton}
                onPress={() => {
                  setShowPricingModal(false);
                  setShowRenewal(true);
                }}
              >
                <Text style={styles.pricingModalButtonText}>Renovar Ahora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  dangerIcon: {
    backgroundColor: '#FEE2E2',
  },
  dangerText: {
    color: '#EF4444',
  },
  renewalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  renewalLogoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  renewalLogo: {
    width: 100,
    height: 100,
  },
  renewalTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  renewalInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
    letterSpacing: 2,
    color: '#111827',
    marginBottom: 16,
  },
  renewalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  renewalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewalButtonPrimary: {
    backgroundColor: '#4CAF50',
  },
  renewalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  renewalButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  renewalButtonSecondaryText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  subscriptionInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  subscriptionHeader: {
    marginBottom: 16,
  },
  subscriptionBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  subscriptionBadgeText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  subscriptionDetails: {
    gap: 12,
  },
  subscriptionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionDetailIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subscriptionDetailContent: {
    flex: 1,
  },
  subscriptionDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  subscriptionDetailValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  subscriptionDetailValueWarning: {
    color: '#EF4444',
  },
  subscriptionNote: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  subscriptionNoteText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsCardTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupMultiline: {
    marginBottom: 24,
  },
  inputLabel: {
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
    color: '#111827',
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
  cyclesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cyclesHeader: {
    marginBottom: 16,
  },
  cyclesHeaderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  cyclesHeaderSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  activeCycleCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  activeCycleHeader: {
    marginBottom: 12,
  },
  activeCycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeCycleBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4CAF50',
  },
  activeCycleInfo: {
    marginBottom: 12,
  },
  activeCycleLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  activeCycleValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
  },
  closeCycleButton: {
    backgroundColor: '#EF4444',
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCycleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  openCycleButton: {
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  openCycleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  closedCyclesSection: {
    marginTop: 8,
  },
  closedCyclesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 12,
  },
  closedCycleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  closedCycleInfo: {
    flex: 1,
  },
  closedCycleName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  closedCycleDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closedCycleDate: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#374151',
  },
  closedCycleSeparator: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  closedCycleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewReportButton: {
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
  },
  deleteCycleButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  modalNote: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#4CAF50',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonSecondaryText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  backupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backupCardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 8,
  },
  backupCardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  backupButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backupButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restoreButton: {
    backgroundColor: '#10B981',
  },
  backupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  pricingModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  pricingModalBody: {
    maxHeight: 500,
  },
  pricingHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pricingBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  pricingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  pricingAmount: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  pricingPeriod: {
    fontSize: 16,
    color: '#6B7280',
  },
  featuresSection: {
    padding: 20,
  },
  featuresSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  renewalInfoSection: {
    padding: 20,
    paddingTop: 0,
  },
  renewalInfoCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  renewalInfoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 8,
  },
  renewalInfoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  pricingModalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  pricingModalButton: {
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
