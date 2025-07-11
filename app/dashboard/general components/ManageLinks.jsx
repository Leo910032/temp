"use client"

import Image from "next/image";
import AddBtn from "../general elements/addBtn";
import DraggableList from "./Drag";
import React, { useEffect, useState, useMemo } from "react"; // ADD useMemo
import { generateRandomId } from "@/lib/utilities";
import { updateLinks } from "@/lib/update data/updateLinks";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

export const ManageLinksContent = React.createContext();

export default function ManageLinks() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const [data, setData] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addHeader: t('dashboard.links.add_header'),
            emptyStateTitle: t('dashboard.links.empty_state.title'),
            emptyStateSubtitle: t('dashboard.links.empty_state.subtitle')
        };
    }, [t, isInitialized]);

    const addItem = () => {
        const newItem = { id: `${generateRandomId()}`, title: "", isActive: true, type: 0 };
        setData(prevData => {
            return [newItem, ...prevData];
        });
    };
    
    // This useEffect handles SAVING data
    useEffect(() => {
        // Prevent running on initial load
        if (!hasLoaded) {
            return;
        }
        
        // Only update if a user is logged in
        if (currentUser) {
            // Pass the user's UID to the updated updateLinks function
            updateLinks(data, currentUser.uid);
        }
    }, [data, hasLoaded, currentUser]);

    // This useEffect handles FETCHING data
    useEffect(() => {
        // Don't try to fetch data if there's no user
        if (!currentUser) {
            setData([]); // Clear data on logout
            return;
        }

        const collectionRef = collection(fireApp, "AccountData");
        // Use the Firebase Auth UID to get the correct document
        const docRef = doc(collectionRef, currentUser.uid);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { links } = docSnap.data();
                setData(links ? links : []);
            } else {
                // If the document doesn't exist, start with an empty array
                setData([]);
            }
            setHasLoaded(true);
        }, (error) => {
            console.error("Error fetching links:", error);
            setData([]); // Set to empty on error
            setHasLoaded(true);
        });

        // Return the unsubscribe function for cleanup when the component unmounts or user changes
        return () => unsubscribe();
        
    }, [currentUser]);

    // WAIT FOR TRANSLATIONS TO LOAD
    if (!isInitialized) {
        return (
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1 transition-[min-height]">
                {/* Loading skeleton */}
                <div className="h-12 bg-gray-200 rounded-3xl animate-pulse"></div>
                <div className="h-10 w-32 bg-gray-200 rounded-3xl animate-pulse mx-auto"></div>
                <div className="p-6 flex-col gap-4 flex items-center justify-center opacity-30">
                    <div className="h-16 w-16 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <ManageLinksContent.Provider value={{ setData, data }}>
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1 transition-[min-height]">
                <AddBtn />

                <div className={`flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] border hover:bg-black hover:bg-opacity-[0.05] w-fit text-sm p-3 mt-3`} onClick={addItem}>
                    <>
                        <Image src={"https://linktree.sirv.com/Images/icons/add.svg"} alt="links" height={15} width={15} />
                        <span>{translations.addHeader}</span>
                    </>
                </div>

                {data.length === 0 && (
                    <div className="p-6 flex-col gap-4 flex items-center justify-center opacity-30">
                        <Image
                            src={"https://linktree.sirv.com/Images/logo-icon.svg"}
                            alt="logo"
                            height={100}
                            width={100}
                            className="opacity-50 sm:w-24 w-16"
                        />
                        <span className="text-center sm:text-base text-sm max-w-[15rem] font-semibold">
                            {translations.emptyStateTitle}
                        </span>
                        <span className="text-center sm:text-base text-sm max-w-[15rem] opacity-70">
                            {translations.emptyStateSubtitle}
                        </span>
                    </div>
                )}

                {data.length > 0 && <DraggableList array={data} />}
            </div>
        </ManageLinksContent.Provider>
    );
}