import { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { nativeKernelHtml } from './nativeKernel.generated';
import { attachMotionBridge, motionCommand, receiveMotion } from './nativeMotionBridge';
const source = { html: nativeKernelHtml };

/** One tiny, offline Rust clock for native UI presentation adapters. */
export function NativeMotionHost() {
  const ref = useRef<WebView>(null);
  useEffect(() => { const sub = AppState.addEventListener('change', state => motionCommand('active', state === 'active')); return () => { sub.remove(); attachMotionBridge(undefined); }; }, []);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
    <WebView ref={ref} source={source} javaScriptEnabled scrollEnabled={false} domStorageEnabled={false} originWhitelist={['*']}
      allowFileAccess={false} allowUniversalAccessFromFileURLs={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('data:text/html')}
      onMessage={event => { const data = JSON.parse(event.nativeEvent.data); if (data.type === 'ready') attachMotionBridge((method, args) => ref.current?.injectJavaScript(`window.NativeMotion.command(${JSON.stringify(method)},${JSON.stringify(args)});true;`)); else receiveMotion(data); }} />
  </View>;
}
