"use client";

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";

export type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  functions: Functions;
};

let client: FirebaseClient | null = null;
let appCheckInitialized = false;

// Firebase web configuration is public by design; secrets remain server-side.
const defaultFirebaseClientConfig: FirebaseOptions = {
  projectId: "foodsick-signal-map-kr",
  apiKey: "AIzaSyDeohLAs7aDoTrC7JdzqhbR7eFSa4HrOzs",
  authDomain: "foodsick-signal-map-kr.firebaseapp.com",
  appId: "1:126271004619:web:7c8a29a919d1e0c1f7a04e",
  messagingSenderId: "126271004619",
};

export function firebaseClientConfig(): FirebaseOptions | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultFirebaseClientConfig.projectId;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || defaultFirebaseClientConfig.apiKey;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultFirebaseClientConfig.authDomain;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || defaultFirebaseClientConfig.appId;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseClientConfig.messagingSenderId;
  if (!projectId || !apiKey || !authDomain || !appId || !messagingSenderId) return null;
  return { projectId, apiKey, authDomain, appId, messagingSenderId };
}

export function firebaseBackendEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_MODE !== "mock" && firebaseClientConfig() !== null;
}

export function getFirebaseClient(): FirebaseClient | null {
  if (typeof window === "undefined") return null;
  const config = firebaseClientConfig();
  if (!config) return null;
  if (client) return client;

  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const functions = getFunctions(app, "asia-northeast3");
  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }

  const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (appCheckSiteKey && !appCheckInitialized) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  client = { app, auth, functions };
  return client;
}
