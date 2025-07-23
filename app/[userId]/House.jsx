// File: app/[userId]/House.jsx - OPTIMIZED VERSION

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

export const HouseContext = React.createContext(null);

export default function House({ initialUserData }) {
    // Initialize state with server-fetched data
    const [userData, setUserData] = useState(initialUserData);
    const [showSensitiveWarning, setShowSensitiveWarning] = useState(initialUserData?.sensitiveStatus || false);
    const [isOnline, setIsOnline] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const updateInProgress = useRef(false); // ✅ ADD: Prevent update conflicts

    // ✅ IMPROVED: Controlled real-time listener with better conflict prevention
    useEffect(() => {
        if (!userData?.uid) return;

        console.log('🔄 Setting up real-time listener for user:', userData.uid);
        
        const docRef = doc(fireApp, "AccountData", userData.uid);
        
        // Set up the listener with error handling
        const unsubscribe = onSnapshot(
            docRef, 
            (docSnap) => {
                if (docSnap.exists()) {
                    // ✅ FIXED: Prevent update conflicts with settings page
                    if (updateInProgress.current) {
                        console.log('🔄 Update in progress, skipping real-time update');
                        return;
                    }

                    const latestData = docSnap.data();
                    console.log('✅ Real-time update received for public page');
                    
                    setUserData(prevData => {
                        // ✅ IMPROVED: Only update if data actually changed
                        const currentDataString = JSON.stringify(prevData);
                        const newDataString = JSON.stringify({ ...prevData, ...latestData, uid: userData.uid });
                        
                        if (currentDataString === newDataString) {
                            console.log('🔄 No real changes in real-time update, skipping');
                            return prevData;
                        }

                        console.log('🔄 Applying real-time update');
                        return { 
                            ...prevData, 
                            ...latestData,
                            uid: userData.uid // Preserve the UID
                        };
                    });
                    
                    // Reset retry count on successful update
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
                
                // Handle different types of errors
                if (error.code === 'permission-denied') {
                    console.error('Permission denied - user may have changed privacy settings');
                } else if (error.code === 'unavailable') {
                    console.warn('Firestore temporarily unavailable, will retry...');
                    setIsOnline(false);
                    
                    // Implement exponential backoff
                    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                    }, retryDelay);
                } else {
                    console.error('Unexpected Firestore error:', error);
                }
            }
        );

        // Cleanup listener on component unmount
        return () => {
            console.log('🧹 Cleaning up real-time listener');
            unsubscribe();
        };
    }, [userData?.uid, retryCount]); // Only depend on UID and retry count

    // ✅ IMPROVED: Connection status monitoring
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Connection restored');
            setIsOnline(true);
            setRetryCount(0);
        };
        
        const handleOffline = () => {
            console.log('🌐 Connection lost');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ✅ OPTIMIZED: Better memoized context value to prevent unnecessary re-renders
    const contextValue = useMemo(() => ({
        userData,
        setShowSensitiveWarning,
        isOnline,
        retryCount
    }), [userData, isOnline, retryCount]); // Removed setShowSensitiveWarning from deps since it's stable

    // ✅ IMPROVED: Better error handling for missing data
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
            {/* ✅ ADDED: Connection status indicator */}
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
                    {/* All child components now get data from context */}
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