// File: app/[userId]/House.jsx

"use client"
import React, { useEffect, useState, useMemo } from "react";
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
    const [showSensitiveWarning, setShowSensitiveWarning] = useState(initialUserData.sensitiveStatus);

    // Set up a SINGLE real-time listener to keep the page live
    useEffect(() => {
        const docRef = doc(fireApp, "AccountData", userData.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                // Update state with the latest data from Firestore
                const latestData = docSnap.data();
                setUserData(prevData => ({ ...prevData, ...latestData }));
            }
        });

        // Cleanup listener on component unmount
        return () => unsubscribe();
    }, [userData.uid]);

    // Memoize context value to prevent unnecessary re-renders in consumers
    const contextValue = useMemo(() => ({
        userData,
        setShowSensitiveWarning
    }), [userData]);

    if (!userData) {
        return null; // Or a loading spinner, though this case is unlikely with server-fetched props
    }

    return (
        <HouseContext.Provider value={contextValue}>
            <PublicLanguageSwitcher />
            
            {showSensitiveWarning ? (
                <SensitiveWarning />
            ) : (
                <>
                    {/* All child components now get data from context or props */}
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