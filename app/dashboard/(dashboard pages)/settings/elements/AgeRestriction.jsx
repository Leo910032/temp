"use client";

import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

// This is the updated data update function.
// It should be moved to a file like `lib/update data/updateUserSettings.js`
async function updateSensitiveType(type, userId) {
    if (!userId) {
        console.error("updateSensitiveType failed: No user ID provided.");
        throw new Error("User not authenticated.");
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        // Use setDoc with merge to create or update the field
        await setDoc(docRef, { sensitivetype: type }, { merge: true });
    } catch (error) {
        console.error("Error updating sensitive type:", error);
        toast.error("Could not save setting.");
        throw new Error(error.message);
    }
}


export default function AgeRestriction() {
    const { currentUser } = useAuth();
    const [pick, setPick] = useState(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Effect for fetching the initial setting
    useEffect(() => {
        if (!currentUser) return;

        const docRef = doc(fireApp, "AccountData", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { sensitivetype } = docSnap.data();
                // Use nullish coalescing to provide a default value (3)
                setPick(sensitivetype ?? 3);
            } else {
                // Default value for a new user or document
                setPick(3);
            }
            setHasLoaded(true);
        });

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, [currentUser]);

    // Effect for updating the setting when the user makes a choice
    useEffect(() => {
        // Don't run on the initial load or if user is not authenticated
        if (!hasLoaded || !currentUser) {
            return;
        }
        
        const handleUpdateType = async() => {
            // The `pick` state can be null initially, so we check
            if (pick !== null) {
                await updateSensitiveType(pick, currentUser.uid);
            }
        }
        
        handleUpdateType();
    }, [pick, hasLoaded, currentUser]);

    // Don't render the component until the user state is confirmed
    if (!currentUser) {
        return null;
    }

    return (
        <div className="my-5 grid gap-4">
            <span className="text-sm font-semibold">Please select one:</span>
            <div className="cursor-pointer flex items-center gap-3 w-fit" onClick={() => setPick(0)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 0 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span>18+</span>
                </div>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(1)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 1 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span>21+</span>
                </div>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(2)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 2 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span>25+</span>
                </div>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(3)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 3 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span>Sensitive Content</span>
                </div>
            </div>
        </div>
    );
}