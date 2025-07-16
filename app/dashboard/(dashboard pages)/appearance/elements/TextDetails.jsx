// app/dashboard/(dashboard pages)/appearance/elements/TextDetails.jsx - SERVER-SIDE VERSION
"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { updateDisplayName, updateBio, getAppearanceData } from "@/lib/services/appearanceService";
import { useEffect, useState, useMemo, useRef } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from "react-hot-toast";

export default function TextDetails() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [displayName, setDisplayName] = useState("");
    const [myBio, setMyBio] = useState("");
    const [dataLoaded, setDataLoaded] = useState(false);
    const [dataLoadedBio, setDataLoadedBio] = useState(false);
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const [isUpdatingBio, setIsUpdatingBio] = useState(false);
    
    const debounceDisplayName = useDebounce(displayName, 1000); // Increased for server calls
    const debounceMyBio = useDebounce(myBio, 1000);
    
    const isInitialLoad = useRef(true);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profileTitle: t('dashboard.appearance.text_details.profile_title') || 'Profile Title',
            bio: t('dashboard.appearance.text_details.bio') || 'Bio',
            errorTooLong: t('dashboard.appearance.text_details.error_too_long') || 'Text too long',
            errorUpdateFailed: t('dashboard.appearance.text_details.error_update_failed') || 'Update failed',
        };
    }, [t, isInitialized]);

    // Fetch initial data
    const fetchInitialData = async () => {
        if (!currentUser) return;
        
        try {
            const data = await getAppearanceData();
            setDisplayName(data.displayName || '');
            setMyBio(data.bio || '');
        } catch (error) {
            console.error("Failed to fetch profile data:", error);
        }
    };

    // Handle display name updates
    const handleDisplayNameUpdate = async (name) => {
        if (!currentUser || isUpdatingName) return;
        
        // Client-side validation
        if (name.length > 100) {
            toast.error(translations.errorTooLong + ' (max 100 characters)');
            return;
        }

        setIsUpdatingName(true);
        try {
            await updateDisplayName(name);
            // Success is silent for text updates to avoid spam
        } catch (error) {
            console.error("Failed to update display name:", error);
            toast.error(error.message || translations.errorUpdateFailed);
            // Revert on error
            await fetchInitialData();
        } finally {
            setIsUpdatingName(false);
        }
    };

    // Handle bio updates
    const handleBioUpdate = async (bio) => {
        if (!currentUser || isUpdatingBio) return;
        
        // Client-side validation
        if (bio.length > 500) {
            toast.error(translations.errorTooLong + ' (max 500 characters)');
            return;
        }

        setIsUpdatingBio(true);
        try {
            await updateBio(bio);
            // Success is silent for text updates to avoid spam
        } catch (error) {
            console.error("Failed to update bio:", error);
            toast.error(error.message || translations.errorUpdateFailed);
            // Revert on error
            await fetchInitialData();
        } finally {
            setIsUpdatingBio(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        if (currentUser && !dataLoaded) {
            fetchInitialData();
            setDataLoaded(true);
        }
    }, [currentUser]);

    // Handle debounced display name updates
    useEffect(() => {
        if (!dataLoaded || isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }
        
        if (displayName !== undefined && displayName !== null) {
            handleDisplayNameUpdate(displayName);
        }
    }, [debounceDisplayName, currentUser]);

    // Handle debounced bio updates
    useEffect(() => {
        if (!dataLoadedBio || isInitialLoad.current) {
            setDataLoadedBio(true);
            return;
        }
        
        if (myBio !== undefined && myBio !== null) {
            handleBioUpdate(myBio);
        }
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
            {/* Display Name Input */}
            <div className={`flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-2 border border-transparent ${
                isUpdatingName ? 'opacity-75' : ''
            }`}>
                <input
                    type="text"
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-base text-sm font-semibold outline-none opacity-100 bg-transparent peer appearance-none"
                    placeholder=" "
                    onChange={(e) => setDisplayName(e.target.value)}
                    value={displayName}
                    maxLength={100}
                    disabled={isUpdatingName}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    {translations.profileTitle}
                </label>
                
                {/* Loading indicator for display name */}
                {isUpdatingName && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                )}
                
                {/* Character counter */}
                <div className="absolute right-3 bottom-1 text-xs text-gray-500">
                    {displayName.length}/100
                </div>
            </div>

            {/* Bio Textarea */}
            <div className={`flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-[2px] border border-transparent ${
                isUpdatingBio ? 'opacity-75' : ''
            }`}>
                <textarea
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-md text-sm outline-none opacity-100 bg-transparent peer appearance-none resize-none"
                    cols="30"
                    rows="2"
                    onChange={(e) => setMyBio(e.target.value)}
                    value={myBio}
                    placeholder=" "
                    maxLength={500}
                    disabled={isUpdatingBio}
                ></textarea>
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    {translations.bio}
                </label>
                
                {/* Loading indicator for bio */}
                {isUpdatingBio && (
                    <div className="absolute right-3 top-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                )}
                
                {/* Character counter */}
                <div className="absolute right-3 bottom-1 text-xs text-gray-500">
                    {myBio.length}/500
                </div>
            </div>
        </div>
    );
}