"use client"
import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { fireApp } from '@/important/firebase';

// Import all the child components for this page
import ProfileCard from './components/ProfileCard';
import Themes from './components/Themes';
import Backgrounds from './components/Backgrounds';
import Buttons from './components/Buttons';
import FontsOptions from './components/FontsOptions';
import ChristmasAccessories from './components/ChristmasAccessories';

export const AppearanceContext = createContext(null);

export default function AppearancePage() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    const [appearance, setAppearance] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const debouncedAppearance = useDebounce(appearance, 2000);
    const isInitialLoad = useRef(true);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profile: t('dashboard.appearance.headings.profile'),
            themes: t('dashboard.appearance.headings.themes'),
            customAppearance: t('dashboard.appearance.headings.custom_appearance'),
            customAppearanceDesc: t('dashboard.appearance.custom_appearance_description'),
            backgrounds: t('dashboard.appearance.headings.backgrounds'),
            christmas: t('dashboard.appearance.headings.christmas'),
            buttons: t('dashboard.appearance.headings.buttons'),
            fonts: t('dashboard.appearance.headings.fonts'),
            newBadge: t('dashboard.appearance.new_badge'),
            saving: t('common.saving') || "Saving...",
            saved: t('common.saved') || "Appearance saved!",
            error: t('common.error') || "Failed to save settings."
        };
    }, [t, isInitialized]);

    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setAppearance(docSnap.data());
            }
        });
        return () => unsubscribe();
    }, [currentUser]);

    const saveAppearance = useCallback(async (dataToSave) => {
        if (!currentUser || !dataToSave) return;
        
        const { links, socials, createdAt, email, uid, username, lastLogin, ...appearanceData } = dataToSave;
        
        setIsSaving(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/user/appearance/theme', {
                // ✅ --- THE FIX IS HERE --- ✅
                method: 'POST', // Changed from 'PUT' to 'POST'
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(appearanceData)
            });

            // This part is crucial for debugging. Let's check the response before parsing.
            if (!response.ok) {
                // Try to get error text, but have a fallback.
                let errorMsg = 'Failed to save appearance';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (jsonError) {
                    // This happens if the server returns non-JSON, like an HTML error page.
                    console.error("Could not parse error JSON:", jsonError);
                    errorMsg = `${response.status} ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            toast.success(translations.saved);
            console.log('Appearance saved:', result.updatedFields);
            
        } catch (error) {
            console.error('Save appearance error:', error);
            toast.error(error.message || translations.error);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.error, translations.saved]);

    useEffect(() => {
        // Guard against saving on initial render
        if (debouncedAppearance === null || isInitialLoad.current) {
            if (appearance !== null) { // Once appearance is loaded, we can flip the flag
                isInitialLoad.current = false;
            }
            return;
        }
        saveAppearance(debouncedAppearance);
    }, [debouncedAppearance, saveAppearance, appearance]); // Added `appearance` to deps to help with initial load logic

    const updateAppearance = useCallback((fieldOrData, value) => {
        setAppearance(prev => {
            if (typeof fieldOrData === 'object') {
                return { ...prev, ...fieldOrData };
            }
            return { ...prev, [fieldOrData]: value };
        });
    }, []);

    const contextValue = useMemo(() => ({
        appearance,
        updateAppearance,
        isSaving
    }), [appearance, updateAppearance, isSaving]);

    if (!isInitialized || !appearance) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center text-gray-500">
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <AppearanceContext.Provider value={contextValue}>
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pr-2">
                {isSaving && (
                    <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse z-50">
                        {translations.saving}
                    </div>
                )}
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.profile}</h2>
                    <ProfileCard />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.themes}</h2>
                    <Themes />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.customAppearance}</h2>
                    <p className="py-3 sm:text-base text-sm text-gray-600">
                        {translations.customAppearanceDesc}
                    </p>
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.backgrounds}</h2>
                    <Backgrounds />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">
                        {translations.christmas} 
                        <span className="py-1 px-3 rounded bg-green-500 text-white font-medium text-sm ml-2">
                            {translations.newBadge}
                        </span>
                    </h2>
                    <ChristmasAccessories />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.buttons}</h2>
                    <Buttons />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.fonts}</h2>
                    <FontsOptions />
                </div>
            </div>
        </AppearanceContext.Provider>
    );
}