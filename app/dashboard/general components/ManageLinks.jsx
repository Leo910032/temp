"use client"

import React, { useEffect, useState, useMemo, useCallback, createContext, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { generateRandomId } from "@/lib/utilities";
import { toast } from "react-hot-toast";
import AddBtn from "../general elements/addBtn";
import DraggableList from "./Drag";
import { isEqual } from 'lodash'; // <-- Import isEqual for deep comparison

// Create context to pass state down to child components
export const ManageLinksContent = createContext(null);

export default function ManageLinks() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    // --- State Management ---
    const [data, setData] = useState([]); // Live data state for the UI
    const [isSaving, setIsSaving] = useState(false); // For showing a "Saving..." indicator
    
    // --- Refs for Lifecycle Management (to prevent race conditions) ---
    const isMounted = useRef(false);      // Becomes true after the first data fetch
    const initialDataSnapshot = useRef(null); // Stores the first data fetched from Firestore

    // Debounce state changes to group multiple quick edits into a single save operation
    const debouncedData = useDebounce(data, 1500);

    // Memoize translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addHeader: t('dashboard.links.add_header'),
            emptyStateTitle: t('dashboard.links.empty_state.title'),
            emptyStateSubtitle: t('dashboard.links.empty_state.subtitle'),
            linksSaved: t('dashboard.links.saved_success') || "Links saved!",
            savingError: t('dashboard.links.saved_error') || "Could not save links."
        };
    }, [t, isInitialized]);

    // --- User Actions ---
    const addLinkItem = () => {
        const newLink = { id: generateRandomId(), title: "", url: "", urlKind: "", isActive: true, type: 1 };
        setData(prevData => [newLink, ...prevData]);
    };
    const addHeaderItem = () => {
        const newHeader = { id: generateRandomId(), title: "", isActive: true, type: 0 };
        setData(prevData => [newHeader, ...prevData]);
    };
    
    // --- API Call to Save Data ---
    const saveLinksToServer = useCallback(async (linksToSave) => {
        if (!currentUser) return;
        
        setIsSaving(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/user/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ links: linksToSave })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || translations.savingError);
            }

            toast.success(translations.linksSaved);
        } catch (error) {
            console.error("Error saving links:", error);
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.linksSaved, translations.savingError]);

    // --- Effect for FETCHING initial data ---
    useEffect(() => {
        if (!currentUser) {
            setData([]);
            isMounted.current = false;
            initialDataSnapshot.current = null;
            return;
        }

        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            const fetchedLinks = docSnap.exists() ? docSnap.data().links || [] : [];
            setData(fetchedLinks);
            
            // Only set the initial data snapshot ONCE when the component first mounts.
            if (isMounted.current === false) {
                initialDataSnapshot.current = fetchedLinks;
                isMounted.current = true;
            }
        }, (error) => {
            console.error("Error fetching links:", error);
            isMounted.current = true; // Still mark as mounted even on error
        });

        return () => unsubscribe();
    }, [currentUser]);

    // --- Effect for SAVING data (Robust Logic) ---
    useEffect(() => {
        // Guard 1: Don't run this effect until the component has mounted and fetched initial data.
        if (!isMounted.current) {
            return;
        }

        // Guard 2: Compare the current debounced data with the initial data snapshot.
        // If they are identical, it means no meaningful change has been made by the user yet.
        if (isEqual(debouncedData, initialDataSnapshot.current)) {
            return;
        }

        // If we pass the guards, it's a real user change that needs to be saved.
        saveLinksToServer(debouncedData);
        
    }, [debouncedData, saveLinksToServer]);


    // --- Render Logic ---
    if (!isInitialized) {
        // ... Return your loading skeleton component/JSX ...
        return (
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1">
                <div className="h-12 bg-gray-200 rounded-3xl animate-pulse"></div>
                <div className="h-10 w-32 bg-gray-200 rounded-3xl animate-pulse mx-auto mt-3"></div>
            </div>
        );
    }

    return (
        <ManageLinksContent.Provider value={{ setData, data }}>
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1">
                <AddBtn onAddItem={addLinkItem} />
                <div className="flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 hover:scale-[1.005] border hover:bg-black/5 w-fit text-sm p-3 mt-3" onClick={addHeaderItem}>
                    <Image src={"https://linktree.sirv.com/Images/icons/add.svg"} alt="add header" height={15} width={15} />
                    <span>{translations.addHeader}</span>
                </div>
                
                {isSaving && (
                    <div className="text-center text-sm text-gray-500 animate-pulse">Saving...</div>
                )}

                {!isMounted.current && (
                    <div className="text-center text-gray-500 py-10">Loading...</div>
                )}
                
                {isMounted.current && data.length > 0 && <DraggableList array={data} />}

                {isMounted.current && data.length === 0 && (
                    <div className="p-6 flex-col gap-4 flex items-center justify-center opacity-30">
                        <Image src={"https://linktree.sirv.com/Images/logo-icon.svg"} alt="logo" height={100} width={100} className="opacity-50 sm:w-24 w-16" />
                        <span className="text-center sm:text-base text-sm max-w-[15rem] font-semibold">{translations.emptyStateTitle}</span>
                        <span className="text-center sm:text-base text-sm max-w-[15rem] opacity-70">{translations.emptyStateSubtitle}</span>
                    </div>
                )}
            </div>
        </ManageLinksContent.Provider>
    );
}