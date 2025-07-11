"use client"
import Image from "next/image";
import SupportSwitch from "../elements/SupportSwitch";
import React, { useEffect, useState, useMemo } from "react";
import ChooseCause from "./ChooseCause";
import { useAuth } from "@/contexts/AuthContext";
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { updateSupportBanner, updateSupportBannerStatus } from "@/lib/update data/updateSocials";
import { useTranslation } from "@/lib/translation/useTranslation";

export const SupportContext = React.createContext();

export default function SupportBanner() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [showSupport, setShowSupport] = useState(null);
    const [chosenGroup, setChosenGroup] = useState(null);
    const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.support_banner.title'),
            altIcon: t('dashboard.settings.support_banner.alt_icon')
        };
    }, [t, isInitialized]);

    useEffect(() => {
        if (chosenGroup === null || !currentUser || !hasInitiallyLoaded) return;
        updateSupportBanner(chosenGroup, currentUser.uid);
    }, [chosenGroup, currentUser, hasInitiallyLoaded]);

    useEffect(() => {
        if (showSupport === null || !currentUser || !hasInitiallyLoaded) return;
        updateSupportBannerStatus(showSupport, currentUser.uid);
    }, [showSupport, currentUser, hasInitiallyLoaded]);

    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { supportBanner, supportBannerStatus } = docSnap.data();
                setChosenGroup(supportBanner !== undefined ? supportBanner : 0);
                setShowSupport(supportBannerStatus !== undefined ? supportBannerStatus : false);
            } else {
                setChosenGroup(0);
                setShowSupport(false);
            }
            if (!hasInitiallyLoaded) {
                setHasInitiallyLoaded(true);
            }
        }, (error) => {
            console.error("Error fetching support banner data:", error);
            setChosenGroup(0);
            setShowSupport(false);
            if (!hasInitiallyLoaded) {
                setHasInitiallyLoaded(true);
            }
        });
        return () => unsubscribe();
    }, [currentUser, hasInitiallyLoaded]);

    if (!isInitialized || showSupport === null || !hasInitiallyLoaded) {
        return (
            <div className="w-full my-4 px-2 animate-pulse">
                <div className="flex items-center gap-3 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded"></div>
                    <div className="h-7 bg-gray-200 rounded w-40"></div>
                </div>
                <div className="p-5 bg-gray-200 rounded-lg">
                    <div className="h-5 bg-gray-300 rounded w-2/4 mb-3"></div>
                    <div className="h-4 bg-gray-300 rounded w-full"></div>
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
                        alt={translations.altIcon}
                        height={24}
                        width={24}
                    />
                    <span className="text-xl font-semibold">{translations.title}</span>
                </div>
                <div className="p-5 bg-white rounded-lg">
                    <SupportSwitch />
                    {showSupport && <ChooseCause />}
                </div>
            </div>
        </SupportContext.Provider>
    );
}