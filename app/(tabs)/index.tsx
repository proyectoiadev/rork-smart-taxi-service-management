import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Plus, Edit2, Calendar, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ScanLine } from 'lucide-react-native';
import { useSettings } from '@/contexts/SettingsContext';
import { useServices, Service, PaymentMethod } from '@/contexts/ServicesContext';
import { useRecurringClients } from '@/contexts/RecurringClientsContext';
import { useRecurringServices } from '@/contexts/RecurringServicesContext';
import VoiceInput, { VoiceButton } from '@/components/VoiceInput';
import TicketScanner from '@/components/TicketScanner';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function HomeScreen() {
  const { settings, getActiveCycle } = useSettings();
  const { services, currentMonth, isLoading, totals, addService, deleteService, updateService, changeMonth } = useServices();
  const { clients, addOrUpdateClient, getClientByName } = useRecurringClients();
  const { recordService, getCompanyDiscount, getRoutePrice, getCompanyRoutePreference, getOriginSuggestions, getDestinationSuggestions } = useRecurringServices();
  const insets = useSafeAreaInsets();
  
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [company, setCompany] = useState('');
  const [price, setPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [observations, setObservations] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tarjeta');
  const [clientName, setClientName] = useState('');
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isAddServiceExpanded, setIsAddServiceExpanded] = useState(true);
  const [showTicketScanner, setShowTicketScanner] = useState(false);

  useEffect(() => {
    if (paymentMethod === 'Abonado' && clientName) {
      const discount = getCompanyDiscount(clientName);
      if (discount && discountPercent === '0') {
        setDiscountPercent(discount);
      }
    }
  }, [clientName, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === 'Abonado' && clientName && origin && destination) {
      const preference = getCompanyRoutePreference(clientName, origin, destination);
      if (preference) {
        if (!price || price === '0') {
          setPrice(preference.price);
        }
        if (discountPercent === '0') {
          setDiscountPercent(preference.discountPercent);
        }
      } else {
        const routePrice = getRoutePrice(origin, destination);
        if (routePrice && (!price || price === '0')) {
          setPrice(routePrice);
        }
      }
    }
  }, [clientName, origin, destination, paymentMethod]);

  
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDiscountPercent, setEditDiscountPercent] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('Tarjeta');
  const [editClientName, setEditClientName] = useState('');
  const [showEditPaymentPicker, setShowEditPaymentPicker] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [editCalendarMonth, setEditCalendarMonth] = useState(new Date());
  const [selectedViewDate, setSelectedViewDate] = useState<string | null>(null);
  const [showViewDatePicker, setShowViewDatePicker] = useState(false);
  const [viewCalendarMonth, setViewCalendarMonth] = useState(new Date());



  const handleSubmit = async () => {
    console.log('handleSubmit called, paymentMethod:', paymentMethod);
    
    if (paymentMethod === 'Abonado') {
      const activeCycle = getActiveCycle();
      console.log('Active cycle:', activeCycle);
      console.log('Checking activation status...');
      console.log('Is valid:', activeCycle ? true : false);
      console.log('Activated:', activeCycle ? true : false);
      console.log('Expiration date:', activeCycle ? activeCycle.endDate : 'N/A');
      console.log('Current date:', new Date().toISOString());
      
      if (!activeCycle) {
        console.log('No active cycle found, showing alert');
        Alert.alert(
          'Sin ciclo activo',
          'No hay un ciclo de facturación abierto. Por favor, abre un ciclo en Ajustes antes de registrar servicios de abonados.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      console.log('Active cycle found, continuing...');
    }

    if (paymentMethod === 'Abonado') {
      if (!origin || !destination || !clientName || !price) {
        console.log('Missing required fields:', { origin, destination, clientName, price });
        Alert.alert('Error', 'Por favor, completa todos los campos requeridos');
        return;
      }
    } else {
      if (!price) {
        Alert.alert('Error', 'Por favor, completa el campo precio');
        return;
      }
    }

    try {
      console.log('Starting service creation...');
      
      if (paymentMethod === 'Abonado' && clientName) {
        console.log('Adding/updating client:', clientName);
        try {
          await addOrUpdateClient({
            companyName: clientName,
          });
          console.log('Client added/updated successfully');
        } catch (clientError) {
          console.error('Error adding/updating client:', clientError);
        }
        
        console.log('Recording recurring service data...');
        try {
          await recordService({
            companyName: clientName,
            origin,
            destination,
            price,
            discountPercent,
          });
          console.log('Recurring service recorded successfully');
        } catch (recurringError) {
          console.error('Error recording recurring service:', recurringError);
        }
      }

      const activeCycle = getActiveCycle();
      const billingCycleId = paymentMethod === 'Abonado' && activeCycle ? activeCycle.id : undefined;
      
      console.log('Billing cycle ID:', billingCycleId);
      console.log('Service data:', {
        date: serviceDate,
        origin: paymentMethod === 'Abonado' ? origin : '',
        destination: paymentMethod === 'Abonado' ? destination : '',
        company: paymentMethod === 'Abonado' ? clientName : '',
        price,
        discountPercent: paymentMethod === 'Abonado' ? discountPercent : '0',
        observations: paymentMethod === 'Abonado' ? observations : '',
        paymentMethod,
        clientName: paymentMethod === 'Abonado' ? clientName : undefined,
      });

      console.log('Calling addService...');
      await addService({
        date: serviceDate,
        origin: paymentMethod === 'Abonado' ? origin : '',
        destination: paymentMethod === 'Abonado' ? destination : '',
        company: paymentMethod === 'Abonado' ? clientName : '',
        price,
        discountPercent: paymentMethod === 'Abonado' ? discountPercent : '0',
        observations: paymentMethod === 'Abonado' ? observations : '',
        paymentMethod,
        clientName: paymentMethod === 'Abonado' ? clientName : undefined,
        clientId: undefined,
        clientPhone: undefined,
      }, billingCycleId);
      console.log('addService completed successfully');
      
      console.log('Service added successfully');
      setOrigin('');
      setDestination('');
      setCompany('');
      setPrice('');
      setDiscountPercent('0');
      setObservations('');
      setServiceDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Tarjeta');
      setClientName('');
      Alert.alert('Éxito', 'Servicio añadido correctamente');
    } catch (error) {
      console.error('Error adding service:', error);
      Alert.alert('Error', 'No se pudo añadir el servicio: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este servicio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteService(id),
        },
      ]
    );
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setEditDate(service.date);
    setEditOrigin(service.origin);
    setEditDestination(service.destination);
    setEditCompany(service.company);
    setEditPrice(service.price);
    setEditDiscountPercent(service.discountPercent);
    setEditObservations(service.observations);
    setEditPaymentMethod(service.paymentMethod);
    setEditClientName(service.clientName || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingService) {
      return;
    }
    
    if (editPaymentMethod === 'Abonado') {
      const activeCycle = getActiveCycle();
      if (!activeCycle && editingService.paymentMethod !== 'Abonado') {
        Alert.alert(
          'Sin ciclo activo',
          'No hay un ciclo de facturación abierto. Por favor, abre un ciclo en Ajustes antes de cambiar a método de pago Abonado.',
          [{ text: 'Entendido' }]
        );
        return;
      }
    }

    if (editPaymentMethod === 'Abonado') {
      if (!editOrigin || !editDestination || !editCompany || !editPrice) {
        Alert.alert('Error', 'Por favor, completa todos los campos requeridos');
        return;
      }
    } else {
      if (!editPrice) {
        Alert.alert('Error', 'Por favor, completa el campo precio');
        return;
      }
    }

    try {
      const activeCycle = getActiveCycle();
      const billingCycleId = editPaymentMethod === 'Abonado' && activeCycle ? activeCycle.id : undefined;

      await updateService(editingService.id, {
        date: editDate,
        origin: editPaymentMethod === 'Abonado' ? editOrigin : '',
        destination: editPaymentMethod === 'Abonado' ? editDestination : '',
        company: editPaymentMethod === 'Abonado' ? editCompany : '',
        price: editPrice,
        discountPercent: editPaymentMethod === 'Abonado' ? editDiscountPercent : '0',
        observations: editPaymentMethod === 'Abonado' ? editObservations : '',
        paymentMethod: editPaymentMethod,
        clientName: editPaymentMethod === 'Abonado' ? editClientName : undefined,
        clientId: undefined,
        clientPhone: undefined,
      });
      setShowEditModal(false);
      setEditingService(null);
      Alert.alert('Éxito', 'Servicio actualizado correctamente');
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el servicio');
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingService(null);
  };

  const handleServicesExtracted = async (services: Omit<Service, 'id'>[]) => {
    try {
      for (const service of services) {
        await addService(service);
      }
      Alert.alert('Éxito', `${services.length} servicio(s) añadido(s) correctamente`);
    } catch (error) {
      console.error('Error adding scanned services:', error);
      Alert.alert('Error', 'No se pudieron añadir algunos servicios');
    }
  };

  const sortedServices = [...services].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const filteredServices = selectedViewDate 
    ? sortedServices.filter(s => s.date === selectedViewDate)
    : sortedServices.filter(s => s.date === new Date().toISOString().split('T')[0]);

  const abonadoServices = filteredServices.filter(s => s.paymentMethod === 'Abonado');

  const todayTotal = useMemo(() => {
    const todayServices = services.filter(s => s.date === new Date().toISOString().split('T')[0]);
    return todayServices.reduce((acc, service) => {
      const price = parseFloat(service.price) || 0;
      const discountPercent = parseFloat(service.discountPercent) || 0;
      const discountAmount = (price * discountPercent) / 100;
      return acc + (price - discountAmount);
    }, 0);
  }, [services]);

  const monthTotal = useMemo(() => {
    return services.reduce((acc, service) => {
      const price = parseFloat(service.price) || 0;
      const discountPercent = parseFloat(service.discountPercent) || 0;
      const discountAmount = (price * discountPercent) / 100;
      return acc + (price - discountAmount);
    }, 0);
  }, [services]);

  const getVisibleMonths = () => {
    const months = [];
    const today = new Date();
    const currentMonthIndex = today.getMonth();
    
    for (let i = 3; i >= 0; i--) {
      let monthIndex = currentMonthIndex - i;
      if (monthIndex < 0) {
        monthIndex += 12;
      }
      months.push(monthIndex);
    }
    return months;
  };

  const visibleMonths = getVisibleMonths();

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const handleDateSelect = (day: number, isEdit: boolean = false, isViewFilter: boolean = false) => {
    const month = isViewFilter ? viewCalendarMonth : (isEdit ? editCalendarMonth : calendarMonth);
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (isViewFilter) {
      setSelectedViewDate(dateStr);
      setShowViewDatePicker(false);
    } else if (isEdit) {
      setEditDate(dateStr);
      setShowEditDatePicker(false);
    } else {
      setServiceDate(dateStr);
      setShowDatePicker(false);
    }
  };

  const renderCalendar = (isEdit: boolean = false, isViewFilter: boolean = false) => {
    const month = isViewFilter ? viewCalendarMonth : (isEdit ? editCalendarMonth : calendarMonth);
    const { daysInMonth, startingDayOfWeek, year, month: monthNum } = getDaysInMonth(month);
    const selectedDate = isViewFilter ? selectedViewDate : (isEdit ? editDate : serviceDate);
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isSelected && styles.calendarDaySelected,
            isToday && !isSelected && styles.calendarDayToday,
          ]}
          onPress={() => handleDateSelect(day, isEdit, isViewFilter)}
        >
          <Text style={[
            styles.calendarDayText,
            isSelected && styles.calendarDayTextSelected,
            isToday && !isSelected && styles.calendarDayTextToday,
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }
    
    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => {
              const newMonth = new Date(month);
              newMonth.setMonth(newMonth.getMonth() - 1);
              if (isViewFilter) {
                setViewCalendarMonth(newMonth);
              } else if (isEdit) {
                setEditCalendarMonth(newMonth);
              } else {
                setCalendarMonth(newMonth);
              }
            }}
            style={styles.calendarNavButton}
          >
            <ChevronLeft size={20} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.calendarHeaderText}>
            {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const newMonth = new Date(month);
              newMonth.setMonth(newMonth.getMonth() + 1);
              if (isViewFilter) {
                setViewCalendarMonth(newMonth);
              } else if (isEdit) {
                setEditCalendarMonth(newMonth);
              } else {
                setCalendarMonth(newMonth);
              }
            }}
            style={styles.calendarNavButton}
          >
            <ChevronRight size={20} color="#4CAF50" />
          </TouchableOpacity>
        </View>
        <View style={styles.calendarWeekDays}>
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, i) => (
            <View key={i} style={styles.calendarWeekDay}>
              <Text style={styles.calendarWeekDayText}>{day}</Text>
            </View>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {days.map((day) => day)}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Servicios</Text>
          <Text style={styles.headerSubtitle}>{settings.cooperativeName}</Text>
        </View>
        
        <View style={styles.totalsContainer}>
          <View style={styles.totalCard}>
            <Text style={styles.totalCardLabel}>Total Día</Text>
            <Text style={styles.totalCardValue}>€{todayTotal.toFixed(2)}</Text>
          </View>
          
          <View style={styles.totalCard}>
            <Text style={styles.totalCardLabel}>Total Mes</Text>
            <Text style={styles.totalCardValue}>€{monthTotal.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.monthSelector}>
        <View style={styles.monthScrollContent}>
          {visibleMonths.map((monthIndex) => (
            <TouchableOpacity
              key={monthIndex}
              style={[
                styles.monthButton,
                currentMonth === monthIndex && styles.monthButtonActive,
              ]}
              onPress={() => changeMonth(monthIndex)}
            >
              <Text
                style={[
                  styles.monthButtonText,
                  currentMonth === monthIndex && styles.monthButtonTextActive,
                ]}
              >
                {MONTH_NAMES_SHORT[monthIndex]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView 
          style={styles.mainScrollView}
          contentContainerStyle={styles.mainScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.addServiceCard}>
            <TouchableOpacity 
              style={styles.addServiceHeader}
              onPress={() => setIsAddServiceExpanded(!isAddServiceExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.addServiceTitle}>Añadir Nuevo Servicio</Text>
              {isAddServiceExpanded ? (
                <ChevronUp size={20} color="#4CAF50" />
              ) : (
                <ChevronDown size={20} color="#4CAF50" />
              )}
            </TouchableOpacity>
            
            {isAddServiceExpanded && (
            <View style={styles.formContainer}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Método de Pago</Text>
                <TouchableOpacity
                  style={styles.paymentMethodButton}
                  onPress={() => setShowPaymentPicker(!showPaymentPicker)}
                >
                  <Text style={styles.paymentMethodText}>{paymentMethod}</Text>
                  <ChevronRight size={20} color="#6B7280" />
                </TouchableOpacity>
                {showPaymentPicker && (
                  <View style={styles.paymentMethodPicker}>
                    {(['Tarjeta', 'Efectivo', 'Amex', 'Abonado'] as PaymentMethod[]).map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentMethodOption,
                          paymentMethod === method && styles.paymentMethodOptionSelected,
                        ]}
                        onPress={() => {
                          setPaymentMethod(method);
                          setShowPaymentPicker(false);
                          if (method !== 'Abonado') {
                            setClientName('');
                            setDiscountPercent('0');
                            setOrigin('');
                            setDestination('');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.paymentMethodOptionText,
                            paymentMethod === method && styles.paymentMethodOptionTextSelected,
                          ]}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Fecha del Servicio</Text>
                <TouchableOpacity
                  style={styles.dateInputWrapper}
                  onPress={() => setShowDatePicker(!showDatePicker)}
                >
                  <Calendar size={18} color="#6B7280" style={styles.calendarIcon} />
                  <Text style={styles.dateInputText}>
                    {new Date(serviceDate).toLocaleDateString('es-ES', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && renderCalendar(false)}
              </View>

              {paymentMethod === 'Abonado' && (
                <>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Nombre del Cliente * (Empresa)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.descriptionInput}
                        value={clientName}
                        onChangeText={(text) => {
                          setClientName(text);
                          setShowClientSuggestions(text.length > 0);
                        }}
                        onFocus={() => setShowClientSuggestions(clientName.length > 0)}
                        placeholder="Nombre de la empresa"
                        placeholderTextColor="#9CA3AF"
                      />
                      <View style={styles.voiceButtonContainer}>
                        <VoiceButton onResult={(text) => {
                          setClientName(text);
                          setShowClientSuggestions(false);
                        }} />
                      </View>
                    </View>
                    {showClientSuggestions && clients.length > 0 && (
                      <View style={styles.suggestionsList}>
                        {clients
                          .filter(c => c.companyName.toLowerCase().includes(clientName.toLowerCase()))
                          .slice(0, 5)
                          .map((client) => (
                            <TouchableOpacity
                              key={client.id}
                              style={styles.suggestionItem}
                              onPress={() => {
                                setClientName(client.companyName);
                                setShowClientSuggestions(false);
                              }}
                            >
                              <Text style={styles.suggestionCompanyName}>{client.companyName}</Text>
                              <Text style={styles.suggestionUsageCount}>{client.usageCount} usos</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Origen</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.descriptionInput}
                        value={origin}
                        onChangeText={(text) => {
                          setOrigin(text);
                          setShowOriginSuggestions(text.length > 0 && clientName.length > 0);
                        }}
                        onFocus={() => setShowOriginSuggestions(origin.length > 0 && clientName.length > 0)}
                        placeholder="Ej: Sant Cugat"
                        placeholderTextColor="#9CA3AF"
                      />
                      <View style={styles.voiceButtonContainer}>
                        <VoiceButton onResult={(text) => {
                          setOrigin(text);
                          setShowOriginSuggestions(false);
                        }} />
                      </View>
                    </View>
                    {showOriginSuggestions && clientName && (
                      <View style={styles.suggestionsList}>
                        {getOriginSuggestions(clientName)
                          .filter(o => o.toLowerCase().includes(origin.toLowerCase()))
                          .map((originSuggestion, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.suggestionItem}
                              onPress={() => {
                                setOrigin(originSuggestion);
                                setShowOriginSuggestions(false);
                              }}
                            >
                              <Text style={styles.suggestionCompanyName}>{originSuggestion}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Destino</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.descriptionInput}
                        value={destination}
                        onChangeText={(text) => {
                          setDestination(text);
                          setShowDestinationSuggestions(text.length > 0 && clientName.length > 0);
                        }}
                        onFocus={() => setShowDestinationSuggestions(destination.length > 0 && clientName.length > 0)}
                        placeholder="Ej: Barcelona"
                        placeholderTextColor="#9CA3AF"
                      />
                      <View style={styles.voiceButtonContainer}>
                        <VoiceButton onResult={(text) => {
                          setDestination(text);
                          setShowDestinationSuggestions(false);
                        }} />
                      </View>
                    </View>
                    {showDestinationSuggestions && clientName && (
                      <View style={styles.suggestionsList}>
                        {getDestinationSuggestions(clientName, origin)
                          .filter(d => d.toLowerCase().includes(destination.toLowerCase()))
                          .map((destinationSuggestion, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.suggestionItem}
                              onPress={() => {
                                setDestination(destinationSuggestion);
                                setShowDestinationSuggestions(false);
                              }}
                            >
                              <Text style={styles.suggestionCompanyName}>{destinationSuggestion}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Observaciones</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.observationsInput}
                        value={observations}
                        onChangeText={setObservations}
                        placeholder="Notas adicionales (opcional)"
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      <View style={styles.voiceButtonContainerTop}>
                        <VoiceButton onResult={setObservations} />
                      </View>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.priceRow}>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.fieldLabel}>Precio (€)</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.priceInput}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    <View style={styles.voiceButtonContainer}>
                      <VoiceButton onResult={setPrice} numericOnly />
                    </View>
                  </View>
                </View>

                {paymentMethod === 'Abonado' && (
                  <View style={styles.discountInputContainer}>
                    <Text style={styles.fieldLabel}>Descuento (%)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.priceInput}
                        value={discountPercent}
                        onChangeText={setDiscountPercent}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                      <View style={styles.voiceButtonContainer}>
                        <VoiceButton onResult={setDiscountPercent} numericOnly />
                      </View>
                    </View>
                  </View>
                )}
              </View>

                <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.scanButton} onPress={() => setShowTicketScanner(true)}>
                  <ScanLine size={20} color="#4CAF50" />
                  <Text style={styles.scanButtonText}>Escanear</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.addButton} onPress={handleSubmit}>
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Añadir</Text>
                </TouchableOpacity>
              </View>
            </View>
            )}
          </View>

          <View style={styles.dateFilterCard}>
            <View style={styles.dateFilterHeader}>
              <Text style={styles.dateFilterTitle}>Filtrar por Fecha</Text>
              {selectedViewDate && (
                <TouchableOpacity 
                  onPress={() => setSelectedViewDate(null)}
                  style={styles.clearFilterButton}
                >
                  <Text style={styles.clearFilterText}>Ver Hoy</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => setShowViewDatePicker(!showViewDatePicker)}
            >
              <Calendar size={18} color="#4CAF50" />
              <Text style={styles.dateFilterButtonText}>
                {selectedViewDate 
                  ? new Date(selectedViewDate).toLocaleDateString('es-ES', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })
                  : new Date().toLocaleDateString('es-ES', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    }) + ' (Hoy)'
                }
              </Text>
            </TouchableOpacity>
            {showViewDatePicker && renderCalendar(false, true)}
          </View>

          <View style={styles.servicesHeader}>
            <Text style={styles.servicesTitle}>Servicios ({abonadoServices.length})</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
          ) : filteredServices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {selectedViewDate 
                  ? 'No hay servicios registrados para esta fecha'
                  : 'No hay servicios registrados para hoy'
                }
              </Text>
            </View>
          ) : (
            filteredServices.map((service) => {
              const price = parseFloat(service.price) || 0;
              const discountPercent = parseFloat(service.discountPercent) || 0;
              const discountAmount = (price * discountPercent) / 100;
              const finalPrice = price - discountAmount;

              return (
                <View key={service.id} style={styles.serviceCard}>
                  <View style={styles.serviceCardHeader}>
                    <Text style={styles.serviceCardDate}>
                      {new Date(service.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
                    </Text>
                    <View style={styles.serviceCardActions}>
                      <TouchableOpacity onPress={() => handleEdit(service)} style={styles.editButton}>
                        <Edit2 size={16} color="#4CAF50" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(service.id)} style={styles.deleteButton}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.serviceCardDescription}>
                    {service.origin || service.destination
                      ? `${service.origin}${service.origin && service.destination ? ' → ' : ''}${service.destination}`
                      : 'Sin ruta especificada'}
                  </Text>
                  <Text style={styles.serviceCardCompany}>{service.company}</Text>
                  {service.observations && (
                    <Text style={styles.serviceCardObservations}>{service.observations}</Text>
                  )}
                  <View style={styles.serviceCardPaymentRow}>
                    <View style={styles.serviceCardPaymentBadge}>
                      <Text style={styles.serviceCardPaymentText}>{service.paymentMethod}</Text>
                    </View>
                    {service.paymentMethod === 'Abonado' && service.clientName && (
                      <Text style={styles.serviceCardClientName}>{service.clientName}</Text>
                    )}
                  </View>

                  <View style={styles.serviceCardFooter}>
                    <View>
                      <Text style={styles.serviceCardPrice}>Precio: €{price.toFixed(2)}</Text>
                      {discountAmount > 0 && (
                        <Text style={styles.serviceCardDiscount}>-{parseFloat(service.discountPercent).toFixed(2)}%</Text>
                      )}
                    </View>
                    <Text style={styles.serviceCardTotal}>Total: €{finalPrice.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Servicio</Text>
                <TouchableOpacity onPress={handleCancelEdit} style={styles.modalCloseButton}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={true}>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Método de Pago</Text>
                  <TouchableOpacity
                    style={styles.paymentMethodButton}
                    onPress={() => setShowEditPaymentPicker(!showEditPaymentPicker)}
                  >
                    <Text style={styles.paymentMethodText}>{editPaymentMethod}</Text>
                    <ChevronRight size={20} color="#6B7280" />
                  </TouchableOpacity>
                  {showEditPaymentPicker && (
                    <View style={styles.paymentMethodPicker}>
                      {(['Tarjeta', 'Efectivo', 'Amex', 'Abonado'] as PaymentMethod[]).map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.paymentMethodOption,
                            editPaymentMethod === method && styles.paymentMethodOptionSelected,
                          ]}
                          onPress={() => {
                            setEditPaymentMethod(method);
                            setShowEditPaymentPicker(false);
                            if (method !== 'Abonado') {
                              setEditClientName('');
                              setEditDiscountPercent('0');
                              setEditOrigin('');
                              setEditDestination('');
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.paymentMethodOptionText,
                              editPaymentMethod === method && styles.paymentMethodOptionTextSelected,
                            ]}
                          >
                            {method}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Fecha del Servicio</Text>
                  <TouchableOpacity
                    style={styles.dateInputWrapper}
                    onPress={() => setShowEditDatePicker(!showEditDatePicker)}
                  >
                    <Calendar size={18} color="#6B7280" style={styles.calendarIcon} />
                    <Text style={styles.dateInputText}>
                      {new Date(editDate).toLocaleDateString('es-ES', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showEditDatePicker && renderCalendar(true)}
                </View>

                {editPaymentMethod === 'Abonado' && (
                  <>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Origen</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.modalInput}
                          value={editOrigin}
                          onChangeText={setEditOrigin}
                          placeholder="Ej: Sant Cugat"
                          placeholderTextColor="#9CA3AF"
                        />
                        <View style={styles.voiceButtonContainer}>
                          <VoiceButton onResult={setEditOrigin} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Destino</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.modalInput}
                          value={editDestination}
                          onChangeText={setEditDestination}
                          placeholder="Ej: Barcelona"
                          placeholderTextColor="#9CA3AF"
                        />
                        <View style={styles.voiceButtonContainer}>
                          <VoiceButton onResult={setEditDestination} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Empresa</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.modalInput}
                          value={editCompany}
                          onChangeText={setEditCompany}
                          placeholder="Nombre de la empresa"
                          placeholderTextColor="#9CA3AF"
                        />
                        <View style={styles.voiceButtonContainer}>
                          <VoiceButton onResult={setEditCompany} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Observaciones</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.observationsInput}
                          value={editObservations}
                          onChangeText={setEditObservations}
                          placeholder="Notas adicionales (opcional)"
                          placeholderTextColor="#9CA3AF"
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                        <View style={styles.voiceButtonContainerTop}>
                          <VoiceButton onResult={setEditObservations} />
                        </View>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.modalRow}>
                  <View style={editPaymentMethod === 'Abonado' ? styles.modalFieldHalf : styles.modalField}>
                    <Text style={styles.modalLabel}>Precio (€)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.modalInput}
                        value={editPrice}
                        onChangeText={setEditPrice}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                      <View style={styles.voiceButtonContainer}>
                        <VoiceButton onResult={setEditPrice} numericOnly />
                      </View>
                    </View>
                  </View>

                  {editPaymentMethod === 'Abonado' && (
                    <View style={styles.modalFieldHalf}>
                      <Text style={styles.modalLabel}>Descuento (%)</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.modalInput}
                          value={editDiscountPercent}
                          onChangeText={setEditDiscountPercent}
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          returnKeyType="done"
                          onSubmitEditing={() => Keyboard.dismiss()}
                        />
                        <View style={styles.voiceButtonContainer}>
                          <VoiceButton onResult={setEditDiscountPercent} numericOnly />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.modalButtonPrimaryText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <TicketScanner
        visible={showTicketScanner}
        onClose={() => setShowTicketScanner(false)}
        onServicesExtracted={handleServicesExtracted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  totalsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalCardLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  totalCardValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  monthSelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  monthButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  monthButtonActive: {
    backgroundColor: '#4CAF50',
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  monthButtonTextActive: {
    color: '#FFFFFF',
  },

  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 20,
  },
  addServiceCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  addServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addServiceTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  formContainer: {
    gap: 16,
  },
  fieldContainer: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  descriptionInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 48,
    fontSize: 15,
    color: '#111827',
  },
  voiceButtonContainer: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInputContainer: {
    flex: 1,
  },
  discountInputContainer: {
    flex: 1,
  },

  priceInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 48,
    fontSize: 15,
    color: '#111827',
  },

  observationsInput: {
    minHeight: 80,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingRight: 48,
    paddingBottom: 12,
    fontSize: 15,
    color: '#111827',
    width: '100%',
  },
  voiceButtonContainerTop: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#4CAF50',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  servicesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  loader: {
    marginVertical: 32,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceCardDate: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  serviceCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },

  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  calendarIcon: {
    marginRight: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  dateInputText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarHeaderText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  calendarDaySelected: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  calendarDayToday: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#111827',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  calendarDayTextToday: {
    color: '#4CAF50',
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 20,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: 500,
  },
  modalField: {
    marginBottom: 16,
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
    paddingRight: 48,
    fontSize: 15,
    color: '#111827',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalFieldHalf: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#4CAF50',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalButtonSecondary: {
    backgroundColor: '#E5E7EB',
  },
  modalButtonSecondaryText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  serviceCardDescription: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#111827',
    marginBottom: 4,
  },
  serviceCardCompany: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  serviceCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceCardPrice: {
    fontSize: 13,
    color: '#6B7280',
  },
  serviceCardDiscount: {
    fontSize: 11,
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  serviceCardTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4CAF50',
  },
  paymentMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  paymentMethodText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500' as const,
  },
  paymentMethodPicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  paymentMethodOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  paymentMethodOptionSelected: {
    backgroundColor: '#E8F5E9',
  },
  paymentMethodOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  paymentMethodOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600' as const,
  },
  serviceCardPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  serviceCardPaymentBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceCardPaymentText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4CAF50',
  },
  serviceCardClientName: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500' as const,
  },
  serviceCardObservations: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic' as const,
  },

  suggestionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionCompanyName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 2,
  },
  suggestionDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  suggestionUsageCount: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600' as const,
  },
  dateFilterCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dateFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateFilterTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4CAF50',
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  dateFilterButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500' as const,
  },
});
