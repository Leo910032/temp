"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import updateBio from "@/lib/update data/updateBio";
import updateDisplayName from "@/lib/update data/updateDisplayName";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react"; // ADD useMemo
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT

export default function TextDetails() {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [displayName, setDisplayName] = useState("");
    const [myBio, setMyBio] = useState("");
    const [dataLoaded, setDataLoaded] = useState(false);
    const [dataLoadedBio, setDataLoadedBio] = useState(false);
    const debounceDisplayName = useDebounce(displayName, 500);
    const debounceMyBio = useDebounce(myBio, 500);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profileTitle: t('dashboard.appearance.text_details.profile_title'),
            bio: t('dashboard.appearance.text_details.bio'),
        };
    }, [t, isInitialized]);

    useEffect(() => {
        function fetchInfo() {
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid);

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { displayName, bio: bioText } = docSnap.data();
                    const bio = bioText ? bioText : "";
                    setDisplayName(`${displayName}`);
                    setMyBio(bio);
                }
            });
            return unsubscribe;
        }

        const unsubscribe = fetchInfo();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser]);

    useEffect(() => {
        if (!dataLoaded) {
            setDataLoaded(true);
            return;
        }
        if (currentUser) {
            updateDisplayName(displayName, currentUser.uid);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounceDisplayName, currentUser]);

    useEffect(() => {
        if (!dataLoadedBio) {
            setDataLoadedBio(true);
            return;
        }
        if (currentUser) {
            updateBio(myBio, currentUser.uid);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounceMyBio, currentUser]);

    if (!isInitialized || !currentUser) {
        return (
            <div className="flex px-6 pb-6 pt-2 flex-col gap-2 animate-pulse">
                <div className="h-[58px] rounded-lg bg-gray-200"></div>
                <div className="h-[74px] rounded-lg bg-gray-200"></div>
            </div>
        );
    }

    return (
        <div className="flex px-6 pb-6 pt-2 flex-col gap-2">
            <div className="flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-2 border border-transparent">
                <input
                    type="text"
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-base text-sm font-semibold outline-none opacity-100 bg-transparent peer appearance-none"
                    placeholder=" "
                    onChange={(e) => setDisplayName(e.target.value)}
                    value={`${displayName}`}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    {translations.profileTitle}
                </label>
            </div>
            <div className="flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-[2px] border border-transparent">
                <textarea
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-md text-sm outline-none opacity-100 bg-transparent peer appearance-none"
                    cols="30"
                    rows="2"
                    onChange={(e) => setMyBio(e.target.value)}
                    value={myBio}
                    placeholder=" "
                ></textarea>
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    {translations.bio}
                </label>
            </div>
        </div>
    );
}