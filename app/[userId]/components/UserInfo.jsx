"use client"
import { fireApp } from "@/important/firebase";
import { filterProperly } from "@/lib/utilities";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect } from "react";
import { useState } from "react";

export default function UserInfo({ userId, hasSensitiveContent }) {
    const [displayName, setDisplayName] = useState("");
    const [themeFontColor, setThemeFontColor] = useState("");
    const [themeTextColour, setThemeTextColour] = useState("");
    const [myBio, setMyBio] = useState("");

    useEffect(() => {
        function fetchInfo() {
            // userId is now the actual Firebase Auth UID
            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, userId);

            const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
                if (!docSnapshot.exists()) {
                    return;
                }
                const { displayName, bio: bioText, themeFontColor, themeTextColour } = docSnapshot.data();
                const bio = bioText ? bioText : "";
                setThemeTextColour(themeTextColour ? themeTextColour : "");
                setDisplayName(hasSensitiveContent ? displayName : filterProperly(`${displayName ? displayName : ""}`));
                setThemeFontColor(themeFontColor ? themeFontColor : "");
                setMyBio(hasSensitiveContent ? bio : filterProperly(bio));
            }, (error) => {
                console.error("Error fetching user info:", error);
            });

            return unsubscribe;
        }

        if (userId) {
            const unsubscribe = fetchInfo();
            
            return () => {
                if (unsubscribe && typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            };
        }
    }, [userId, hasSensitiveContent]);

    return (
        <>
            {String(displayName).length > 0 && <span style={{color: `${themeFontColor === "#000" ? themeTextColour: themeFontColor}`}} className="font-semibold text-lg py-2">{displayName.split(" ").length > 1 ? displayName : `@${displayName}`}</span>}
            {String(myBio).length > 0 && <span style={{color: `${themeFontColor === "#000" ? themeTextColour: themeFontColor}`}} className="opacity-80 text-center text-base max-w-[85%]">{myBio}</span>}
        </>
    )
}