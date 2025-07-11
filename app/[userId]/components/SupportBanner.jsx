"use client"

import { fireApp } from "@/important/firebase";
import { useTranslatedSupportGroups } from "@/lib/SupportGroups"; // CHANGE THIS IMPORT
import { fetchUserData } from "@/lib/fetch data/fetchUserData";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD TRANSLATION IMPORT

export default function SupportBanner({ userId }) {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const translatedSupportGroups = useTranslatedSupportGroups(); // USE TRANSLATED GROUPS
    const [supportGroup, setSupportGroup] = useState(0);
    const [supportGroupStatus, setSupportGroupStatus] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [bgType, setBgType] = useState("");
    const [themeTextColour, setThemeTextColour] = useState("");

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            actNow: t('public.support_banner.act_now')
        };
    }, [t, isInitialized]);

    useEffect(() => {
        async function fetchProfilePicture() {
            const currentUser = await fetchUserData(userId);;
            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, `${currentUser}`);

            onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { themeFontColor, selectedTheme, supportBanner, supportBannerStatus } = docSnap.data();
                    setSupportGroup(supportBanner ? supportBanner : 0);
                    setSupportGroupStatus(supportBannerStatus ? supportBannerStatus : false);
                    setBgType(selectedTheme);
                    setThemeTextColour(themeFontColor ? themeFontColor : "");

                    setTimeout(() => {
                        setExpanded(true);
                    }, 1000);
                }
            });
        }
        fetchProfilePicture();
    }, [userId]);

    // GET CURRENT SUPPORT GROUP WITH TRANSLATIONS
    const currentSupportGroup = translatedSupportGroups[supportGroup] || translatedSupportGroups[0];

    // SHOW LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <>
                {supportGroupStatus && <div className="fixed bottom-0 w-screen left-0 z-[100]">
                    <div className="py-4 px-6 bg-black absolute left-0 w-full bottom-0 text-white banner flex flex-col items-center border-t border-t-green-400/50 shadow-xl">
                        <div className="h-6 w-32 bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-4 w-48 bg-gray-600 rounded animate-pulse mt-2"></div>
                        <div className="h-10 w-40 bg-gray-600 rounded-xl animate-pulse mt-4"></div>
                    </div>
                </div>}
            </>
        );
    }
    
    return (
        <>
            {supportGroupStatus && <div className="fixed bottom-0 w-screen left-0 z-[100]">
                <div className="py-4 px-6 bg-black absolute left-0 w-full bottom-0 text-white banner flex flex-col items-center border-t border-t-green-400/50 shadow-xl" style={{
                    color: bgType === "Matrix" ? themeTextColour : "",
                    backgroundColor: bgType === "Matrix" ? '#000905' : "",
                }}>
                    <div className={`filter invert ${expanded ? "" : "rotate-180"} top-6 absolute right-6 cursor-pointer`}>
                        <Image
                            src={"https://linktree.sirv.com/Images/icons/arr.svg"}
                            alt="logo"
                            height={15}
                            onClick={() => setExpanded(!expanded)}
                            width={15}
                        />
                    </div>
                    {!expanded && <div onClick={() => setExpanded(true)} className="w-full text-center cursor-pointer">
                        <span className="font-semibold max-w-[20rem]">{currentSupportGroup.title}</span>
                    </div>}
                    <div className={`flex flex-col text-center w-full gap-5 pt-2 items-center overflow-hidden ${expanded ? "openBanner" : "closeBanner"}`}
                    >
                        <div className="h-fit aspect-square rounded-full overflow-hidden">
                            <Image src={"https://linktree.sirv.com/Images/icons/logo.gif"} alt="logo" height={60} width={60} />
                        </div>
                        <span className="font-semibold max-w-[20rem]">{currentSupportGroup.title}</span>
                        <span className="text-sm max-w-[20rem]">{currentSupportGroup.message}</span>
                        <Link
                            href={currentSupportGroup.linkTo}
                            target="_blank"
                            className="sm:max-w-[30rem] w-full p-3 bg-white text-black font-semibold rounded-2xl uppercase hover:scale-105 active:scale-95 mt-2"
                        >
                            {translations.actNow}
                        </Link>
                    </div>
                </div>
            </div>}
        </>
    );
}