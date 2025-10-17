import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Share } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { useServices } from '@/contexts/ServicesContext';
import { useSettings } from '@/contexts/SettingsContext';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function ExportCSVScreen() {
  const router = useRouter();
  const { getAllServicesForYear } = useServices();
  const { settings } = useSettings();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const allServices = await getAllServicesForYear();
      
      if (allServices.length === 0) {
        Alert.alert('Sin datos', 'No hay servicios en el registro anual para exportar');
        setIsExporting(false);
        return;
      }

      let csvContent = 'Fecha,Mes,Origen,Destino,Empresa,Precio,Descuento(%),Descuento(€),Total,Observaciones\n';
      
      allServices.forEach(service => {
        const price = parseFloat(service.price) || 0;
        const discountPercent = parseFloat(service.discountPercent) || 0;
        const discountAmount = (price * discountPercent) / 100;
        const finalPrice = price - discountAmount;
        const monthName = MONTH_NAMES[new Date(service.date).getMonth()];
        
        const row = [
          new Date(service.date).toLocaleDateString('es-ES'),
          monthName,
          `"${service.origin}"`,
          `"${service.destination}"`,
          `"${service.company}"`,
          price.toFixed(2),
          service.discountPercent,
          discountAmount.toFixed(2),
          finalPrice.toFixed(2),
          `"${service.observations.replace(/"/g, '""')}"`,
        ].join(',');
        
        csvContent += row + '\n';
      });

      const fileName = `log_anual_${settings.vehicleId}_${new Date().getFullYear()}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Éxito', 'Archivo CSV descargado correctamente');
      } else {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Share.share({
          url: fileUri,
          title: fileName,
        });
      }

      router.back();
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'No se pudo exportar el archivo CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Exportar Log Anual',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#2D3748',
        }}
      />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Exportar Log Anual</Text>
          <Text style={styles.description}>
            Se exportarán todos los servicios del año {new Date().getFullYear()} en formato CSV.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => router.back()}
              disabled={isExporting}
            >
              <Text style={styles.buttonSecondaryText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, isExporting && styles.buttonDisabled]}
              onPress={handleExport}
              disabled={isExporting}
            >
              <Text style={styles.buttonPrimaryText}>
                {isExporting ? 'Exportando...' : 'Exportar CSV'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#4CAF50',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  buttonSecondary: {
    backgroundColor: '#6B7280',
  },
  buttonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
