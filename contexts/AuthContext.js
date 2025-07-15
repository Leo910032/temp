"use client"
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithCustomToken // <-- Important for the new secure login flow
} from 'firebase/auth';
import { auth, fireApp } from '@/important/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { collection, doc, setDoc, getDocs, query, where, getDoc } from "firebase/firestore";

// Create the authentication context
const AuthContext = createContext();

/**
 * Custom hook to use the AuthContext.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Provides authentication state and functions to the entire app.
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      
      // Automatically redirect user if they are on a login/signup page while authenticated
      if (user && (pathname === '/login' || pathname === '/signup')) {
        router.push('/dashboard');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router, pathname]);

  /**
   * Creates a user document in Firestore for new social sign-ins.
   * This is safe because it only runs after a user is already authenticated via a popup.
   */
  const createUserDocumentForSocialLogin = async (user) => {
    const userRef = doc(fireApp, "AccountData", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return; // Document already exists, do nothing.
    }
    
    // Generate a unique username from display name or email
    let username = (user.displayName || user.email.split('@')[0])
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 20);
    
    // Ensure the generated username is unique by checking the database
    const accountsRef = collection(fireApp, "AccountData");
    let baseUsername = username;
    let counter = 1;
    while (true) {
        const q = query(accountsRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) break;
        username = `${baseUsername}_${counter++}`;
    }

    // Create the new document
    await setDoc(userRef, {
      displayName: user.displayName || user.email.split('@')[0],
      username: username,
      email: user.email,
      links: [],
      socials: [],
      profilePhoto: user.photoURL || "",
      selectedTheme: "Lake White",
      createdAt: new Date(),
      emailVerified: user.emailVerified || false,
      uid: user.uid,
    });
  };

  /**
   * Signs up a new user via a secure server-side API route.
   */
  const signup = async (email, password, username) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Signup failed');
    
    // Use the custom token from the server to sign the user in securely
    await signInWithCustomToken(auth, data.customToken);
  };

  /**
   * Logs in a user via a secure server-side API route.
   * This is the new, secure implementation.
   */
  const login = async (usernameOrEmail, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameOrEmail, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    
    // Use the custom token from the server to complete the sign-in
    await signInWithCustomToken(auth, data.customToken);
  };

  /**
   * Logs out the current user.
   */
  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  /**
   * Sends a password reset email.
   */
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  /**
   * Handles sign-in with Google popup.
   */
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    await createUserDocumentForSocialLogin(userCredential.user);
    return userCredential.user;
  };
  
  // Define the context value
  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    signInWithGoogle,
    // Add other social providers here if needed, e.g., signInWithMicrosoft
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}