"use client"
import React, { useEffect, useState } from "react";
import FontsGallery from "../components/FontsGallery";
import { useAuth } from "@/contexts/AuthContext";
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { availableFonts_Classic } from "@/lib/FontsList";

export const selectedFontContext = React.createContext();

export default function SelectFonts() {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [openFontGallery, setOpenFontGallery] = useState(false);
    const [selectedFont, setSelectedFont] = useState("");
    
    useEffect(() => {
        function fetchTheme() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID
        
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { fontType } = docSnap.data();
                    const fontName = availableFonts_Classic[fontType ? fontType - 1 : 0];
                    setSelectedFont(fontName);
                } else {
                    // Set default font if document doesn't exist
                    const defaultFont = availableFonts_Classic[0];
                    setSelectedFont(defaultFont);
                }
            }, (error) => {
                console.error("Error fetching font data:", error);
                // Set default font on error
                const defaultFont = availableFonts_Classic[0];
                setSelectedFont(defaultFont);
            });

            // Return cleanup function
            return unsubscribe;
        }
        
        const unsubscribe = fetchTheme();
        
        // Cleanup function
        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [currentUser]); // Depend on currentUser instead of empty array

    // Don't render if user is not authenticated or selectedFont is not loaded
    if (!currentUser || !selectedFont) {
        return (
            <div className="w-full my-4 rounded-lg py-5 px-4 border shadow-lg flex items-center gap-4 animate-pulse">
                <div className="p-3 rounded-md bg-gray-200 w-12 h-12"></div>
                <div className="flex-1 h-6 bg-gray-200 rounded"></div>
            </div>
        );
    }
    
    return (
        <selectedFontContext.Provider value={{
            openFontGallery, 
            setOpenFontGallery,
            currentUser // Add currentUser to context for child components
        }}>
            <div 
                className={`${selectedFont.class} w-full my-4 group rounded-lg py-5 px-4 border shadow-lg flex items-center gap-4 cursor-pointer hover:bg-black hover:bg-opacity-10 active:scale-95`} 
                onClick={() => setOpenFontGallery(true)}
            >
                <span className="p-3 rounded-md group-hover:bg-white group-hover:bg-opacity-100 bg-black bg-opacity-10 text-xl font-semibold">
                    Aa
                </span>
                <span className="font-semibold flex-1 truncate">
                    {selectedFont.name}
                </span>
            </div>
            {openFontGallery && <FontsGallery />}
        </selectedFontContext.Provider>
    );
}