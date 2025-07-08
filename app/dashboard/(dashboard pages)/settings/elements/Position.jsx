'use client'

import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateSocialPosition } from "@/lib/update data/updateSocials"; // Assuming this function is updated to accept a userId
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Position() {
    const { currentUser } = useAuth(); // 1. Use the Auth context
    const [pick, setPick] = useState(0);
    const [hasPicked, setHasPicked] = useState(false);

    // 2. Fetch initial data, now dependent on the user
    useEffect(() => {
        // Don't run if the user isn't loaded yet
        if (!currentUser) {
            return;
        }

        const docRef = doc(fireApp, "AccountData", currentUser.uid); // Use Firebase Auth UID
    
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { socialPosition } = docSnap.data();
                // Set initial position without triggering the update effect
                setPick(socialPosition !== undefined ? socialPosition : 0);
            }
        });

        // Cleanup listener on unmount or user change
        return () => unsubscribe();
    }, [currentUser]); // Re-run when the user logs in

    // 3. Update data, also dependent on the user
    useEffect(() => {
        // Prevent update on initial render
        if (!hasPicked) {
            setHasPicked(true);
            return;
        }

        // Prevent update if user is not logged in
        if (!currentUser) {
            return;
        }

        const handleUpdatePosition = async () => {
            try {
                // Assuming updateSocialPosition is refactored to take (position, userId)
                // If not, you can update the document directly here:
                const docRef = doc(fireApp, "AccountData", currentUser.uid);
                await updateDoc(docRef, { socialPosition: pick });
                
                // If you have the external function:
                // await updateSocialPosition(pick, currentUser.uid);

            } catch (error) {
                toast.error("Failed to update position.");
                console.error("Error updating social position:", error);
            }
        };

        handleUpdatePosition();
    }, [pick, hasPicked, currentUser]); // Rerun when 'pick' or 'currentUser' changes


    return (
        <div className="my-5 grid gap-4 pl-5">
            <div className="cursor-pointer flex items-center gap-3 w-fit" onClick={() => setPick(0)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 0 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span className="opacity-80">Top</span>
                </div>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(1)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 1 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span className="opacity-80">bottom</span>
                </div>
            </div>
        </div>
    )
}