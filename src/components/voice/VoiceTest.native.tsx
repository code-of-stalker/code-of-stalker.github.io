import { requireOptionalNativeModule } from 'expo';
import { lazy, Suspense } from 'react';
import { Text, View } from 'react-native';
import type { VoiceTestProps } from './VoiceTest.types';

// Old development APKs must still open their saved Matrix session while the
// APK containing ExpoAudio is being built. Do not evaluate expo-audio early.
const VoiceRecorderCard = lazy(() => import('./VoiceRecorderCard'));

export default function VoiceTest(props: VoiceTestProps) {
  if (!requireOptionalNativeModule('ExpoAudio')) {
    return <View style={{ padding: 22, borderRadius: 18, backgroundColor: '#fff', gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#182b39' }}>Голосовое сообщение</Text>
      <Text style={{ fontSize: 18, color: '#394b59' }}>Для микрофона установи новый APK из этого чата поверх текущего приложения. После обновления вход должен сохраниться.</Text>
    </View>;
  }
  return <Suspense fallback={<Text>Открываем запись голоса…</Text>}><VoiceRecorderCard {...props} /></Suspense>;
}
