// contexts/AuthContext.js
"use client"
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, fireApp } from '@/important/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { collection, doc, setDoc, getDocs, query, where, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      
      // Redirect logic
      if (user && (pathname === '/login' || pathname === '/signup')) {
        router.push('/dashboard');
      }
    });

    return unsubscribe;
  }, [router, pathname]);

  // Helper function to check if username exists
  const checkUsernameExists = async (username) => {
    const accountsRef = collection(fireApp, "AccountData");
    const q = query(accountsRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  // Helper function to get email by username
  const getEmailByUsername = async (username) => {
    const accountsRef = collection(fireApp, "AccountData");
    const q = query(accountsRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return doc.data().email;
    }
    return null;
  };

  // Helper function to create user document
  const createUserDocument = async (user, additionalData = {}) => {
    const userRef = doc(fireApp, "AccountData", user.uid);
    
    await setDoc(userRef, {
      displayName: additionalData.username || user.displayName || user.email.split('@')[0],
      username: additionalData.username || user.displayName || user.email.split('@')[0],
      email: user.email,
      links: [],
      socials: [],
      profilePhoto: user.photoURL || "",
      selectedTheme: "Lake White",
      createdAt: new Date(),
      ...additionalData
    }, { merge: true });
  };

  // Create account with email/password
  const signup = async (email, password, username) => {
    // Check if username already exists
    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      throw new Error("Username already exists");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update the user's display name
    await updateProfile(user, {
      displayName: username
    });

    // Create user document in Firestore
    await createUserDocument(user, { username });

    return user;
  };

  // Sign in with email/password (using username or email)
  const login = async (usernameOrEmail, password) => {
    let email = usernameOrEmail;
    
    // If it's not an email, find the email by username
    if (!usernameOrEmail.includes('@')) {
      email = await getEmailByUsername(usernameOrEmail);
      if (!email) {
        throw new Error("Username not found");
      }
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  // Google sign in
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Check if user document exists, create if not
    const userRef = doc(fireApp, "AccountData", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await createUserDocument(user);
    }

    return user;
  };

  // Password reset
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Sign out
  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    signInWithGoogle
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}