"use client"
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateTheme, updateThemeTextColour } from "@/lib/update data/updateTheme";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useState } from "react";
import { FaCheck } from "react-icons/fa6";

export default function ThemeCard({ type, pic, text }) {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [isSelectedTheme, setIsSelectedTheme] = useState(false);
    const [themeColor, setThemeColor] = useState("");

    const specialThemes = ["New Mario", "Matrix"];

    const handleUpdateTheme = async() => {
        // Only update if user is authenticated
        if (!currentUser) return;
        
        await updateTheme(text ? text : "Custom", themeColor, currentUser.uid);
        if(!specialThemes.includes(text)) return;
        await updateThemeTextColour(themeColor, currentUser.uid);
    }

    useEffect(() => {
        if(!isSelectedTheme) return;
        switch (text) {
            case 'Lake Black':
                setThemeColor("#fff");
                break;
            case 'Starry Night':
                setThemeColor("#fff");
                break;
            case '3D Blocks':
                setThemeColor("#fff");
                break;
            case 'Matrix':
                setThemeColor("#0f0");
                break;
            case 'New Mario':
                setThemeColor("#000");
                break;
        
            default:
                setThemeColor("#000");
                break;
        }
    }, [text, isSelectedTheme]);
    
    useEffect(() => {
        function fetchTheme() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID
        
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { selectedTheme } = docSnap.data();
                    setIsSelectedTheme(selectedTheme === text);
                }
            }, (error) => {
                console.error("Error fetching theme:", error);
            });

            // Return cleanup function
            return unsubscribe;
        }
        
        const unsubscribe = fetchTheme();
        
        // Cleanup subscription on unmount or when currentUser changes
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [text, currentUser]); // Depend on currentUser

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

    return (
        <>
            <div className={`min-w-[8rem] flex-1 items-center flex flex-col group`} onClick={handleUpdateTheme}>
                {type !== 1 ?
                    <>
                        <div className="w-full h-[13rem] border border-dashed rounded-lg relative group-hover:bg-black group-hover:bg-opacity-[0.05] border-black grid place-items-center cursor-pointer">
                            <span className="uppercase max-w-[5rem] sm:text-xl text-base text-center">
                                Create Your Own
                            </span>
                            {isSelectedTheme && <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-[0.5] grid place-items-center z-10 text-white text-xl">
                                <FaCheck />
                            </div>}
                        </div>
                        <span className="py-3 text-sm">Custom</span>
                    </>
                    :
                    <>
                        <div className="w-full h-[13rem] border rounded-lg group-hover:scale-105 relative group-active:scale-90 grid place-items-center cursor-pointer overflow-hidden">
                            <Image src={pic} alt="bg-image" height={1000} width={1000} className="min-w-full h-full object-cover" />
                            {isSelectedTheme && <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-[0.5] grid place-items-center z-10 text-white text-xl">
                                <FaCheck />
                            </div>}
                        </div>
                        <span className="py-3 text-sm">{text}</span>
                    </>
                }
            </div>
        </>
    );
}