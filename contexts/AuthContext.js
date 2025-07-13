// ====================================================================
// 3. UPDATED AUTH CONTEXT: contexts/AuthContext.js
// ====================================================================

"use client"
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithCustomToken
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

  // Helper function to create user document for social logins
  const createUserDocument = async (user, additionalData = {}) => {
    const userRef = doc(fireApp, "AccountData", user.uid);
    
    // Check if document already exists
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return; // Document already exists, no need to create
    }
    
    let username = additionalData.username;
    
    // Generate username from display name or email if not provided
    if (!username) {
      if (user.displayName) {
        username = user.displayName
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .substring(0, 20);
      } else {
        username = user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      }
      
      // Make sure the generated username is unique
      const accountsRef = collection(fireApp, "AccountData");
      let baseUsername = username;
      let counter = 1;
      
      while (true) {
        const q = query(accountsRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) break;
        
        username = `${baseUsername}_${counter}`;
        counter++;
      }
    }
    
    await setDoc(userRef, {
      displayName: additionalData.username || user.displayName || user.email.split('@')[0],
      username: username,
      email: user.email,
      links: [],
      socials: [],
      profilePhoto: user.photoURL || "",
      selectedTheme: "Lake White",
      createdAt: new Date(),
      emailVerified: user.emailVerified || false,
      ...additionalData
    }, { merge: true });
  };

  // ====================================================================
  // SERVER-SIDE SIGNUP (NEW METHOD)
  // ====================================================================
  
  const signup = async (email, password, username) => {
    try {
      // Call server-side signup API
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          username: username.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Sign in with the custom token
      const userCredential = await signInWithCustomToken(auth, data.customToken);
      
      return {
        user: userCredential.user,
        serverData: data
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  // ====================================================================
  // EXISTING LOGIN METHOD (ENHANCED)
  // ====================================================================
  
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

  // ====================================================================
  // SOCIAL LOGIN METHODS (UNCHANGED)
  // ====================================================================
  
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Create user document if it doesn't exist
    await createUserDocument(user);

    return user;
  };

  const signInWithMicrosoft = async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.addScope('https://graph.microsoft.com/User.Read');
    
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Create user document if it doesn't exist
    await createUserDocument(user);

    return user;
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Create user document if it doesn't exist
    await createUserDocument(user);

    return user;
  };

  // ====================================================================
  // UTILITY METHODS
  // ====================================================================
  
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

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
    signup,        // Now uses server-side authentication
    login,
    logout,
    resetPassword,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithApple
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

