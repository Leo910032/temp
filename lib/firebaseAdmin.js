// File: lib/firebaseAdmin.js
// This file is responsible for initializing the Firebase Admin SDK.
// It should ONLY be imported in server-side files (e.g., API routes).

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Define the service account object using environment variables.
// This is done once at the top level.
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Important for Vercel deployment
};

let adminApp;
let adminAuth;
let adminDb;

// Check if we're on the server and if the app hasn't been initialized yet.
if (typeof window === 'undefined' && !getApps().length) {
    try {
        adminApp = initializeApp({
            credential: cert(serviceAccount)
        });
        console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error);
        // Throwing an error here can help debug server startup issues.
        throw new Error('Failed to initialize Firebase Admin SDK.');
    }
} else {
    // If it's already initialized, get the existing app instance.
    adminApp = getApps()[0];
}

// Export the initialized services.
adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp);

export { adminAuth, adminDb };