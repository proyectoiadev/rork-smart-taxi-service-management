import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VALID_ACTIVATION_CODES } from '@/constants/activationCodes';
import * as Crypto from 'expo-crypto';

const LOGO_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vtxu3dykdqnfq7dlmew6n';

export default function ActivationScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const formatCode = (text: string) => {
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join('-').substring(0, 19);
  };

  const handleCodeChange = (text: string) => {
    const formatted = formatCode(text);
    setCode(formatted);
    setError('');
  };

  const handleActivate = async () => {
    const cleanCode = code.replace(/-/g, '');
    
    if (cleanCode.length !== 16) {
      setError('Por favor, introduce un código completo');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Código introducido:', code);
      console.log('Código limpio:', cleanCode);
      console.log('Códigos válidos:', VALID_ACTIVATION_CODES.map(c => c.replace(/-/g, '')));
      
      const isValid = VALID_ACTIVATION_CODES.some(validCode => validCode.replace(/-/g, '') === cleanCode);
      console.log('¿Código válido?:', isValid);
      
      if (!isValid) {
        setError('Código no válido');
        setIsLoading(false);
        return;
      }
      
      let deviceId: string = await AsyncStorage.getItem('device_id') || '';
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await AsyncStorage.setItem('device_id', deviceId);
      }
      console.log('Device ID:', deviceId);
      
      const storedDeviceId = await AsyncStorage.getItem(`code_device_${cleanCode}`);
      console.log('Stored Device ID for code:', storedDeviceId);
      
      if (storedDeviceId && storedDeviceId !== deviceId) {
        setError('Este código ya está siendo usado en otro dispositivo');
        setIsLoading(false);
        return;
      }
      
      const activationDate = new Date().toISOString();
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90);
      
      console.log('Guardando datos de activación...');
      await AsyncStorage.setItem('appActivated_taxi_pro_v2', 'true');
      await AsyncStorage.setItem('activation_code', cleanCode);
      await AsyncStorage.setItem('activation_date', activationDate);
      await AsyncStorage.setItem('activation_expiration', expirationDate.toISOString());
      await AsyncStorage.setItem('activation_type', 'trial');
      await AsyncStorage.setItem(`code_device_${cleanCode}`, deviceId);
      
      console.log('Activación exitosa, datos guardados');
      console.log('Fecha de activación:', activationDate);
      console.log('Fecha de expiración:', expirationDate.toISOString());
      
      const verify = await AsyncStorage.getItem('appActivated_taxi_pro_v2');
      console.log('Verificación de guardado:', verify);
      
      if (verify !== 'true') {
        throw new Error('Error al guardar la activación');
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Navegando a la pantalla principal...');
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Activation error:', err);
      Alert.alert('Error', 'Ocurrió un error al activar la aplicación');
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image 
            source={{ uri: LOGO_URL }}
            style={styles.logo}
            resizeMode="contain"
            defaultSource={require('@/assets/images/icon.png')}
          />
          
          <Text style={styles.title}>Activar Suscripción</Text>
          
          <Text style={styles.description}>
            Introduce el código de activación que te han proporcionado para empezar a usar la aplicación.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={code}
              onChangeText={handleCodeChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={19}
            />
            
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleActivate}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Activando...' : 'Activar Aplicación'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
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
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    letterSpacing: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
});
