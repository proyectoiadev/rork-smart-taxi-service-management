import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export interface BillingCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface UserSettings {
  cooperativeName: string;
  vehicleId: string;
  userName: string;
  observations: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  cooperativeName: 'SmartConstructIA, S.L.',
  vehicleId: 'MOVIL Z-41',
  userName: '',
  observations: '',
};

const SETTINGS_KEY = 'taxi_user_settings';
const BILLING_CYCLES_KEY = 'taxi_billing_cycles';

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadBillingCycles();
  }, [loadSettings]);

  const loadBillingCycles = async () => {
    try {
      const stored = await AsyncStorage.getItem(BILLING_CYCLES_KEY);
      if (stored) {
        setBillingCycles(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading billing cycles:', error);
    }
  };

  const saveBillingCycles = async (cycles: BillingCycle[]) => {
    try {
      await AsyncStorage.setItem(BILLING_CYCLES_KEY, JSON.stringify(cycles));
      setBillingCycles(cycles);
    } catch (error) {
      console.error('Error saving billing cycles:', error);
      throw error;
    }
  };

  const updateSettings = useCallback(async (newSettings: UserSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }, []);

  const openBillingCycle = useCallback(async (startDate: string, name: string) => {
    const openCycle = billingCycles.find(c => c.status === 'open');
    if (openCycle) {
      throw new Error('Ya existe un ciclo de facturación abierto');
    }

    const newCycle: BillingCycle = {
      id: Date.now().toString(),
      name,
      startDate,
      endDate: null,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const updatedCycles = [...billingCycles, newCycle];
    await saveBillingCycles(updatedCycles);
    return newCycle;
  }, [billingCycles]);

  const closeBillingCycle = useCallback(async (cycleId: string, endDate: string) => {
    const updatedCycles = billingCycles.map(c => 
      c.id === cycleId ? { ...c, endDate, status: 'closed' as const } : c
    );
    await saveBillingCycles(updatedCycles);
  }, [billingCycles]);

  const getActiveCycle = useCallback(() => {
    return billingCycles.find(c => c.status === 'open') || null;
  }, [billingCycles]);

  const deleteBillingCycle = useCallback(async (cycleId: string) => {
    const updatedCycles = billingCycles.filter(c => c.id !== cycleId);
    await saveBillingCycles(updatedCycles);
  }, [billingCycles]);

  return useMemo(() => ({
    settings,
    updateSettings,
    isLoading,
    billingCycles,
    openBillingCycle,
    closeBillingCycle,
    getActiveCycle,
    deleteBillingCycle,
    loadSettings,
  }), [settings, updateSettings, isLoading, billingCycles, openBillingCycle, closeBillingCycle, getActiveCycle, deleteBillingCycle, loadSettings]);
});
