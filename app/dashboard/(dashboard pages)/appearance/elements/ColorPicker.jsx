// app/dashboard/(dashboard pages)/appearance/elements/ColorPicker.jsx - WORKING VERSION
"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { 
    updateThemeBackgroundColor, 
    updateThemeBtnColor, 
    updateThemeBtnFontColor, 
    updateThemeBtnShadowColor, 
    updateThemeTextColour
} from "@/lib/services/appearanceService";
import { isValidHexCode } from "@/lib/utilities";
import { useEffect, useRef, useState, useContext } from "react";
import { toast } from "react-hot-toast";
import { AppearanceContext } from "../page";

export default function ColorPicker({ colorFor, disabled = false }) {
    const { currentUser } = useAuth();
    const { appearance, updateAppearance } = useContext(AppearanceContext);
    const [colorText, setColorText] = useState("");
    const debounceColor = useDebounce(colorText, 800);
    const [validColor, setValidColor] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const colorPickRef = useRef();
    const isInitialLoad = useRef(true);
    const hasInitialized = useRef(false);
    const lastContextValue = useRef(null); // Track last known context value

    // ✅ VALIDATE colorFor prop to prevent undefined issues
    if (colorFor === undefined || colorFor === null) {
        console.warn('⚠️ ColorPicker: colorFor prop is undefined, skipping render');
        return null;
    }

    // Map colorFor to update functions
    const updateFunctions = {
        0: updateThemeBackgroundColor,
        1: updateThemeBtnColor,
        2: updateThemeBtnFontColor,
        3: updateThemeBtnShadowColor,
        4: updateThemeTextColour,
    };

    // Map colorFor to appearance field names
    const colorFieldMap = {
        0: 'backgroundColor',
        1: 'btnColor',
        2: 'btnFontColor',
        3: 'btnShadowColor',
        4: 'themeTextColour',
    };

    // Map colorFor to default colors
    const defaultColors = {
        0: '#e8edf5',
        1: '#ffffff',
        2: '#000000',
        3: '#000000',
        4: '#000000',
    };

    // ✅ VALIDATE colorFor is valid
    if (!(colorFor in colorFieldMap)) {
        console.warn(`⚠️ ColorPicker: Invalid colorFor value: ${colorFor}`);
        return null;
    }

    // ✅ FIXED: Initialize color from context only once, then let user control it
    useEffect(() => {
        if (appearance && !hasInitialized.current) {
            const fieldName = colorFieldMap[colorFor];
            const currentColor = appearance[fieldName] || defaultColors[colorFor];
            setColorText(currentColor);
            lastContextValue.current = currentColor;
            hasInitialized.current = true;
            console.log(`🎨 ColorPicker ${colorFor}: Initialized with color: ${currentColor}`);
        }
    }, [appearance, colorFor]);

    // ✅ REMOVED: The problematic sync logic that was overwriting user changes
    // The color picker should be controlled by user input, not constantly synced to context

    const handleUpdateTheme = async (color) => {
        if (!currentUser || disabled || isUpdating) return;

        const updateFunction = updateFunctions[colorFor];
        const fieldName = colorFieldMap[colorFor];
        
        if (!updateFunction || !fieldName) {
            console.error(`❌ Invalid colorFor: ${colorFor}`);
            return;
        }
        
        console.log(`🔄 Updating ${fieldName} to ${color}`);
        
        // ✅ OPTIMISTIC UPDATE: Update context immediately
        updateAppearance(fieldName, color);
        lastContextValue.current = color; // Track what we set
        
        setIsUpdating(true);
        try {
            await updateFunction(color);
            console.log(`✅ Color updated successfully: ${fieldName} = ${color}`);
        } catch (error) {
            console.error("Failed to update color:", error);
            toast.error("Failed to update color");
            
            // ✅ REVERT: Restore previous color from context on error
            const previousColor = appearance[fieldName] || defaultColors[colorFor];
            updateAppearance(fieldName, previousColor);
            setColorText(previousColor);
            lastContextValue.current = previousColor;
        } finally {
            setIsUpdating(false);
        }
    };

    // ✅ FIXED: Handle debounced color updates with proper validation
    useEffect(() => {
        // Skip initial load or if no appearance data
        if (isInitialLoad.current || !appearance || !hasInitialized.current) {
            if (hasInitialized.current) {
                isInitialLoad.current = false;
            }
            return;
        }

        // Only update if user made a change and color is valid
        if (colorText !== "" && isValidHexCode(colorText) && colorText !== lastContextValue.current) {
            setValidColor(true);
            console.log(`🎯 Debounced update triggered: ${colorText}`);
            handleUpdateTheme(colorText);
        } else if (colorText !== "" && !isValidHexCode(colorText)) {
            setValidColor(false);
        }
    }, [debounceColor, currentUser, appearance]);

    // Validate color on direct input
    useEffect(() => {
        if (colorText !== "") {
            setValidColor(isValidHexCode(colorText));
        }
    }, [colorText]);

    // ✅ EARLY RETURN: Don't render if missing dependencies
    if (!currentUser || !appearance || !hasInitialized.current) {
        return (
            <div className="pt-6 flex items-center animate-pulse">
                <div className="h-12 w-12 mr-4 rounded-lg bg-gray-200"></div>
                <div className="h-12 w-48 rounded-lg bg-gray-200"></div>
            </div>
        );
    }

    const currentColor = validColor ? colorText : defaultColors[colorFor];
    
    return (
        <div className={`pt-6 flex items-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <input 
                type="color" 
                className="relative h-0 w-0 overflow-hidden"
                value={currentColor}
                ref={colorPickRef}
                onChange={(e) => {
                    console.log(`🎨 Color picker changed: ${e.target.value}`);
                    setColorText(e.target.value);
                }} 
                disabled={disabled || isUpdating}
            />
            <div 
                className={`h-12 w-12 mr-4 rounded-lg border-2 relative ${
                    disabled || isUpdating 
                        ? 'cursor-not-allowed opacity-50' 
                        : 'cursor-pointer hover:scale-[1.05] active:scale-90'
                }`} 
                style={{ 
                    background: currentColor,
                    borderColor: validColor ? 'transparent' : '#ef4444'
                }} 
                onClick={() => {
                    if (!disabled && !isUpdating) {
                        console.log(`🖱️ Color swatch clicked`);
                        colorPickRef.current?.click();
                    }
                }}
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
                    onChange={(e) => {
                        console.log(`⌨️ Text input changed: ${e.target.value}`);
                        setColorText(e.target.value);
                    }}
                    disabled={disabled || isUpdating}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-xs text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:pt-2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    Colour
                </label>
            </div>
        </div>
    );
}