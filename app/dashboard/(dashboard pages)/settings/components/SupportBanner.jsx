"use client"
import Image from "next/image";
import SupportSwitch from "../elements/SupportSwitch";
import React, { useEffect, useState } from "react";
import ChooseCause from "./ChooseCause";
import { useAuth } from "@/contexts/AuthContext";
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
// Import from the correct file path
import { updateSupportBanner, updateSupportBannerStatus } from "@/lib/update data/updateSocials";

export const SupportContext = React.createContext();

export default function SupportBanner() {
    const { currentUser } = useAuth();
    const [showSupport, setShowSupport] = useState(null);
    const [chosenGroup, setChosenGroup] = useState(null);
    const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

    // Effect to update the chosen cause in Firestore
    useEffect(() => {
        // Don't run update if data hasn't loaded, user isn't logged in, or this is the initial load
        if (chosenGroup === null || !currentUser || !hasInitiallyLoaded) {
            return;
        }

        // Pass currentUser.uid to the updated function
        updateSupportBanner(chosenGroup, currentUser.uid);
    }, [chosenGroup, currentUser, hasInitiallyLoaded]);

    // Effect to update the banner visibility status in Firestore
    useEffect(() => {
        if (showSupport === null || !currentUser || !hasInitiallyLoaded) {
            return;
        }

        updateSupportBannerStatus(showSupport, currentUser.uid);
    }, [showSupport, currentUser, hasInitiallyLoaded]);

    // Effect to fetch initial data for the component
    useEffect(() => {
        // Only fetch data if the user is authenticated
        if (!currentUser) return;

        const collectionRef = collection(fireApp, "AccountData");
        const docRef = doc(collectionRef, currentUser.uid);

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
            
            // Mark that we've loaded initial data
            if (!hasInitiallyLoaded) {
                setHasInitiallyLoaded(true);
            }
        }, (error) => {
            console.error("Error fetching support banner data:", error);
            // Set default values on error
            setChosenGroup(0);
            setShowSupport(false);
            
            // Mark that we've loaded initial data (even on error)
            if (!hasInitiallyLoaded) {
                setHasInitiallyLoaded(true);
            }
        });

        // Cleanup the listener on component unmount
        return () => unsubscribe();
    }, [currentUser, hasInitiallyLoaded]);

    // Don't render anything until we know the user's auth state and have data
    if (showSupport === null || !hasInitiallyLoaded) {
        return (
            <div className="w-full my-4 px-2">
                <div className="flex items-center gap-3 py-4">
                    <div className="animate-pulse h-6 w-6 bg-gray-200 rounded"></div>
                    <div className="animate-pulse h-6 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="p-5 bg-white rounded-lg">
                    <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        );
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