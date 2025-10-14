import React, { useState, useRef, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Platform, Alert, View, TextInput, TextInputProps } from 'react-native';
import { Mic } from 'lucide-react-native';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  numericOnly?: boolean;
}

interface VoiceInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  numericOnly?: boolean;
}

const convertTextToNumber = (text: string): string => {
  const lowerText = text.toLowerCase().trim();
  
  const numberWords: { [key: string]: string } = {
    'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
    'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',
    'diez': '10', 'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14',
    'quince': '15', 'dieciséis': '16', 'dieciseis': '16', 'diecisiete': '17',
    'dieciocho': '18', 'diecinueve': '19', 'veinte': '20', 'veintiuno': '21',
    'veintidós': '22', 'veintidos': '22', 'veintitrés': '23', 'veintitres': '23',
    'veinticuatro': '24', 'veinticinco': '25', 'treinta': '30', 'cuarenta': '40',
    'cincuenta': '50', 'sesenta': '60', 'setenta': '70', 'ochenta': '80',
    'noventa': '90', 'cien': '100', 'ciento': '100', 'doscientos': '200',
    'trescientos': '300', 'cuatrocientos': '400', 'quinientos': '500',
    'seiscientos': '600', 'setecientos': '700', 'ochocientos': '800',
    'novecientos': '900', 'mil': '1000'
  };
  
  let result = lowerText;
  
  for (const [word, number] of Object.entries(numberWords)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, number);
  }
  
  result = result.replace(/\s+/g, '');
  
  const numericMatch = result.match(/[0-9]+([.,][0-9]+)?/);
  if (numericMatch) {
    return numericMatch[0].replace(',', '.');
  }
  
  return text;
};

export function VoiceButton({ onResult, numericOnly = false }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (Platform.OS !== 'web') {
        cleanupMobileRecording();
      } else {
        cleanupWebResources();
      }
    };
  }, []);

  const cleanupMobileRecording = async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    try {
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording || status.isDoneRecording) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch (e) {
          console.log('Recording already stopped or unloaded');
        }
        recordingRef.current = null;
      }

      if (Platform.OS !== 'web') {
        const { Audio } = require('expo-av');
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: false,
          });
        } catch (e) {
          console.log('Audio mode already reset');
        }
      }
    } catch (error) {
      console.error('Error cleaning up recording:', error);
      recordingRef.current = null;
    } finally {
      isCleaningUpRef.current = false;
    }
  };

  const startRecordingMobile = async () => {
    try {
      await cleanupMobileRecording();
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!isMountedRef.current) return;
      
      const { Audio } = require('expo-av');
      
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Por favor, permite el acceso al micrófono en la configuración de la aplicación.'
        );
        return;
      }

      if (!isMountedRef.current) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      if (!isMountedRef.current) return;

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      if (!isMountedRef.current) {
        await recording.stopAndUnloadAsync();
        return;
      }

      await recording.startAsync();
      recordingRef.current = recording;
      
      if (isMountedRef.current) {
        setIsRecording(true);
      }
    } catch (error: any) {
      console.error('Error starting recording:', error);
      await cleanupMobileRecording();
      if (isMountedRef.current) {
        setIsRecording(false);
        Alert.alert('Error', 'No se pudo iniciar la grabación. Intenta de nuevo.');
      }
    }
  };

  const stopRecordingMobile = async () => {
    try {
      if (!recordingRef.current) {
        setIsRecording(false);
        return;
      }

      const uri = recordingRef.current.getURI();
      await recordingRef.current.stopAndUnloadAsync();
      
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });

      recordingRef.current = null;
      
      if (isMountedRef.current) {
        setIsRecording(false);
      }

      if (uri && isMountedRef.current) {
        await sendAudioToSTT(uri);
      }
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      await cleanupMobileRecording();
      if (isMountedRef.current) {
        setIsRecording(false);
        Alert.alert('Error', 'No se pudo detener la grabación.');
      }
    }
  };

  const cleanupWebResources = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.error('Error stopping track:', e);
          }
        });
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch (e) {
          console.error('Error stopping media recorder:', e);
        }
        mediaRecorderRef.current = null;
      }
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  };

  const startRecordingWeb = async () => {
    try {
      cleanupWebResources();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta grabación de audio');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');
      
      if (!hasAudioInput) {
        throw new Error('No se encontró ningún micrófono');
      }
      
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!stream || !stream.active) {
        throw new Error('No se pudo obtener acceso al micrófono');
      }
      
      streamRef.current = stream;
      
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupWebResources();
        
        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            await sendAudioToSTTWeb(base64Audio, mimeType);
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error);
        cleanupWebResources();
        setIsRecording(false);
        Alert.alert('Error', 'Error durante la grabación. Intenta de nuevo.');
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error: any) {
      console.error('Error starting web recording:', error);
      cleanupWebResources();
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        Alert.alert(
          'Permiso denegado',
          'Por favor, permite el acceso al micrófono en la configuración del navegador. Haz clic en el icono del candado en la barra de direcciones.'
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        Alert.alert(
          'Micrófono no encontrado',
          'No se detectó ningún micrófono conectado. Por favor, conecta un micrófono e intenta de nuevo.'
        );
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        Alert.alert(
          'Micrófono en uso',
          'El micrófono está siendo usado por otra aplicación.\n\nPor favor:\n• Cierra otras pestañas del navegador que usen el micrófono\n• Cierra aplicaciones como Zoom, Teams, Meet, etc.\n• Recarga esta página (F5)\n• Si persiste, reinicia el navegador'
        );
      } else {
        Alert.alert(
          'Error de micrófono',
          `No se pudo acceder al micrófono: ${error.message || error.name}. Intenta recargar la página.`
        );
      }
    }
  };

  const stopRecordingWeb = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } catch (error: any) {
      console.error('Error stopping web recording:', error);
      cleanupWebResources();
      setIsRecording(false);
    }
  };

  const sendAudioToSTT = async (uri: string) => {
    try {
      const formData = new FormData();
      
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      const audioFile = {
        uri,
        name: `recording.${fileType}`,
        type: `audio/${fileType}`,
      } as any;

      formData.append('audio', audioFile);
      formData.append('language', 'es');

      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error en la transcripción');
      }

      const data = await response.json();
      if (data.text) {
        const processedText = numericOnly ? convertTextToNumber(data.text) : data.text;
        onResult(processedText);
      }
    } catch (error: any) {
      console.error('Error sending audio to STT:', error);
      Alert.alert('Error', 'No se pudo transcribir el audio. Intenta de nuevo.');
    }
  };

  const sendAudioToSTTWeb = async (base64Audio: string, mimeType: string) => {
    try {
      const formData = new FormData();
      
      const audioBlob = await fetch(`data:${mimeType};base64,${base64Audio}`).then(r => r.blob());
      const extension = mimeType.split('/')[1];
      formData.append('audio', audioBlob, `recording.${extension}`);
      formData.append('language', 'es');

      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error en la transcripción');
      }

      const data = await response.json();
      if (data.text) {
        const processedText = numericOnly ? convertTextToNumber(data.text) : data.text;
        onResult(processedText);
      }
    } catch (error: any) {
      console.error('Error sending audio to STT:', error);
      Alert.alert('Error', 'No se pudo transcribir el audio. Intenta de nuevo.');
    }
  };

  const handlePress = async () => {
    if (!isMountedRef.current) return;

    try {
      if (isRecording) {
        if (Platform.OS === 'web') {
          stopRecordingWeb();
        } else {
          await stopRecordingMobile();
        }
      } else {
        if (Platform.OS === 'web') {
          await startRecordingWeb();
        } else {
          await startRecordingMobile();
        }
      }
    } catch (error) {
      console.error('Error in handlePress:', error);
      if (isMountedRef.current) {
        setIsRecording(false);
      }
      if (Platform.OS === 'web') {
        cleanupWebResources();
      } else {
        await cleanupMobileRecording();
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isRecording && styles.buttonRecording]}
      onPress={handlePress}
    >
      <Mic size={20} color={isRecording ? '#EF4444' : '#6B7280'} />
    </TouchableOpacity>
  );
}

export default function VoiceInput({ value, onChangeText, numericOnly = false, multiline = false, numberOfLines = 1, ...textInputProps }: VoiceInputProps) {
  const handleVoiceResult = (text: string) => {
    if (value) {
      onChangeText(value + ' ' + text);
    } else {
      onChangeText(text);
    }
  };

  const inputHeight = multiline ? Math.max(100, (numberOfLines || 1) * 24) : 48;

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.textInput,
          multiline && styles.textInputMultiline,
          { height: inputHeight },
        ]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...textInputProps}
      />
      <View style={[styles.voiceButtonContainer, multiline && styles.voiceButtonContainerMultiline]}>
        <VoiceButton onResult={handleVoiceResult} numericOnly={numericOnly} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  textInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 52,
    fontSize: 16,
    color: '#111827',
  },
  textInputMultiline: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  voiceButtonContainer: {
    position: 'absolute',
    right: 6,
    top: 4,
  },
  voiceButtonContainerMultiline: {
    top: 6,
  },
  button: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  buttonRecording: {
    backgroundColor: '#FEE2E2',
  },
});
