"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateThemeBackgroundColor, updateThemeBtnColor, updateThemeBtnFontColor, updateThemeBtnShadowColor, updateThemeTextColour } from "@/lib/update data/updateTheme";
import { isValidHexCode } from "@/lib/utilities";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

export default function ColorPicker({colorFor}) {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [colorText, setColorText] = useState(colorFor === 4 ? "#000000" : "#e8edf5");
    const debounceColor = useDebounce(colorText, 500);
    const [validColor, setValidColor] = useState(1);
    const [colorHasLoaded, setColorHasLoaded] = useState(false);
    const colorPickRef = useRef();

    const handleUpdateTheme = async(text) => {
        // Only update if user is authenticated
        if (!currentUser) return;

        switch (colorFor) {
            case 0:
                await updateThemeBackgroundColor(text, currentUser.uid);
                break;
            case 1:
                await updateThemeBtnColor(text, currentUser.uid);
                break;
            case 2:
                await updateThemeBtnFontColor(text, currentUser.uid);
                break;
            case 3:
                await updateThemeBtnShadowColor(text, currentUser.uid);
                break;
            case 4:
                await updateThemeTextColour(text, currentUser.uid);
                break;
        
            default:
                await updateThemeBackgroundColor(text, currentUser.uid);
                break;
        }
    }
  
    useEffect(() => {
        if (!colorHasLoaded) {
            setColorHasLoaded(true);
            return;
        }

        if (colorText !== "") {
            setValidColor(isValidHexCode(colorText));
            if (!isValidHexCode(colorText)) {
                return;
            }
    
            handleUpdateTheme(colorText);
        }
    }, [debounceColor, currentUser]);

    useEffect(() => {
        if (!validColor || !currentUser) {
            return;
        }

        handleUpdateTheme(colorText);
    }, [validColor, currentUser]);

    useEffect(() => {
        function fetchTheme() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID
        
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { backgroundColor, btnShadowColor, btnFontColor, btnColor, themeTextColour } = docSnap.data();
                    switch (colorFor) {
                        case 0:
                            setColorText(backgroundColor ? backgroundColor : "#e8edf5");
                            break;
                        case 1:
                            setColorText(btnColor ? btnColor : "#e8edf5");
                            break;
                        case 2:
                            setColorText(btnFontColor ? btnFontColor : "#e8edf5");
                            break;
                        case 3:
                            setColorText(btnShadowColor ? btnShadowColor : "#e8edf5");
                            break;
                        case 4:
                            setColorText(themeTextColour ? themeTextColour : "#000000");
                            break;
                    
                        default:
                            setColorText(backgroundColor ? backgroundColor : "#e8edf5");
                            break;
                    }
                }
            });

            // Return cleanup function
            return unsubscribe;
        }
        
        const unsubscribe = fetchTheme();
        
        // Cleanup on unmount or when currentUser changes
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [colorFor, currentUser]);

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }
    
    return (
        <div className="pt-6 flex items-center">
            <input 
                type="color" 
                className="relative h-0 w-0 overflow-hidden"
                value={colorText}
                ref={colorPickRef}
                onChange={(e) => setColorText(e.target.value)} 
            />
            <div className="h-12 w-12 mr-4 rounded-lg cursor-pointer hover:scale-[1.05] active:scale-90" style={{ background: `${colorText}` }} onClick={()=>colorPickRef.current.click()}></div>
            <div className={`w-auto relative pt-2 flex items-center hover:border rounded-lg bg-black bg-opacity-[0.05] ${validColor ? "focus-within:border-black border-transparent": "border-red-500" } focus-within:border-2 border`}>
                <input 
                    type="text"
                    className="sm:flex-1 sm:w-auto w-[200px] px-4 placeholder-shown:px-3 py-2 text-base font-semibold outline-none opacity-100 bg-transparent peer appearance-none"
                    placeholder=" "
                    value={colorText}
                    onChange={(e) => setColorText(e.target.value)}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-xs text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:pt-2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    Colour
                </label>
            </div>
        </div>
    )
}