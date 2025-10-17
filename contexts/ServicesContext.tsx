import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export type PaymentMethod = 'Tarjeta' | 'Efectivo' | 'Amex' | 'Abonado';

export interface Service {
  id: number;
  date: string;
  origin: string;
  destination: string;
  company: string;
  price: string;
  discountPercent: string;
  observations: string;
  paymentMethod: PaymentMethod;
  clientName?: string;
  clientId?: string;
  clientPhone?: string;
  billingCycleId?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

const getStorageKey = (year: number, month: number) => `taxi_services_${year}_${month}`;

export const [ServicesProvider, useServices] = createContextHook(() => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadServices(currentMonth);
  }, [currentMonth]);

  const loadServices = async (month: number) => {
    setIsLoading(true);
    try {
      const key = getStorageKey(CURRENT_YEAR, month);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setServices(JSON.parse(stored));
      } else {
        setServices([]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(() => {
    return services.reduce((acc, service) => {
      const price = parseFloat(service.price) || 0;
      const discountPercent = parseFloat(service.discountPercent) || 0;
      const discountAmount = (price * discountPercent) / 100;
      
      acc.totalPrice += price;
      acc.totalDiscount += discountAmount;
      acc.totalFinal += (price - discountAmount);
      
      return acc;
    }, { totalPrice: 0, totalDiscount: 0, totalFinal: 0 });
  }, [services]);

  const saveServices = useCallback(async (month: number, updatedServices: Service[]) => {
    try {
      const key = getStorageKey(CURRENT_YEAR, month);
      await AsyncStorage.setItem(key, JSON.stringify(updatedServices));
    } catch (error) {
      console.error('Error saving services:', error);
      throw error;
    }
  }, []);

  const addService = useCallback(async (service: Omit<Service, 'id'>, billingCycleId?: string) => {
    const newService: Service = {
      ...service,
      id: Date.now(),
      billingCycleId,
    };
    const updatedServices = [...services, newService];
    setServices(updatedServices);
    await saveServices(currentMonth, updatedServices);
  }, [services, currentMonth, saveServices]);

  const deleteService = useCallback(async (id: number) => {
    console.log('deleteService called with id:', id);
    console.log('Current services:', services.length);
    const updatedServices = services.filter(s => s.id !== id);
    console.log('Updated services after filter:', updatedServices.length);
    setServices(updatedServices);
    await saveServices(currentMonth, updatedServices);
    console.log('Services deleted and saved successfully');
  }, [services, currentMonth, saveServices]);

  const updateService = useCallback(async (id: number, updatedData: Partial<Omit<Service, 'id'>>) => {
    const updatedServices = services.map(s => 
      s.id === id ? { ...s, ...updatedData } : s
    );
    setServices(updatedServices);
    await saveServices(currentMonth, updatedServices);
  }, [services, currentMonth, saveServices]);

  const changeMonth = useCallback((month: number) => {
    setCurrentMonth(month);
  }, []);

  const getAllServicesForYear = useCallback(async (): Promise<Service[]> => {
    const allServices: Service[] = [];
    for (let month = 0; month < 12; month++) {
      try {
        const key = getStorageKey(CURRENT_YEAR, month);
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const monthServices: Service[] = JSON.parse(stored);
          allServices.push(...monthServices);
        }
      } catch (error) {
        console.error(`Error loading services for month ${month}:`, error);
      }
    }
    return allServices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, []);

  const getServicesByCycle = useCallback((cycleId: string) => {
    return services.filter(s => s.billingCycleId === cycleId);
  }, [services]);

  return {
    services,
    currentMonth,
    isLoading,
    totals,
    addService,
    deleteService,
    updateService,
    changeMonth,
    getAllServicesForYear,
    getServicesByCycle,
  };
});
