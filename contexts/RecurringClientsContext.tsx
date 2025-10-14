import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export interface RecurringClient {
  id: number;
  companyName: string;
  lastUsed: string;
  usageCount: number;
}

const RECURRING_CLIENTS_KEY = 'taxi_recurring_clients';

export const [RecurringClientsProvider, useRecurringClients] = createContextHook(() => {
  const [clients, setClients] = useState<RecurringClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const stored = await AsyncStorage.getItem(RECURRING_CLIENTS_KEY);
      if (stored) {
        setClients(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recurring clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveClients = async (updatedClients: RecurringClient[]) => {
    try {
      await AsyncStorage.setItem(RECURRING_CLIENTS_KEY, JSON.stringify(updatedClients));
    } catch (error) {
      console.error('Error saving recurring clients:', error);
      throw error;
    }
  };

  const addOrUpdateClient = useCallback(async (clientData: {
    companyName: string;
  }) => {
    const existingClient = clients.find(
      c => c.companyName.toLowerCase() === clientData.companyName.toLowerCase()
    );

    let updatedClients: RecurringClient[];

    if (existingClient) {
      updatedClients = clients.map(c =>
        c.id === existingClient.id
          ? {
              ...c,
              lastUsed: new Date().toISOString(),
              usageCount: c.usageCount + 1,
            }
          : c
      );
    } else {
      const newClient: RecurringClient = {
        id: Date.now(),
        companyName: clientData.companyName,
        lastUsed: new Date().toISOString(),
        usageCount: 1,
      };
      updatedClients = [...clients, newClient];
    }

    setClients(updatedClients);
    await saveClients(updatedClients);
  }, [clients]);

  const deleteClient = useCallback(async (id: number) => {
    const updatedClients = clients.filter(c => c.id !== id);
    setClients(updatedClients);
    await saveClients(updatedClients);
  }, [clients]);

  const getClientByName = useCallback((companyName: string): RecurringClient | undefined => {
    return clients.find(
      c => c.companyName.toLowerCase() === companyName.toLowerCase()
    );
  }, [clients]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
  }, [clients]);

  return useMemo(() => ({
    clients: sortedClients,
    isLoading,
    addOrUpdateClient,
    deleteClient,
    getClientByName,
  }), [sortedClients, isLoading, addOrUpdateClient, deleteClient, getClientByName]);
});
