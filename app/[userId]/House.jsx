// File: app/[userId]/House.jsx

"use client"
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fireApp } from "@/important/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import ProfilePic from "./components/ProfilePic";
import UserInfo from "./components/UserInfo";
import BgDiv from "./components/BgDiv";
import MyLinks from "./components/MyLinks";
import SupportBanner from "./components/SupportBanner";
import PublicLanguageSwitcher from "./components/PublicLanguageSwitcher";
import SensitiveWarning from "./components/SensitiveWarning";
import { trackView } from '@/lib/services/analyticsService'; // ✅ IMPORT the new analytics service

export const HouseContext = React.createContext(null);

export default function House({ initialUserData }) {
    // Initialize state with server-fetched data
    const [userData, setUserData] = useState(initialUserData);
    const [showSensitiveWarning, setShowSensitiveWarning] = useState(initialUserData?.sensitiveStatus || false);
    const [isOnline, setIsOnline] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const [viewTracked, setViewTracked] = useState(false); // ✅ State to prevent duplicate view tracking
    const updateInProgress = useRef(false);
   // ✅ NEW: Check for preview mode once on component mount
    const isPreviewMode = useMemo(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('preview') === 'true';
        }
        return false;
    }, []);

    // Effect for real-time data listening
    useEffect(() => {
        if (!userData?.uid) return;

        console.log('🔄 Setting up real-time listener for user:', userData.uid);
        
        const docRef = doc(fireApp, "AccountData", userData.uid);
        const unsubscribe = onSnapshot(docRef, 
            (docSnap) => {
                if (docSnap.exists()) {
                    if (updateInProgress.current) {
                        console.log('🔄 Update in progress, skipping real-time update');
                        return;
                    }
                    const latestData = docSnap.data();
                    setUserData(prevData => ({ ...prevData, ...latestData, uid: userData.uid }));
                    if (retryCount > 0) {
                        setRetryCount(0);
                        setIsOnline(true);
                    }
                } else {
                    console.warn('❌ User document not found in real-time update');
                }
            },
            (error) => {
                console.error('❌ Real-time listener error:', error);
                if (error.code === 'unavailable') {
                    setIsOnline(false);
                    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    setTimeout(() => setRetryCount(prev => prev + 1), retryDelay);
                }
            }
        );

        return () => {
            console.log('🧹 Cleaning up real-time listener');
            unsubscribe();
        };
    }, [userData?.uid, retryCount]);

      // ✅ CORRECTED: Effect for tracking the profile view event
    useEffect(() => {
        // Condition 1: Don't track if already tracked.
        if (viewTracked) return;
        // Condition 2: Don't track if in preview mode.
        if (isPreviewMode) {
            console.log(" G-Analytics: View tracking skipped, PREVIEW MODE is active.");
            return;
        }
        // Condition 3: Ensure we have the necessary data.
        if (userData?.uid && userData?.username) {
            const timer = setTimeout(() => {
                trackView(userData.uid, userData.username);
                setViewTracked(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [viewTracked, isPreviewMode, userData?.uid, userData?.username]); // Dependencies ensure this runs only when needed

    // Effect for online/offline status
    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); setRetryCount(0); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const contextValue = useMemo(() => ({
        userData,
        setShowSensitiveWarning,
        isOnline,
        retryCount
    }), [userData, isOnline, retryCount]);

    if (!userData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading user profile...</p>
                </div>
            </div>
        );
    }

    return (
        <HouseContext.Provider value={contextValue}>
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50 text-sm">
                    ⚠️ Connection lost. Trying to reconnect... (Attempt {retryCount + 1})
                </div>
            )}
            
            <PublicLanguageSwitcher />
            
            {showSensitiveWarning ? (
                <SensitiveWarning />
            ) : (
                <>
                    <BgDiv />
                    <div className="relative z-20 md:w-[50rem] w-full flex flex-col items-center h-full mx-auto">
                        <div className="flex flex-col items-center flex-1 overflow-auto py-6">
                            <ProfilePic />
                            <UserInfo />
                            <MyLinks />
                        </div>
                    </div>
                    <SupportBanner />
                </>
            )}
        </HouseContext.Provider>
    );
}