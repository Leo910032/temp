"use client";

import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

async function updateSensitiveType(type, userId) {
    if (!userId) {
        console.error("updateSensitiveType failed: No user ID provided.");
        throw new Error("User not authenticated.");
    }
    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { sensitivetype: type }, { merge: true });
    } catch (error) {
        console.error("Error updating sensitive type:", error);
        toast.error("Could not save setting.");
        throw new Error(error.message);
    }
}

export default function AgeRestriction() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [pick, setPick] = useState(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            selectOne: t('dashboard.settings.sensitive_material.select_one'),
            age18: t('dashboard.settings.sensitive_material.age_18_plus'),
            age21: t('dashboard.settings.sensitive_material.age_21_plus'),
            age25: t('dashboard.settings.sensitive_material.age_25_plus'),
            sensitiveContent: t('dashboard.settings.sensitive_material.sensitive_content'),
        };
    }, [t, isInitialized]);

    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(fireApp, "AccountData", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setPick(docSnap.data().sensitivetype ?? 3);
            } else {
                setPick(3);
            }
            setHasLoaded(true);
        });
        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (!hasLoaded || !currentUser || pick === null) return;
        updateSensitiveType(pick, currentUser.uid);
    }, [pick, hasLoaded, currentUser]);

    if (!isInitialized || !hasLoaded) {
        return (
            <div className="my-5 grid gap-4 animate-pulse">
                <div className="h-5 w-1/3 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/4 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/4 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/4 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/2 bg-gray-200 rounded-md"></div>
            </div>
        );
    }

    return (
        <div className="my-5 grid gap-4">
            <span className="text-sm font-semibold">{translations.selectOne}</span>
            <div className="cursor-pointer flex items-center gap-3 w-fit" onClick={() => setPick(0)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 0 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.age18}</span>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(1)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 1 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.age21}</span>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(2)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 2 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.age25}</span>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => setPick(3)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 3 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.sensitiveContent}</span>
            </div>
        </div>
    );
}