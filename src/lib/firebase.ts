/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

// Global status for the app to react to
export let isFirestoreHealthy = true;
let connectionErrorHandler: ((msg: string | null) => void) | null = null;

export function onConnectionError(handler: (msg: string | null) => void) {
  connectionErrorHandler = handler;
}

// Connectivity check as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful");
    isFirestoreHealthy = true;
    // Clear any previous error on successful connection
    if (connectionErrorHandler) connectionErrorHandler(null);
  } catch (error: any) {
    // If it's just an offline error, don't scream at the user
    // Firestore will handle it with persistence
    if (error.message?.includes('offline') || error.code === 'unavailable') {
      console.log("App is running in offline mode (Persistence enabled)");
      isFirestoreHealthy = true; // Still healthy for user experience
      return;
    }

    console.error("Firebase connection error:", error);
    isFirestoreHealthy = false;
    
    let message = "";
    if (error.code === 'permission-denied') {
       message = "Firestore Permission Denied: Ensure rules are deployed.";
    } else if (error.code === 'not-found') {
       message = `Firestore Error: Database not found. Please check Firebase Console.`;
    }
    
    if (message && connectionErrorHandler) {
      connectionErrorHandler(message);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  let errorMessage = error instanceof Error ? error.message : String(error);
  
  // Detect index required error and simplify it for better logging/display
  if (errorMessage.includes('index-required') || errorMessage.includes('requires an index')) {
    const indexUrlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s"]+/);
    if (indexUrlMatch) {
      errorMessage = `INDEX_REQUIRED: A database index is required for this view. Create it here: ${indexUrlMatch[0]}`;
    }
  }

  // Notify UI if we have a handler
  if (connectionErrorHandler) {
    connectionErrorHandler(errorMessage);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
