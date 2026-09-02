import React, {useState} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {HomeScreen} from './src/screens/HomeScreen';
import {LocationScreen} from './src/screens/LocationScreen';
import {NetworkScreen} from './src/screens/NetworkScreen';
import {BluetoothScreen} from './src/screens/BluetoothScreen';
import {ChecklistScreen} from './src/screens/ChecklistScreen';
import {CameraAssistScreen} from './src/screens/CameraAssistScreen';
import {SummaryScreen} from './src/screens/SummaryScreen';
import type {SweepSession, SweepStep} from './src/types';
import {DEFAULT_CHECKLIST} from './src/utils/checklist';
import {createAnonymousId} from './src/utils/id';
import {palette} from './src/components/ui';

function emptySession(): SweepSession {
  return {
    anonymousId: createAnonymousId(),
    location: null,
    networkDevices: [],
    bleDevices: [],
    checklist: DEFAULT_CHECKLIST.map(item => ({...item})),
    photos: [],
    notes: '',
  };
}

export default function App() {
  const [step, setStep] = useState<SweepStep>('home');
  const [session, setSession] = useState<SweepSession>(emptySession);
  const [cameraReturnStep, setCameraReturnStep] = useState<SweepStep>('checklist');

  const restart = () => {
    setSession(emptySession());
    setStep('home');
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {step === 'home' && (
        <HomeScreen
          onStart={() => setStep('location')}
          onCameraScan={() => {
            setCameraReturnStep('home');
            setStep('camera');
          }}
        />
      )}
      {step === 'location' && (
        <LocationScreen
          initial={session.location}
          onBack={() => setStep('home')}
          onContinue={location => {
            setSession(current => ({...current, location}));
            setStep('network');
          }}
        />
      )}
      {step === 'network' && (
        <NetworkScreen
          initial={session.networkDevices}
          onBack={() => setStep('location')}
          onContinue={networkDevices => {
            setSession(current => ({...current, networkDevices}));
            setStep('bluetooth');
          }}
        />
      )}
      {step === 'bluetooth' && (
        <BluetoothScreen
          initial={session.bleDevices}
          onBack={() => setStep('network')}
          onContinue={bleDevices => {
            setSession(current => ({...current, bleDevices}));
            setStep('checklist');
          }}
        />
      )}
      {step === 'checklist' && (
        <ChecklistScreen
          items={session.checklist}
          onChange={checklist => setSession(current => ({...current, checklist}))}
          onOpenCamera={() => {
            setCameraReturnStep('checklist');
            setStep('camera');
          }}
          onContinue={() => setStep('summary')}
          onBack={() => setStep('bluetooth')}
        />
      )}
      {step === 'camera' && (
        <CameraAssistScreen
          onPhoto={photo => setSession(current => ({...current, photos: [...current.photos, photo]}))}
          onDone={() => setStep(cameraReturnStep)}
        />
      )}
      {step === 'summary' && (
        <SummaryScreen
          session={session}
          onNotes={notes => setSession(current => ({...current, notes}))}
          onBack={() => setStep('checklist')}
          onRestart={restart}
        />
      )}
    </SafeAreaProvider>
  );
}
