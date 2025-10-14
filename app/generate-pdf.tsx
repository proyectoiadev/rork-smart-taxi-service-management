import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Share, ScrollView, Image, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useServices } from '@/contexts/ServicesContext';
import { useSettings } from '@/contexts/SettingsContext';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PDF_WIDTH = 1123;
const PDF_HEIGHT = 794;

const LOGO_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vtxu3dykdqnfq7dlmew6n';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function GeneratePDFScreen() {
  const router = useRouter();
  const { services, currentMonth, totals } = useServices();
  const { settings } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
  const viewRef = useRef<View>(null);

  const handleGenerate = async () => {
    if (services.length === 0) {
      Alert.alert('Sin datos', 'No hay servicios para generar un PDF');
      return;
    }

    setIsGenerating(true);

    try {
      if (Platform.OS === 'web') {
        window.print();
        Alert.alert('Éxito', 'Usa la función de imprimir del navegador para guardar como PDF');
      } else {
        const uri = await captureRef(viewRef, {
          format: 'png',
          quality: 1,
          width: PDF_WIDTH * 2,
        });

        const fileName = `resumen_${MONTH_NAMES[currentMonth]}_${new Date().getFullYear()}.png`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.copyAsync({
          from: uri,
          to: fileUri,
        });

        await Share.share({
          url: fileUri,
          title: fileName,
        });
      }
      
      router.back();
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'No se pudo generar el documento');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Generar PDF',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#2D3748',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Vista Previa - Documento Completo</Text>
          <Text style={styles.previewSubLabel}>{services.length} servicios en total</Text>
        </View>
        <View ref={viewRef} collapsable={false} style={styles.pdfDocument}>
          <View style={styles.pdfPage}>
            <View style={styles.pdfHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Image 
                  source={{ uri: LOGO_URL }}
                  style={styles.pdfLogo}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.pdfTitle}>{settings.cooperativeName}</Text>
                  <Text style={styles.pdfSubtitle}>{settings.vehicleId}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pdfMonth}>{MONTH_NAMES[currentMonth]} {new Date().getFullYear()}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                  {services.length} servicios
                </Text>
              </View>
            </View>

            <View style={styles.pdfSummary}>
              <View style={styles.pdfSummaryRow}>
                <Text style={styles.pdfSummaryLabel}>Total Bruto</Text>
                <Text style={styles.pdfSummaryValue}>{totals.totalPrice.toFixed(2)} €</Text>
              </View>
              <View style={styles.pdfSummaryRow}>
                <Text style={styles.pdfSummaryLabel}>Descuentos</Text>
                <Text style={[styles.pdfSummaryValue, styles.pdfDiscount]}>
                  -{totals.totalDiscount.toFixed(2)} €
                </Text>
              </View>
              <View style={[styles.pdfSummaryRow, styles.pdfSummaryRowFinal]}>
                <Text style={styles.pdfSummaryLabelFinal}>Total a Cobrar</Text>
                <Text style={styles.pdfSummaryValueFinal}>{totals.totalFinal.toFixed(2)} €</Text>
              </View>
            </View>

            <View style={styles.pdfServices}>
              <Text style={styles.pdfServicesTitle}>Detalle de Servicios</Text>
              
              <View style={styles.pdfTable}>
                <View style={styles.pdfTableHeader}>
                  <Text style={[styles.pdfTableHeaderCell, { width: 35 }]}>#</Text>
                  <Text style={[styles.pdfTableHeaderCell, { width: 70 }]}>Fecha</Text>
                  <Text style={[styles.pdfTableHeaderCell, { flex: 1, minWidth: 200 }]}>Ruta</Text>
                  <Text style={[styles.pdfTableHeaderCell, { width: 180 }]}>Empresa</Text>
                  <Text style={[styles.pdfTableHeaderCell, { width: 75, textAlign: 'right' as const }]}>Importe</Text>
                  <Text style={[styles.pdfTableHeaderCell, { width: 65, textAlign: 'right' as const }]}>Desc.</Text>
                  <Text style={[styles.pdfTableHeaderCell, { width: 85, textAlign: 'right' as const }]}>Total</Text>
                </View>
                
                {services.map((service, index) => {
                  const price = parseFloat(service.price) || 0;
                  const discountPercent = parseFloat(service.discountPercent) || 0;
                  const discountAmount = (price * discountPercent) / 100;
                  const finalPrice = price - discountAmount;

                  return (
                    <View key={service.id} style={styles.pdfTableRow}>
                      <Text style={[styles.pdfTableCell, { width: 35 }]}>{index + 1}</Text>
                      <Text style={[styles.pdfTableCell, { width: 70 }]}>
                        {new Date(service.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      </Text>
                      <Text style={[styles.pdfTableCell, { flex: 1, minWidth: 200 }]} numberOfLines={1}>
                        {service.origin} → {service.destination}
                      </Text>
                      <Text style={[styles.pdfTableCell, { width: 180 }]} numberOfLines={1}>
                        {service.company}
                      </Text>
                      <Text style={[styles.pdfTableCell, { width: 75, textAlign: 'right' as const }]}>
                        {price.toFixed(2)}€
                      </Text>
                      <Text style={[styles.pdfTableCell, { width: 65, textAlign: 'right' as const, color: discountPercent > 0 ? '#EF4444' : '#6B7280' }]}>
                        {discountPercent > 0 ? `-${discountPercent}%` : '-'}
                      </Text>
                      <Text style={[styles.pdfTableCell, { width: 85, textAlign: 'right' as const, fontWeight: '700' as const, color: '#4CAF50' }]}>
                        {finalPrice.toFixed(2)}€
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => router.back()}
            disabled={isGenerating}
          >
            <Text style={styles.buttonSecondaryText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, isGenerating && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            <Text style={styles.buttonPrimaryText}>
              {isGenerating ? 'Generando...' : Platform.OS === 'web' ? 'Imprimir' : 'Compartir'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
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
    marginBottom: 24,
    lineHeight: 24,
  },
  summary: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryRowFinal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  discount: {
    color: '#EF4444',
  },
  summaryLabelFinal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2D3748',
  },
  summaryValueFinal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4CAF50',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  previewContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    textAlign: 'center',
  },
  previewSubLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  pdfDocument: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  pdfPage: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    width: PDF_WIDTH,
  },
  pdfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  pdfLogo: {
    width: 60,
    height: 60,
  },
  pdfTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 4,
  },
  pdfSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  pdfMonth: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#4CAF50',
  },
  pdfSummary: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pdfSummaryRow: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pdfSummaryRowFinal: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  pdfSummaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  pdfSummaryValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    textAlign: 'center',
  },
  pdfDiscount: {
    color: '#EF4444',
  },
  pdfSummaryLabelFinal: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 4,
    textAlign: 'center',
  },
  pdfSummaryValueFinal: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#4CAF50',
    textAlign: 'center',
  },
  pdfServices: {
    marginTop: 8,
  },
  pdfServicesTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  pdfTable: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  pdfTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 2,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pdfTableHeaderCell: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#374151',
    textTransform: 'uppercase',
  },
  pdfTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  pdfTableCell: {
    fontSize: 10,
    color: '#4B5563',
  },
});
