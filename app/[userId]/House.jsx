"use client"
import ProfilePic from "./components/ProfilePic";
import UserInfo from "./components/UserInfo";
import BgDiv from "./components/BgDiv";
import MyLinks from "./components/MyLinks";
import SupportBanner from "./components/SupportBanner";
import React, { useEffect, useState } from "react";
import { fireApp } from "@/important/firebase";
import { collection, doc, getDoc, query, where, getDocs } from "firebase/firestore";
import SensitiveWarning from "./components/SensitiveWarning";

export const HouseContext = React.createContext();

export default function House({ userId }) {
    const [sensitiveWarning, setSensitiveWarning] = useState(null);
    const [hasSensitiveContent, setHasSensitiveContent] = useState(false);
    const [sensitiveType, setSensitiveType] = useState(false);
    const [actualUserId, setActualUserId] = useState(null);

    useEffect(() => {
        async function fetchUserByUsername() {
            try {
                // First, try to find user by username in AccountData
                const accountsRef = collection(fireApp, "AccountData");
                const q = query(accountsRef, where("username", "==", userId.toLowerCase()));
                const querySnapshot = await getDocs(q);
                
                let foundUserId = null;
                
                if (!querySnapshot.empty) {
                    // Found user by username
                    foundUserId = querySnapshot.docs[0].id;
                } else {
                    // If not found by username, try direct Firebase Auth UID lookup
                    const docRef = doc(fireApp, "AccountData", userId);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        foundUserId = userId;
                    }
                }
                
                if (foundUserId) {
                    setActualUserId(foundUserId);
                    
                    // Fetch user data with the found user ID
                    const docRef = doc(fireApp, "AccountData", foundUserId);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const { sensitiveStatus, sensitivetype } = docSnap.data();
                        setSensitiveWarning(sensitiveStatus ? sensitiveStatus : false);
                        setHasSensitiveContent(sensitiveStatus ? sensitiveStatus : false);
                        setSensitiveType(sensitivetype ? sensitivetype : 3);
                    }
                } else {
                    // User not found - you might want to show a 404 page
                    console.error("User not found:", userId);
                    // You could redirect to a 404 page here
                }
                
            } catch (error) {
                console.error("Error fetching user:", error);
            }
        }
        
        fetchUserByUsername();
    }, [userId]);

    // Don't render until we have the actual user ID
    if (!actualUserId) {
        return (
            <div className="w-screen h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <HouseContext.Provider value={{ setSensitiveWarning, sensitiveType, actualUserId }}>
            {!sensitiveWarning ? <>
                <BgDiv userId={actualUserId} />

                <div className="relative z-20 md:w-[50rem] w-full flex flex-col items-center h-full mx-auto">
                    <div className="flex flex-col items-center flex-1 overflow-auto py-6">
                        <ProfilePic userId={actualUserId} />
                        <UserInfo userId={actualUserId} hasSensitiveContent={hasSensitiveContent} />
                        <MyLinks userId={actualUserId} hasSensitiveContent={hasSensitiveContent} />
                    </div>
                </div>
                <SupportBanner userId={actualUserId} />
            </>:
                <SensitiveWarning />}
        </HouseContext.Provider>
    )
}