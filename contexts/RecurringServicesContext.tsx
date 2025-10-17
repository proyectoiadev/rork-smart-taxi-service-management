import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export interface RecurringRoute {
  id: number;
  origin: string;
  destination: string;
  price: string;
  lastUsed: string;
  usageCount: number;
}

export interface CompanyDiscount {
  companyName: string;
  discountPercent: string;
  lastUsed: string;
  usageCount: number;
}

export interface CompanyRoutePreference {
  id: number;
  companyName: string;
  origin: string;
  destination: string;
  price: string;
  discountPercent: string;
  lastUsed: string;
  usageCount: number;
}

const RECURRING_ROUTES_KEY = 'taxi_recurring_routes';
const COMPANY_DISCOUNTS_KEY = 'taxi_company_discounts';
const COMPANY_ROUTE_PREFERENCES_KEY = 'taxi_company_route_preferences';

export const [RecurringServicesProvider, useRecurringServices] = createContextHook(() => {
  const [routes, setRoutes] = useState<RecurringRoute[]>([]);
  const [companyDiscounts, setCompanyDiscounts] = useState<CompanyDiscount[]>([]);
  const [companyRoutePreferences, setCompanyRoutePreferences] = useState<CompanyRoutePreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [routesData, discountsData, preferencesData] = await Promise.all([
        AsyncStorage.getItem(RECURRING_ROUTES_KEY),
        AsyncStorage.getItem(COMPANY_DISCOUNTS_KEY),
        AsyncStorage.getItem(COMPANY_ROUTE_PREFERENCES_KEY),
      ]);

      if (routesData) setRoutes(JSON.parse(routesData));
      if (discountsData) setCompanyDiscounts(JSON.parse(discountsData));
      if (preferencesData) setCompanyRoutePreferences(JSON.parse(preferencesData));
    } catch (error) {
      console.error('Error loading recurring services data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveRoutes = async (updatedRoutes: RecurringRoute[]) => {
    try {
      await AsyncStorage.setItem(RECURRING_ROUTES_KEY, JSON.stringify(updatedRoutes));
    } catch (error) {
      console.error('Error saving routes:', error);
    }
  };

  const saveCompanyDiscounts = async (updatedDiscounts: CompanyDiscount[]) => {
    try {
      await AsyncStorage.setItem(COMPANY_DISCOUNTS_KEY, JSON.stringify(updatedDiscounts));
    } catch (error) {
      console.error('Error saving company discounts:', error);
    }
  };

  const saveCompanyRoutePreferences = async (updatedPreferences: CompanyRoutePreference[]) => {
    try {
      await AsyncStorage.setItem(COMPANY_ROUTE_PREFERENCES_KEY, JSON.stringify(updatedPreferences));
    } catch (error) {
      console.error('Error saving company route preferences:', error);
    }
  };

  const recordService = useCallback(async (data: {
    companyName: string;
    origin: string;
    destination: string;
    price: string;
    discountPercent: string;
  }) => {
    const now = new Date().toISOString();

    const existingDiscount = companyDiscounts.find(
      d => d.companyName.toLowerCase() === data.companyName.toLowerCase()
    );

    let updatedDiscounts: CompanyDiscount[];
    if (existingDiscount) {
      updatedDiscounts = companyDiscounts.map(d =>
        d.companyName.toLowerCase() === data.companyName.toLowerCase()
          ? {
              ...d,
              discountPercent: data.discountPercent,
              lastUsed: now,
              usageCount: d.usageCount + 1,
            }
          : d
      );
    } else {
      updatedDiscounts = [
        ...companyDiscounts,
        {
          companyName: data.companyName,
          discountPercent: data.discountPercent,
          lastUsed: now,
          usageCount: 1,
        },
      ];
    }
    setCompanyDiscounts(updatedDiscounts);
    await saveCompanyDiscounts(updatedDiscounts);

    const routeKey = `${data.origin.toLowerCase()}-${data.destination.toLowerCase()}`;
    const existingRoute = routes.find(
      r => `${r.origin.toLowerCase()}-${r.destination.toLowerCase()}` === routeKey
    );

    let updatedRoutes: RecurringRoute[];
    if (existingRoute) {
      updatedRoutes = routes.map(r =>
        r.id === existingRoute.id
          ? {
              ...r,
              price: data.price,
              lastUsed: now,
              usageCount: r.usageCount + 1,
            }
          : r
      );
    } else {
      updatedRoutes = [
        ...routes,
        {
          id: Date.now(),
          origin: data.origin,
          destination: data.destination,
          price: data.price,
          lastUsed: now,
          usageCount: 1,
        },
      ];
    }
    setRoutes(updatedRoutes);
    await saveRoutes(updatedRoutes);

    const preferenceKey = `${data.companyName.toLowerCase()}-${routeKey}`;
    const existingPreference = companyRoutePreferences.find(
      p => `${p.companyName.toLowerCase()}-${p.origin.toLowerCase()}-${p.destination.toLowerCase()}` === preferenceKey
    );

    let updatedPreferences: CompanyRoutePreference[];
    if (existingPreference) {
      updatedPreferences = companyRoutePreferences.map(p =>
        `${p.companyName.toLowerCase()}-${p.origin.toLowerCase()}-${p.destination.toLowerCase()}` === preferenceKey
          ? {
              ...p,
              price: data.price,
              discountPercent: data.discountPercent,
              lastUsed: now,
              usageCount: p.usageCount + 1,
            }
          : p
      );
    } else {
      const companyPreferences = companyRoutePreferences.filter(
        p => p.companyName.toLowerCase() === data.companyName.toLowerCase()
      );
      
      if (companyPreferences.length >= 5) {
        const sortedByDate = [...companyPreferences].sort(
          (a, b) => new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime()
        );
        const oldestPreference = sortedByDate[0];
        updatedPreferences = companyRoutePreferences.filter(p => p.id !== oldestPreference.id);
      } else {
        updatedPreferences = [...companyRoutePreferences];
      }
      
      updatedPreferences.push({
        id: Date.now(),
        companyName: data.companyName,
        origin: data.origin,
        destination: data.destination,
        price: data.price,
        discountPercent: data.discountPercent,
        lastUsed: now,
        usageCount: 1,
      });
    }
    setCompanyRoutePreferences(updatedPreferences);
    await saveCompanyRoutePreferences(updatedPreferences);
  }, [routes, companyDiscounts, companyRoutePreferences]);

  const getCompanyDiscount = useCallback((companyName: string): string | undefined => {
    const discount = companyDiscounts.find(
      d => d.companyName.toLowerCase() === companyName.toLowerCase()
    );
    return discount?.discountPercent;
  }, [companyDiscounts]);

  const getRoutePrice = useCallback((origin: string, destination: string): string | undefined => {
    const routeKey = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
    const route = routes.find(
      r => `${r.origin.toLowerCase()}-${r.destination.toLowerCase()}` === routeKey
    );
    return route?.price;
  }, [routes]);

  const getCompanyRoutePreference = useCallback((
    companyName: string,
    origin: string,
    destination: string
  ): { price: string; discountPercent: string } | undefined => {
    const preferenceKey = `${companyName.toLowerCase()}-${origin.toLowerCase()}-${destination.toLowerCase()}`;
    const preference = companyRoutePreferences.find(
      p => `${p.companyName.toLowerCase()}-${p.origin.toLowerCase()}-${p.destination.toLowerCase()}` === preferenceKey
    );
    if (preference) {
      return {
        price: preference.price,
        discountPercent: preference.discountPercent,
      };
    }
    return undefined;
  }, [companyRoutePreferences]);

  const getCompanyRoutes = useCallback((companyName: string): CompanyRoutePreference[] => {
    return companyRoutePreferences
      .filter(p => p.companyName.toLowerCase() === companyName.toLowerCase())
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, 5);
  }, [companyRoutePreferences]);

  const getOriginSuggestions = useCallback((companyName: string): string[] => {
    const routes = getCompanyRoutes(companyName);
    const origins = [...new Set(routes.map(r => r.origin))];
    return origins.slice(0, 5);
  }, [getCompanyRoutes]);

  const getDestinationSuggestions = useCallback((companyName: string, origin?: string): string[] => {
    const routes = getCompanyRoutes(companyName);
    let filtered = routes;
    
    if (origin) {
      filtered = routes.filter(r => r.origin.toLowerCase() === origin.toLowerCase());
    }
    
    const destinations = [...new Set(filtered.map(r => r.destination))];
    return destinations.slice(0, 5);
  }, [getCompanyRoutes]);

  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
  }, [routes]);

  const sortedCompanyDiscounts = useMemo(() => {
    return [...companyDiscounts].sort((a, b) => {
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
  }, [companyDiscounts]);

  return {
    routes: sortedRoutes,
    companyDiscounts: sortedCompanyDiscounts,
    companyRoutePreferences,
    isLoading,
    recordService,
    getCompanyDiscount,
    getRoutePrice,
    getCompanyRoutePreference,
    getCompanyRoutes,
    getOriginSuggestions,
    getDestinationSuggestions,
  };
});
