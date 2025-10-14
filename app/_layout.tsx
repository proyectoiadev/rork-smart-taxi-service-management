import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ServicesProvider } from "@/contexts/ServicesContext";
import { RecurringClientsProvider } from "@/contexts/RecurringClientsContext";
import { RecurringServicesProvider } from "@/contexts/RecurringServicesContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const [isChecking, setIsChecking] = useState(true);
  const [isActivated, setIsActivated] = useState(false);

  const checkActivation = useCallback(async () => {
    try {
      console.log('Checking activation status...');
      const activated = await AsyncStorage.getItem('appActivated_taxi_pro_v2');
      const expirationStr = await AsyncStorage.getItem('activation_expiration');
      const firstLaunchStr = await AsyncStorage.getItem('first_launch_date');
      
      console.log('Activated:', activated);
      console.log('Expiration:', expirationStr);
      console.log('First launch:', firstLaunchStr);
      
      const now = new Date();
      
      if (!firstLaunchStr) {
        const firstLaunchDate = now.toISOString();
        await AsyncStorage.setItem('first_launch_date', firstLaunchDate);
        
        const trialExpiration = new Date(now);
        trialExpiration.setDate(trialExpiration.getDate() + 10);
        
        await AsyncStorage.setItem('appActivated_taxi_pro_v2', 'true');
        await AsyncStorage.setItem('activation_date', firstLaunchDate);
        await AsyncStorage.setItem('activation_expiration', trialExpiration.toISOString());
        await AsyncStorage.setItem('activation_type', 'trial');
        
        console.log('First launch - trial activated until:', trialExpiration.toISOString());
        setIsActivated(true);
      } else if (activated && expirationStr) {
        const expirationDate = new Date(expirationStr);
        
        console.log('Expiration date:', expirationDate);
        console.log('Current date:', now);
        console.log('Is valid:', now < expirationDate);
        
        if (now < expirationDate) {
          setIsActivated(true);
        } else {
          console.log('Activation expired, removing...');
          await AsyncStorage.removeItem('appActivated_taxi_pro_v2');
          setIsActivated(false);
        }
      } else {
        console.log('No activation found');
        setIsActivated(false);
      }
    } catch (error) {
      console.error('Error checking activation:', error);
      setIsActivated(false);
    } finally {
      setIsChecking(false);
      await SplashScreen.hideAsync();
    }
  }, []);

  useEffect(() => {
    checkActivation();
  }, [checkActivation]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkActivation();
    }, 60000);

    return () => clearInterval(interval);
  }, [checkActivation]);

  useEffect(() => {
    if (isChecking) return;

    const inActivationScreen = segments[0] === 'activation';

    console.log('Navigation effect - isActivated:', isActivated, 'inActivationScreen:', inActivationScreen, 'segments:', segments);

    if (!isActivated && !inActivationScreen) {
      console.log('Redirecting to activation screen');
      router.replace('/activation');
    } else if (isActivated && inActivationScreen) {
      console.log('Redirecting to home screen');
      router.replace('/');
    }
  }, [isActivated, segments, isChecking, router]);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Atrás" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="activation" options={{ headerShown: false }} />
      <Stack.Screen name="export-csv" />
      <Stack.Screen name="generate-pdf" />
      <Stack.Screen name="cycle-report" />
      <Stack.Screen name="generate-html" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ServicesProvider>
          <RecurringClientsProvider>
            <RecurringServicesProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </RecurringServicesProvider>
          </RecurringClientsProvider>
        </ServicesProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
