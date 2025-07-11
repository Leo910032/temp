"use client"
import Image from "next/image";
import SocialCard from "./mini components/SocialCard";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import Position from "../elements/Position";
import Link from "next/link";
import AddIconModal from "../elements/AddIconModal";
import EditIconModal from "../elements/EditIconModal";
import { useAuth } from "@/contexts/AuthContext";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { fireApp } from "@/important/firebase";
import { updateSocials } from "@/lib/update data/updateSocials";
import { useTranslation } from "@/lib/translation/useTranslation";

export const SocialContext = React.createContext();

export default function SocialSetting() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [addIconModalOpen, setAddIconModalOpen] = useState(false);
    const [settingIconModalOpen, setSettingIconModalOpen] = useState({
        status: false,
        type: 0,
        operation: 0,
        active: false
    });
    const [socialsArray, setSocialsArray] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.social_icons.title'),
            cardTitle: t('dashboard.settings.social_icons.card_title'),
            cardSubtitle: t('dashboard.settings.social_icons.card_subtitle'),
            addIconButton: t('dashboard.settings.social_icons.add_icon_button'),
            dragAndDropHelper: t('dashboard.settings.social_icons.drag_and_drop_helper'),
            positionTitle: t('dashboard.settings.social_icons.position_title'),
            positionSubtitle: t('dashboard.settings.social_icons.position_subtitle'),
            altIcon: t('dashboard.settings.social_icons.alt_icon'),
        };
    }, [t, isInitialized]);

    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setSocialsArray(docSnap.data().socials || []);
            } else {
                setSocialsArray([]);
            }
        }, (error) => {
            console.error("Error fetching socials:", error);
            setSocialsArray([]);
        });
        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
        };
    }, [currentUser]);

    useEffect(() => {
        if (!hasLoaded) {
            setHasLoaded(true);
            return;
        }
        if (currentUser) {
            updateSocials(socialsArray, currentUser.uid);
        }
    }, [socialsArray, hasLoaded, currentUser]);

    if (!isInitialized || !currentUser) {
        return (
            <div className="w-full my-4 px-2 animate-pulse" id="Settings--SocialLinks">
                <div className="flex items-center gap-3 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded-md"></div>
                    <div className="h-7 w-32 bg-gray-200 rounded-md"></div>
                </div>
                <div className="p-5 bg-gray-200 rounded-lg">
                    <div className="h-6 w-24 bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-full bg-gray-200 rounded-md mt-2"></div>
                    <div className="h-10 w-28 bg-gray-300 rounded-3xl my-7"></div>
                </div>
            </div>
        );
    }

    return (
        <SocialContext.Provider value={{ 
            socialsArray, 
            setSocialsArray, 
            setSettingIconModalOpen, 
            setAddIconModalOpen, 
            settingIconModalOpen,
            currentUser
        }}>
            <div className="w-full my-4 px-2" id="Settings--SocialLinks">
                <div className="flex items-center gap-3 py-4">
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/social.svg"}
                        alt={translations.altIcon}
                        height={24}
                        width={24}
                    />
                    <span className="text-xl font-semibold">{translations.title}</span>
                </div>
                <div className="p-5 bg-white rounded-lg">
                    <div className="grid gap-1">
                        <span className="font-semibold">{translations.cardTitle}</span>
                        <span className="opacity-90 sm:text-base text-sm">{translations.cardSubtitle}</span>
                    </div>
                    <div className="w-fit rounded-3xl bg-btnPrimary hover:bg-btnPrimaryAlt text-white py-3 px-4 my-7 cursor-pointer active:scale-90 select-none" onClick={()=>setAddIconModalOpen(true)}>
                        {translations.addIconButton}
                    </div>
                    {socialsArray.length > 0 && <div>
                        <SocialCard array={socialsArray} />
                        <p className="my-4 opacity-60 text-sm">{translations.dragAndDropHelper}</p>
                        <div className="grid gap-1 text-sm mt-5">
                            <span className="font-semibold">{translations.positionTitle}</span>
                            <span className="opacity-90">{translations.positionSubtitle}</span>
                        </div>
                        <Position />
                    </div>}
                    {/* <Link className="text-btnPrimary active:text-btnPrimaryAlt underline mt-3" href={"/dashboard/analytics"}>See analytics</Link> */}
                </div>
                {addIconModalOpen && <AddIconModal />}
                {settingIconModalOpen.status && <EditIconModal />}
            </div>
        </SocialContext.Provider>
    );
}