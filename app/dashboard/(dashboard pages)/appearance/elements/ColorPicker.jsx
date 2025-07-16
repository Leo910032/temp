// app/dashboard/(dashboard pages)/appearance/elements/ColorPicker.jsx - SERVER-SIDE VERSION
"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { 
    updateThemeBackgroundColor, 
    updateThemeBtnColor, 
    updateThemeBtnFontColor, 
    updateThemeBtnShadowColor, 
    updateThemeTextColour,
    getAppearanceData 
} from "@/lib/services/appearanceService";
import { isValidHexCode } from "@/lib/utilities";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

export default function ColorPicker({ colorFor, disabled = false }) {
    const { currentUser } = useAuth();
    const [colorText, setColorText] = useState(colorFor === 4 ? "#000000" : "#e8edf5");
    const debounceColor = useDebounce(colorText, 800); // Increased debounce time for server calls
    const [validColor, setValidColor] = useState(1);
    const [colorHasLoaded, setColorHasLoaded] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const colorPickRef = useRef();
    const isInitialLoad = useRef(true);

    // Map colorFor to update functions
    const updateFunctions = {
        0: updateThemeBackgroundColor,
        1: updateThemeBtnColor,
        2: updateThemeBtnFontColor,
        3: updateThemeBtnShadowColor,
        4: updateThemeTextColour,
    };

    const handleUpdateTheme = async (color) => {
        if (!currentUser || disabled || isUpdating) return;

        const updateFunction = updateFunctions[colorFor] || updateThemeBackgroundColor;
        
        setIsUpdating(true);
        try {
            await updateFunction(color);
            // Success feedback is subtle for color changes
        } catch (error) {
            console.error("Failed to update color:", error);
            toast.error("Failed to update color");
            // Revert to previous color on error
            await fetchCurrentColor();
        } finally {
            setIsUpdating(false);
        }
    };

    const fetchCurrentColor = async () => {
        if (!currentUser) return;

        try {
            const data = await getAppearanceData();
            let currentColor;
            
            switch (colorFor) {
                case 0:
                    currentColor = data.backgroundColor || "#e8edf5";
                    break;
                case 1:
                    currentColor = data.btnColor || "#e8edf5";
                    break;
                case 2:
                    currentColor = data.btnFontColor || "#e8edf5";
                    break;
                case 3:
                    currentColor = data.btnShadowColor || "#e8edf5";
                    break;
                case 4:
                    currentColor = data.themeTextColour || "#000000";
                    break;
                default:
                    currentColor = data.backgroundColor || "#e8edf5";
                    break;
            }
            
            setColorText(currentColor);
        } catch (error) {
            console.error("Failed to fetch current color:", error);
        }
    };

    // Initial data fetch
    useEffect(() => {
        if (currentUser && !colorHasLoaded) {
            fetchCurrentColor();
            setColorHasLoaded(true);
        }
    }, [currentUser, colorFor]);

    // Handle debounced color updates
    useEffect(() => {
        if (!colorHasLoaded || isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }

        if (colorText !== "" && isValidHexCode(colorText)) {
            setValidColor(true);
            handleUpdateTheme(colorText);
        } else {
            setValidColor(false);
        }
    }, [debounceColor, currentUser]);

    // Validate color on direct input
    useEffect(() => {
        if (colorText !== "") {
            setValidColor(isValidHexCode(colorText));
        }
    }, [colorText]);

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }
    
    return (
        <div className={`pt-6 flex items-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <input 
                type="color" 
                className="relative h-0 w-0 overflow-hidden"
                value={validColor ? colorText : "#e8edf5"}
                ref={colorPickRef}
                onChange={(e) => setColorText(e.target.value)} 
                disabled={disabled || isUpdating}
            />
            <div 
                className={`h-12 w-12 mr-4 rounded-lg border-2 relative ${
                    disabled || isUpdating 
                        ? 'cursor-not-allowed opacity-50' 
                        : 'cursor-pointer hover:scale-[1.05] active:scale-90'
                }`} 
                style={{ 
                    background: validColor ? colorText : "#e8edf5",
                    borderColor: validColor ? 'transparent' : '#ef4444'
                }} 
                onClick={() => !disabled && !isUpdating && colorPickRef.current?.click()}
            >
                {/* Loading indicator */}
                {isUpdating && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                )}
            </div>
            <div className={`w-auto relative pt-2 flex items-center hover:border rounded-lg bg-black bg-opacity-[0.05] ${
                validColor ? "focus-within:border-black border-transparent" : "border-red-500"
            } focus-within:border-2 border`}>
                <input 
                    type="text"
                    className="sm:flex-1 sm:w-auto w-[200px] px-4 placeholder-shown:px-3 py-2 text-base font-semibold outline-none opacity-100 bg-transparent peer appearance-none"
                    placeholder=" "
                    value={colorText}
                    onChange={(e) => setColorText(e.target.value)}
                    disabled={disabled || isUpdating}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-xs text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:pt-2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    Colour
                </label>
            </div>
        </div>
    );
}