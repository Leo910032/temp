"use client"

import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateThemeGradientDirection } from "@/lib/update data/updateTheme";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react"

export default function GradientPicker() {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [pick, setPick] = useState(0);
    const [hasPicked, setHasPicked] = useState(false);

    const handleUpdateTheme = async() => {
        if (!currentUser) return; // Don't update if no user
        await updateThemeGradientDirection(pick, currentUser.uid); // Pass user ID to update function
    }

    useEffect(() => {
        function fetchTheme() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID
        
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { gradientDirection } = docSnap.data();
                    setPick(gradientDirection ? gradientDirection : 0);
                }
            });

            // Return cleanup function
            return unsubscribe;
        }
        
        fetchTheme();
    }, [currentUser]); // Depend on currentUser

    useEffect(() => {
        if (!hasPicked) {
            setHasPicked(true);
            return;
        }
        handleUpdateTheme();
    }, [pick, currentUser]); // Add currentUser to dependencies

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

    return (
        <div className="my-4 grid gap-3">
            <div className="cursor-pointer flex items-center gap-3 w-fit" onClick={()=>setPick(0)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 0 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <div className="h-8 w-8 rounded-lg mr-3" style={{ backgroundImage: 'linear-gradient(to bottom, #fff, rgba(0, 0, 0, 0.75))' }}></div>
                    <span className="opacity-80">Gradient down</span>
                </div>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={()=>setPick(1)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 1 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <div className="h-8 w-8 rounded-lg mr-3" style={{ backgroundImage: 'linear-gradient(to top, #fff, rgba(0, 0, 0, 0.75))' }}></div>                
                    <span className="opacity-80">Gradient up</span>
                </div>
            </div>
        </div>
    )
}