"use client"
import Image from "next/image";
import SupportSwitch from "../elements/SupportSwitch";
import React, { useEffect, useState } from "react";
import ChooseCause from "./ChooseCause";
import { useAuth } from "@/contexts/AuthContext"; // 1. Import useAuth hook
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
// 2. Ensure these update functions are refactored to accept a userId
import { updateSupportBanner, updateSupportBannerStatus } from "@/lib/update data/updateSettings"; // Assuming you moved this to a better-named file

export const SupportContext = React.createContext();

export default function SupportBanner() {
    const { currentUser } = useAuth(); // 3. Get the authenticated user
    const [showSupport, setShowSupport] = useState(null);
    const [chosenGroup, setChosenGroup] = useState(null);

    // Effect to update the chosen cause in Firestore
    useEffect(() => {
        // 4. Don't run update if data hasn't loaded or user isn't logged in
        if (chosenGroup === null || !currentUser) {
            return;
        }

        // 5. Pass currentUser.uid to the updated function
        updateSupportBanner(chosenGroup, currentUser.uid);
    }, [chosenGroup, currentUser]); // 6. Add currentUser to dependency array

    // Effect to update the banner visibility status in Firestore
    useEffect(() => {
        if (showSupport === null || !currentUser) {
            return;
        }

        updateSupportBannerStatus(showSupport, currentUser.uid);
    }, [showSupport, currentUser]); // 6. Add currentUser to dependency array

    // Effect to fetch initial data for the component
    useEffect(() => {
        // 7. Only fetch data if the user is authenticated
        if (!currentUser) return;

        const collectionRef = collection(fireApp, "AccountData");
        const docRef = doc(collectionRef, currentUser.uid); // 8. Use currentUser.uid

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { supportBanner, supportBannerStatus } = docSnap.data();
                setChosenGroup(supportBanner !== undefined ? supportBanner : 0);
                setShowSupport(supportBannerStatus !== undefined ? supportBannerStatus : false);
            } else {
                // Set default values if the document doesn't exist
                setChosenGroup(0);
                setShowSupport(false);
            }
        });

        // Cleanup the listener on component unmount
        return () => unsubscribe();
    }, [currentUser]); // 9. Re-run this effect if the user changes

    // Don't render anything until we know the user's auth state and have data
    if (showSupport === null) {
        return null; // or a loading skeleton
    }

    return (
        <SupportContext.Provider value={{ showSupport, setShowSupport, chosenGroup, setChosenGroup }}>
            <div className="w-full my-4 px-2" id="Settings--SupportBanner">
                <div className="flex items-center gap-3 py-4">
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/support.svg"}
                        alt="icon"
                        height={24}
                        width={24}
                    />
                    <span className="text-xl font-semibold">Support banner</span>
                </div>
                <div className="p-5 bg-white rounded-lg">
                    <SupportSwitch />
                    {showSupport && <ChooseCause />}
                </div>
            </div>
        </SupportContext.Provider>
    );
}