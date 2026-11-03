import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';

// The app shows the website; every web deploy reaches the app without a new build
const SITE_URL = Constants.expoConfig?.extra?.siteUrl ?? 'https://celiac-square.vercel.app';
const SITE_HOST = new URL(SITE_URL).host;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const webRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

  // Android back button navigates inside the site before leaving the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // Links to other sites (Open Food Facts, Google Maps, phone numbers) open outside the app
  const onShouldStartLoad = useCallback((req) => {
    const { url } = req;
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
    try {
      if (new URL(url).host === SITE_HOST) return true;
    } catch {
      // not a URL we can parse: let the system decide
    }
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const retry = () => {
    setFailed(false);
    webRef.current?.reload();
  };

  return (
    <SafeAreaProvider>
      {/* Bottom inset is left to the page: its tab bar pads itself with env(safe-area-inset-bottom) */}
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="dark" backgroundColor="#DBD5BF" />
        {failed ? (
          <View style={styles.offline}>
            <Text style={styles.title}>Pas de connexion</Text>
            <Text style={styles.body}>Celiac Square a besoin d’internet. Vérifiez votre connexion puis réessayez.</Text>
            <Pressable onPress={retry} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: SITE_URL }}
            style={styles.web}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={onShouldStartLoad}
            onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
            onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
            onError={() => {
              setFailed(true);
              SplashScreen.hideAsync().catch(() => {});
            }}
            // Scanner: photo picker / camera capture and live camera from the page
            allowFileAccess
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            textZoom={100}
            applicationNameForUserAgent={`CeliacSquareApp/1.0 (${Platform.OS})`}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DBD5BF' },
  web: { flex: 1, backgroundColor: '#DBD5BF' },
  offline: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontSize: 26, fontWeight: '600', color: '#2F261D' },
  body: { marginTop: 8, fontSize: 16, lineHeight: 24, color: '#584A3B' },
  button: { marginTop: 24, alignSelf: 'flex-start', backgroundColor: '#FF8A41', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  buttonPressed: { backgroundColor: '#F27A2E' },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#2F261D' },
});
