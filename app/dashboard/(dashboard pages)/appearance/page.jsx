"use client"
import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { updateAppearanceData, getAppearanceData } from '@/lib/services/appearanceService';

// Import all the child components for this page
import ProfileCard from './components/ProfileCard';
import Themes from './components/Themes';
import Backgrounds from './components/Backgrounds';
import Buttons from './components/Buttons';
import FontsOptions from './components/FontsOptions';
import ChristmasAccessories from './components/ChristmasAccessories';

export const AppearanceContext = createContext(null);

// ✅ GLOBAL STATE: Store appearance data outside component to persist across navigations
let globalAppearanceCache = null;
let globalDataFetched = false;

export default function AppearancePage() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    const [appearance, setAppearance] = useState(globalAppearanceCache);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(!globalDataFetched);
    const [hasLoadError, setHasLoadError] = useState(false);
    const debouncedAppearance = useDebounce(appearance, 2000);
    const isInitialLoad = useRef(!globalDataFetched);
    const lastSavedData = useRef(null);
    const retryCount = useRef(0);
    const maxRetries = useRef(3);

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
            error: t('common.error') || "Failed to save settings.",
            loadingError: t('common.loading_error') || "Failed to load appearance data"
        };
    }, [t, isInitialized]);

    // ✅ PERSISTENT DATA FETCH: Only fetch once and cache globally
    const fetchAppearanceData = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        
        // If we have cached data and not forcing refresh, use cache
        if (globalAppearanceCache && !forceRefresh) {
            console.log('📋 Using cached appearance data');
            setAppearance(globalAppearanceCache);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        setHasLoadError(false);
        
        try {
            console.log('📥 Fetching fresh appearance data from server...');
            const data = await getAppearanceData();
            
            // ✅ CACHE GLOBALLY: Store data globally so it persists across navigations
            globalAppearanceCache = data;
            globalDataFetched = true;
            
            setAppearance(data);
            lastSavedData.current = JSON.stringify(data);
            retryCount.current = 0;
            
            console.log('✅ Appearance data loaded and cached');
            
        } catch (error) {
            console.error('❌ Failed to fetch appearance data:', error);
            setHasLoadError(true);
            
            if (error.message.includes('quota-exceeded')) {
                if (retryCount.current < maxRetries.current) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
                    retryCount.current++;
                    
                    setTimeout(() => {
                        fetchAppearanceData(true);
                    }, delay);
                }
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // ✅ LOAD DATA: Only on first mount or when user changes
    useEffect(() => {
        if (currentUser && isInitialized) {
            // If we don't have cached data, fetch it
            if (!globalAppearanceCache) {
                console.log('🚀 Component mounted, fetching data...');
                fetchAppearanceData();
            } else {
                // Use cached data immediately
                console.log('⚡ Component mounted, using cached data');
                setAppearance(globalAppearanceCache);
                setIsLoading(false);
            }
        }
        
        // Reset cache when user changes
        if (!currentUser) {
            console.log('👋 User logged out, clearing cache');
            globalAppearanceCache = null;
            globalDataFetched = false;
            setAppearance(null);
            setIsLoading(false);
            isInitialLoad.current = true;
        }
    }, [currentUser, isInitialized]);

    // ✅ SAVE LOGIC: Update cache when saving
    const saveAppearance = useCallback(async (dataToSave) => {
        if (!currentUser || !dataToSave || isSaving) return;
        
        const { 
            links, socials, createdAt, email, uid, username, lastLogin, 
            emailVerified, onboardingCompleted, isTestUser, testUserIndex,
            sensitiveStatus, sensitivetype, supportBannerStatus, supportBanner,
            metaData, socialPosition,
            ...appearanceData 
        } = dataToSave;
        
        // Remove any undefined keys that are causing issues
        const cleanedData = {};
        Object.keys(appearanceData).forEach(key => {
            if (key !== 'undefined' && appearanceData[key] !== undefined) {
                cleanedData[key] = appearanceData[key];
            }
        });
        
        const currentDataString = JSON.stringify(cleanedData);
        if (currentDataString === lastSavedData.current) {
            console.log('🔄 No changes detected, skipping save');
            return;
        }
        
        setIsSaving(true);
        console.log('💾 Saving appearance data...', Object.keys(cleanedData));
        
        try {
            const result = await updateAppearanceData(cleanedData);
            
            // ✅ UPDATE CACHE: Keep cache in sync with saved data
            globalAppearanceCache = { ...globalAppearanceCache, ...cleanedData };
            lastSavedData.current = currentDataString;
            
            toast.success(translations.saved, { 
                duration: 2000,
                icon: '✅',
                position: 'bottom-right'
            });
            
            console.log('✅ Appearance saved:', Object.keys(cleanedData));
            
        } catch (error) {
            console.error('❌ Save error:', error);
            toast.error(error.message || translations.error);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.saved, translations.error]);

    // Handle debounced saves
    useEffect(() => {
        if (debouncedAppearance === null || isInitialLoad.current) {
            if (appearance !== null) {
                isInitialLoad.current = false;
                console.log('🎯 Initial data load complete, enabling auto-save');
            }
            return;
        }
        
        console.log('⏰ Debounced save triggered');
        saveAppearance(debouncedAppearance);
    }, [debouncedAppearance, saveAppearance, appearance]);

    // ✅ UPDATE FUNCTION: Update both local state and cache
    const updateAppearance = useCallback((fieldOrData, value) => {
        setAppearance(prev => {
            if (!prev) return prev;
            
            let newAppearance;
            if (typeof fieldOrData === 'object') {
                newAppearance = { ...prev, ...fieldOrData };
                console.log('🔄 Appearance bulk update:', Object.keys(fieldOrData));
            } else {
                // Skip undefined fields
                if (fieldOrData === 'undefined' || fieldOrData === undefined) {
                    console.warn('⚠️ Attempted to update undefined field, skipping');
                    return prev;
                }
                newAppearance = { ...prev, [fieldOrData]: value };
                console.log('🔄 Appearance field updated:', fieldOrData, '→', value);
            }
            
            // ✅ UPDATE CACHE: Keep global cache in sync
            globalAppearanceCache = newAppearance;
            
            return newAppearance;
        });
    }, []);

    const contextValue = useMemo(() => ({
        appearance,
        updateAppearance,
        isSaving,
        isLoading,
        hasLoadError,
        refreshData: () => fetchAppearanceData(true),
        isDataLoaded: !!appearance && !isLoading
    }), [appearance, updateAppearance, isSaving, isLoading, hasLoadError, fetchAppearanceData]);

    if (!isInitialized) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-pulse">Loading translations...</div>
                </div>
            </div>
        );
    }

    if (isLoading && !appearance) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">Loading appearance settings...</div>
                </div>
            </div>
        );
    }

    if (!appearance && hasLoadError) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="text-red-500 mb-4">Failed to load appearance settings</div>
                    <button 
                        onClick={() => fetchAppearanceData(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <AppearanceContext.Provider value={contextValue}>
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pr-2">
                {isSaving && (
                    <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="font-medium">{translations.saving}</span>
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