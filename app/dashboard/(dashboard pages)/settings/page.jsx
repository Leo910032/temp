"use client"
import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { getSettingsData, updateSettingsData } from '@/lib/services/settingsService';

// Import components
import Controller from "./components/Controller";
import SEO from "./components/SEO";
import SensitiveMaterial from "./components/SensitiveMaterial";
import SocialSetting from "./components/SocialSetting";
import SupportBanner from "./components/SupportBanner";

export const SettingsContext = createContext(null);

export default function SettingsPage() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    const [settings, setSettings] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const debouncedSettings = useDebounce(settings, 2000);
    const isInitialLoad = useRef(true);
    const lastSavedData = useRef(null);
    const updateInProgress = useRef(false); // ✅ ADD: Prevent concurrent updates

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            saving: t('common.saving') || "Saving...",
            saved: t('common.saved') || "Settings saved!",
            error: t('common.error') || "Failed to save settings.",
            loadingError: t('common.loading_error') || "Failed to load settings"
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Better data fetching with proper initialization
    const fetchSettingsData = useCallback(async () => {
        if (!currentUser || updateInProgress.current) return;
        
        setIsLoading(true);
        try {
            const data = await getSettingsData();
            
            // ✅ FIXED: Ensure all fields have proper defaults
            const normalizedData = {
                socials: data.socials || [],
                socialPosition: data.socialPosition ?? 0,
                supportBanner: data.supportBanner ?? 0,
                supportBannerStatus: data.supportBannerStatus ?? false,
                sensitiveStatus: data.sensitiveStatus ?? false,
                sensitivetype: data.sensitivetype ?? 3,
                metaData: data.metaData || { title: '', description: '' },
            };
            
            setSettings(normalizedData);
            lastSavedData.current = JSON.stringify(normalizedData);
            console.log('✅ Settings data loaded from server:', normalizedData);
        } catch (error) {
            console.error('Failed to fetch settings data:', error);
            toast.error(translations.loadingError);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, translations.loadingError]);

    // Load data on mount
    useEffect(() => {
        if (currentUser && isInitialized) {
            fetchSettingsData();
        }
    }, [currentUser, isInitialized, fetchSettingsData]);

    // ✅ IMPROVED: Better save logic with concurrency control
    const saveSettings = useCallback(async (dataToSave) => {
        if (!currentUser || !dataToSave || updateInProgress.current) return;
        
        // Check if data actually changed
        const currentDataString = JSON.stringify(dataToSave);
        if (currentDataString === lastSavedData.current) {
            console.log('🔄 No changes detected, skipping save');
            return;
        }
        
        updateInProgress.current = true;
        setIsSaving(true);
        
        try {
            console.log('💾 Saving settings data...', dataToSave);
            
            // Use the bulk update function
            const result = await updateSettingsData(dataToSave);
            
            // Update the last saved data reference
            lastSavedData.current = currentDataString;
            
            toast.success(translations.saved);
            console.log('✅ Settings saved:', result.updatedFields);
            
        } catch (error) {
            console.error('❌ Save settings error:', error);
            toast.error(error.message || translations.error);
            
            // ✅ FIXED: Reload data on error to sync state
            await fetchSettingsData();
        } finally {
            setIsSaving(false);
            updateInProgress.current = false;
        }
    }, [currentUser, translations.error, translations.saved, fetchSettingsData]);

    // Handle debounced saves
    useEffect(() => {
        // Guard against saving on initial render
        if (debouncedSettings === null || isInitialLoad.current) {
            if (settings !== null) {
                isInitialLoad.current = false;
            }
            return;
        }
        
        saveSettings(debouncedSettings);
    }, [debouncedSettings, saveSettings, settings]);

    // ✅ IMPROVED: Better update function with duplicate prevention
    const updateSettings = useCallback((fieldOrData, value) => {
        if (updateInProgress.current) {
            console.log('🔄 Update in progress, skipping:', fieldOrData);
            return;
        }
        
        setSettings(prev => {
            if (!prev) return prev;
            
            let newSettings;
            if (typeof fieldOrData === 'object') {
                // Check if the object actually contains changes
                const hasChanges = Object.keys(fieldOrData).some(key => 
                    JSON.stringify(prev[key]) !== JSON.stringify(fieldOrData[key])
                );
                
                if (!hasChanges) {
                    console.log('🔄 No actual changes in object update, skipping');
                    return prev;
                }
                
                newSettings = { ...prev, ...fieldOrData };
            } else {
                // Check if the field value actually changed
                if (JSON.stringify(prev[fieldOrData]) === JSON.stringify(value)) {
                    console.log('🔄 No change for field:', fieldOrData, 'skipping');
                    return prev;
                }
                
                newSettings = { ...prev, [fieldOrData]: value };
            }
            
            console.log('🔄 Settings updated:', fieldOrData, 'New value:', typeof fieldOrData === 'object' ? fieldOrData : value);
            return newSettings;
        });
    }, []);

    const contextValue = useMemo(() => ({
        settings,
        updateSettings,
        isSaving,
        isLoading,
        refreshData: fetchSettingsData
    }), [settings, updateSettings, isSaving, isLoading, fetchSettingsData]);

    // Loading state
    if (!isInitialized || isLoading || !settings) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto scroll-smooth">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">Loading settings...</div>
                </div>
            </div>
        );
    }

    return (
        <SettingsContext.Provider value={contextValue}>
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto scroll-smooth">
                {/* ✅ IMPROVED: Better save indicator */}
                {isSaving && (
                    <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {translations.saving}
                    </div>
                )}
                
                <Controller />
                <SocialSetting />
                <SupportBanner />
                <SensitiveMaterial />
                <SEO />
            </div>
        </SettingsContext.Provider>
    );
}