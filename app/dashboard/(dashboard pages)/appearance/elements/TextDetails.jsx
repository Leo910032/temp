"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import updateBio from "@/lib/update data/updateBio";
import updateDisplayName from "@/lib/update data/updateDisplayName";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect } from "react";
import { useState } from "react";

export default function TextDetails() {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [displayName, setDisplayName] = useState("");
    const [myBio, setMyBio] = useState("");
    const [dataLoaded, setDataLoaded] = useState(false);
    const [dataLoadedBio, setDataLoadedBio] = useState(false);
    const debounceDisplayName = useDebounce(displayName, 500);
    const debounceMyBio = useDebounce(myBio, 500);

    useEffect(() => {
        function fetchInfo() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { displayName, bio: bioText } = docSnap.data();
                    const bio = bioText ? bioText : "";
                    setDisplayName(`${displayName}`);
                    setMyBio(bio);
                }
            });

            // Return cleanup function
            return unsubscribe;
        }

        const unsubscribe = fetchInfo();
        
        // Cleanup subscription on unmount
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [currentUser]); // Depend on currentUser

    useEffect(() => {
        if (!dataLoaded) {
            setDataLoaded(true);
            return;
        }
        // Only update if user is authenticated
        if (currentUser) {
            updateDisplayName(displayName, currentUser.uid);
        }
    }, [debounceDisplayName, currentUser]);

    useEffect(() => {
        if (!dataLoadedBio) {
            setDataLoadedBio(true);
            return;
        }
        // Only update if user is authenticated
        if (currentUser) {
            updateBio(myBio, currentUser.uid);
        }
    }, [debounceMyBio, currentUser]);

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

    return (
        <div className="flex px-6 pb-6 pt-2 flex-col gap-2">
            <div className="flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-2 border border-transparent">
                <input
                    type="text"
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-base text-sm font-semibold outline-none opacity-100 bg-transparent peer appearance-none"
                    placeholder=""
                    onChange={(e) => setDisplayName(e.target.value)}
                    value={`${displayName}`}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    Profile title
                </label>
            </div>
            <div className="flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-[2px] border border-transparent">
                <textarea 
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-md text-sm outline-none opacity-100 bg-transparent peer appearance-none" 
                    cols="30" 
                    rows="2"
                    onChange={(e) => setMyBio(e.target.value)}
                    value={myBio}
                ></textarea>
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    Bio
                </label>
            </div>
        </div>
    );
}