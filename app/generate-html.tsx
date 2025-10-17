import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Share, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useServices } from '@/contexts/ServicesContext';
import { useSettings, BillingCycle } from '@/contexts/SettingsContext';
import * as FileSystem from 'expo-file-system';

const LOGO_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vtxu3dykdqnfq7dlmew6n';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function CycleSummary({ selectedCycle, getServicesByCycle }: { selectedCycle: BillingCycle; getServicesByCycle: (cycleId: string) => any[] }) {
  const cycleServices = getServicesByCycle(selectedCycle.id).filter(s => s.paymentMethod === 'Abonado');
  const totals = cycleServices.reduce((acc, s) => {
    const price = parseFloat(s.price) || 0;
    const discountPercent = parseFloat(s.discountPercent) || 0;
    acc.totalPrice += price;
    acc.totalDiscount += (price * discountPercent / 100);
    acc.totalFinal += (price - (price * discountPercent / 100));
    return acc;
  }, { totalPrice: 0, totalDiscount: 0, totalFinal: 0 });

  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Período:</Text>
        <Text style={styles.summaryValue}>
          {new Date(selectedCycle.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - {selectedCycle.endDate ? new Date(selectedCycle.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Actual'}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total Servicios Abonados:</Text>
        <Text style={styles.summaryValue}>{cycleServices.length}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Ingresos Brutos:</Text>
        <Text style={styles.summaryValue}>{totals.totalPrice.toFixed(2)} €</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Descuentos:</Text>
        <Text style={[styles.summaryValue, styles.discount]}>-{totals.totalDiscount.toFixed(2)} €</Text>
      </View>
      <View style={[styles.summaryRow, styles.summaryRowFinal]}>
        <Text style={styles.summaryLabelFinal}>Total Neto:</Text>
        <Text style={styles.summaryValueFinal}>{totals.totalFinal.toFixed(2)} €</Text>
      </View>
    </View>
  );
}

export default function GenerateHTMLScreen() {
  const router = useRouter();
  const { getServicesByCycle } = useServices();
  const { settings, billingCycles, getActiveCycle } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle | null>(null);
  const [showCycleSelector, setShowCycleSelector] = useState(true);

  React.useEffect(() => {
    const activeCycle = getActiveCycle();
    if (activeCycle) {
      setSelectedCycle(activeCycle);
    } else if (billingCycles.length > 0) {
      const lastClosed = billingCycles
        .filter(c => c.status === 'closed')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (lastClosed) {
        setSelectedCycle(lastClosed);
      }
    }
  }, [billingCycles, getActiveCycle]);

  const generateHTML = (cycle: BillingCycle) => {
    const currentDate = new Date();
    const startDate = new Date(cycle.startDate);
    const endDate = cycle.endDate ? new Date(cycle.endDate) : new Date();
    const generatedDate = currentDate.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const abonadoServices = getServicesByCycle(cycle.id).filter(s => s.paymentMethod === 'Abonado');

    const abonadoTotals = abonadoServices.reduce((acc, service) => {
      const price = parseFloat(service.price) || 0;
      const discountPercent = parseFloat(service.discountPercent) || 0;
      const discountAmount = (price * discountPercent) / 100;
      
      acc.totalPrice += price;
      acc.totalDiscount += discountAmount;
      acc.totalFinal += (price - discountAmount);
      
      return acc;
    }, { totalPrice: 0, totalDiscount: 0, totalFinal: 0 });

    const servicesRows = abonadoServices.map((service, index) => {
      const price = parseFloat(service.price) || 0;
      const discountPercent = parseFloat(service.discountPercent) || 0;
      const discountAmount = (price * discountPercent) / 100;
      const finalPrice = price - discountAmount;

      const formattedDiscountPercent = discountPercent > 0 ? discountPercent.toFixed(2) : '0';
      
      return `
        <tr>
          <td style="color: #6b7280;">${service.date.split('-').reverse().join('-')}</td>
          <td style="color: #374151;">${service.origin} → ${service.destination}</td>
          <td style="color: #374151; padding-left: 4px;">${service.company}</td>
          <td style="text-align: right; color: #374151; white-space: nowrap;">${price.toFixed(2)}&nbsp;€</td>
          <td style="text-align: right; color: ${discountPercent > 0 ? '#ef4444' : '#6b7280'}; white-space: nowrap;">${discountPercent > 0 ? `-${formattedDiscountPercent}%` : '-'}</td>
          <td style="text-align: right; color: #4caf50; font-weight: 700; white-space: nowrap;">${finalPrice.toFixed(2)}&nbsp;€</td>
        </tr>
        ${service.observations ? `
        <tr>
          <td colspan="6" style="padding: 5px 6px 7px 6px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 9px; font-style: italic;">Obs: ${service.observations}</td>
        </tr>
        ` : ''}
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Servicios - Ciclo ${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 15mm 20mm;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #ffffff;
      color: #1f2937;
      line-height: 1.4;
      font-size: 10pt;
      padding: 0;
      margin: 0;
    }
    
    .container {
      width: 100%;
      max-width: 100%;
      margin: 0;
      background: white;
      padding: 0;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #4caf50;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo {
      width: 50px;
      height: 50px;
      object-fit: contain;
    }
    
    .company-info h1 {
      font-size: 15px;
      color: #2d3748;
      margin-bottom: 3px;
      font-weight: 700;
    }
    
    .company-info p {
      font-size: 12px;
      color: #6b7280;
    }
    
    .report-title {
      text-align: right;
    }
    
    .report-title h2 {
      color: #4caf50;
      font-size: 18px;
      margin-bottom: 4px;
      font-weight: 700;
    }
    
    .report-title p {
      color: #6b7280;
      font-size: 11px;
    }
    
    .info-section {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
      padding: 14px;
      background-color: #f9fafb;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 3px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    
    .info-value {
      font-size: 12px;
      color: #2d3748;
      font-weight: 600;
    }
    
    .services-section {
      margin-bottom: 16px;
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10px;
    }
    
    thead {
      background-color: #f3f4f6;
    }
    
    th {
      padding: 8px 6px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      border-bottom: 1px solid #d1d5db;
      border-top: 1px solid #d1d5db;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    
    th.right {
      text-align: right;
    }
    
    td {
      padding: 7px 6px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10px;
      white-space: nowrap;
    }
    
    tr:last-child td {
      border-bottom: 1px solid #d1d5db;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 14px;
      background-color: #f9fafb;
      border-radius: 6px;
      margin-bottom: 12px;
      border: 1px solid #e5e7eb;
    }
    
    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .summary-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    
    .summary-value {
      font-size: 13px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .summary-value.discount {
      color: #ef4444;
    }
    
    .summary-total {
      padding: 10px 14px;
      background-color: #4caf50;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .summary-total .summary-label {
      color: #ffffff;
      font-size: 10px;
    }
    
    .summary-total .summary-value {
      color: #ffffff;
      font-size: 18px;
    }
    
    .footer {
      text-align: center;
      padding-top: 12px;
      margin-top: 12px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 9px;
    }
    
    @media screen {
      body {
        background-color: #f3f4f6;
        padding: 20mm;
      }
      
      .container {
        max-width: 210mm;
        margin: 0 auto;
        padding: 15mm 20mm;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      
      .container {
        box-shadow: none;
        max-width: 100%;
        width: 100%;
        padding: 0;
        margin: 0;
      }
      
      .header {
        margin-bottom: 18px;
      }
      
      .info-section {
        margin-bottom: 18px;
      }
      
      .services-section {
        margin-bottom: 18px;
      }
      
      table {
        page-break-inside: auto;
      }
      
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      thead {
        display: table-header-group;
      }
      
      .header {
        margin-bottom: 20px;
      }
      
      .info-section {
        margin-bottom: 20px;
      }
      
      .services-section {
        margin-bottom: 20px;
      }
      
      .header, .info-section, .summary {
        page-break-inside: avoid;
      }
      
      @page {
        margin: 15mm 20mm;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-section">
        <img src="${LOGO_URL}" alt="Logo" class="logo" />
        <div class="company-info">
          <h1>${settings.cooperativeName}</h1>
          <p>${settings.vehicleId || 'N/A'}</p>
        </div>
      </div>
      <div class="report-title">
        <h2>Reporte de Ciclo</h2>
        <p>${startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} - ${endDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-item">
        <span class="info-label">Conductor</span>
        <span class="info-value">${settings.userName || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Servicios</span>
        <span class="info-value">${abonadoServices.length}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Fecha Generación</span>
        <span class="info-value">${generatedDate}</span>
      </div>
    </div>
    
    <div class="services-section">
      <h3 class="section-title">Detalle de Servicios</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Ruta</th>
            <th style="text-align: left; padding-left: 4px;">Cliente</th>
            <th class="right">Precio</th>
            <th class="right">Desc.</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${servicesRows}
        </tbody>
      </table>
    </div>
    
    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">Total Servicios:</span>
        <span class="summary-value">${abonadoServices.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Ingresos Brutos:</span>
        <span class="summary-value">${abonadoTotals.totalPrice.toFixed(2)}&nbsp;€</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Descuentos:</span>
        <span class="summary-value discount">-${abonadoTotals.totalDiscount.toFixed(2)}&nbsp;€</span>
      </div>
      <div class="summary-total">
        <span class="summary-label">Total Neto:</span>
        <span class="summary-value">${abonadoTotals.totalFinal.toFixed(2)}&nbsp;€</span>
      </div>
    </div>
    
    <div class="footer">
      <p>Generado el ${generatedDate}</p>
    </div>
  </div>
</body>
</html>`;
  };

  const handleGenerate = async () => {
    if (!selectedCycle) {
      Alert.alert('Sin ciclo seleccionado', 'Por favor, selecciona un ciclo de facturación para generar el reporte');
      return;
    }

    const abonadoServices = getServicesByCycle(selectedCycle.id).filter(s => s.paymentMethod === 'Abonado');
    
    if (abonadoServices.length === 0) {
      Alert.alert('Sin datos', 'No hay servicios con método de pago "Abonado" en este ciclo para generar un reporte');
      return;
    }

    setIsGenerating(true);

    try {
      const html = generateHTML(selectedCycle);
      const startDate = new Date(selectedCycle.startDate).toLocaleDateString('es-ES').replace(/\//g, '-');
      const endDate = selectedCycle.endDate ? new Date(selectedCycle.endDate).toLocaleDateString('es-ES').replace(/\//g, '-') : 'actual';
      const fileName = `reporte_${startDate}_${endDate}.html`;

      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Alert.alert('Éxito', 'Reporte HTML descargado correctamente');
      } else {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, html, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Share.share({
          url: fileUri,
          title: fileName,
        });
      }
      
      router.back();
    } catch (error) {
      console.error('HTML generation error:', error);
      Alert.alert('Error', 'No se pudo generar el reporte');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Generar Reporte HTML',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#2D3748',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Reporte Mensual HTML</Text>
          <Text style={styles.description}>
            Genera un reporte profesional en formato HTML que se puede abrir en cualquier navegador, 
            imprimir o compartir fácilmente.
          </Text>

          {selectedCycle && (
            <View style={styles.cycleSelector}>
              <TouchableOpacity 
                style={styles.cycleSelectorHeader}
                onPress={() => setShowCycleSelector(!showCycleSelector)}
              >
                <Text style={styles.cycleSelectorLabel}>Ciclo de Facturación</Text>
                {showCycleSelector ? (
                  <ChevronUp size={20} color="#6B7280" />
                ) : (
                  <ChevronDown size={20} color="#6B7280" />
                )}
              </TouchableOpacity>
              
              {showCycleSelector && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cycleScrollView}>
                  {billingCycles.map((cycle) => {
                    const cycleServices = getServicesByCycle(cycle.id).filter(s => s.paymentMethod === 'Abonado');
                    return (
                      <TouchableOpacity
                        key={cycle.id}
                        style={[
                          styles.cycleButton,
                          selectedCycle.id === cycle.id && styles.cycleButtonActive,
                        ]}
                        onPress={() => setSelectedCycle(cycle)}
                      >
                        <Text style={[
                          styles.cycleButtonDate,
                          selectedCycle.id === cycle.id && styles.cycleButtonDateActive,
                        ]}>
                          {new Date(cycle.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - {cycle.endDate ? new Date(cycle.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Actual'}
                        </Text>
                        <Text style={[
                          styles.cycleButtonStatus,
                          selectedCycle.id === cycle.id && styles.cycleButtonStatusActive,
                        ]}>
                          {cycle.status === 'open' ? 'Abierto' : 'Cerrado'} {cycleServices.length} servicios
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {selectedCycle && (
            <CycleSummary 
              selectedCycle={selectedCycle}
              getServicesByCycle={getServicesByCycle}
            />
          )}

          <View style={styles.features}>
            <Text style={styles.featuresTitle}>Características del reporte:</Text>
            <Text style={styles.featureItem}>✓ Formato profesional A4</Text>
            <Text style={styles.featureItem}>✓ Optimizado para impresión</Text>
            <Text style={styles.featureItem}>✓ Compatible con todos los navegadores</Text>
            <Text style={styles.featureItem}>✓ Fácil de compartir por email</Text>
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
              {isGenerating ? 'Generando...' : Platform.OS === 'web' ? 'Descargar HTML' : 'Compartir HTML'}
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
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  summary: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
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
    borderTopColor: '#4CAF50',
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
  features: {
    marginTop: 8,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2D3748',
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    paddingLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
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
  cycleSelector: {
    marginBottom: 20,
  },
  cycleSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cycleSelectorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  cycleScrollView: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  cycleButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 160,
  },
  cycleButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  cycleButtonDate: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 4,
  },
  cycleButtonDateActive: {
    color: '#4CAF50',
  },
  cycleButtonStatus: {
    fontSize: 11,
    color: '#6B7280',
  },
  cycleButtonStatusActive: {
    color: '#4CAF50',
  },
});
