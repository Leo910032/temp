"use client"
import React, { useState, useContext } from "react";
import { AppearanceContext } from "../page";
import { availableFonts_Classic } from "@/lib/FontsList";
import FontsGallery from "../components/FontsGallery";

export default function SelectFonts() {
    const { appearance } = useContext(AppearanceContext);
    const [openFontGallery, setOpenFontGallery] = useState(false);

    // Determine the selected font object based on the fontType from the context
    const selectedFont = availableFonts_Classic[appearance.fontType] || availableFonts_Classic[0];
    
    return (
        <>
            <div 
                className={`${selectedFont.class} w-full my-2 group rounded-lg py-5 px-4 border shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 active:scale-95 transition-all`} 
                onClick={() => setOpenFontGallery(true)}
            >
                <span className="p-3 rounded-md bg-gray-100 text-xl font-semibold">
                    Aa
                </span>
                <span className="font-semibold flex-1 truncate">
                    {selectedFont.name}
                </span>
            </div>
            
            {/* Pass the setter function to the gallery modal */}
            {openFontGallery && <FontsGallery setOpenFontGallery={setOpenFontGallery} />}
        </>
    );
}