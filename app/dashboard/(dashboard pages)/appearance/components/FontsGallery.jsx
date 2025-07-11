"use client"
import { useContext, useEffect, useState, useMemo } from "react";
import { FaCheck, FaX } from "react-icons/fa6";
import { selectedFontContext } from "../elements/SelectFonts";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { updateThemeFont } from "@/lib/update data/updateTheme";
import { availableFonts_Classic } from "@/lib/FontsList";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function FontsGallery() {
    const { t, isInitialized } = useTranslation();
    const { setOpenFontGallery } = useContext(selectedFontContext);
    const [selectedFont, setSelectedFont] = useState(0);
    const [classicFonts, setClassicFonts] = useState([...availableFonts_Classic]);
    const [searchParam, setSearchParam] = useState("");
    const debouceSearchParam = useDebounce(searchParam, 500);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.fonts_gallery.title'),
            searchPlaceholder: t('dashboard.appearance.fonts_gallery.search_placeholder'),
            classicSection: t('dashboard.appearance.fonts_gallery.classic_section'),
            selectedStatus: t('dashboard.appearance.fonts_gallery.selected_status'),
            noFontsFound: t('dashboard.appearance.fonts_gallery.no_fonts_found'),
            saveButton: t('dashboard.appearance.fonts_gallery.save_button'),
        };
    }, [t, isInitialized]);
    
    useEffect(() => {
        setClassicFonts(availableFonts_Classic);
    }, []);

    useEffect(() => {
        const searchPool = [...availableFonts_Classic];
        if (searchParam !== '') {
            const foundFonts = searchPool.filter(font => 
                font.name.toLowerCase().includes(searchParam.toLowerCase())
            );
            setSelectedFont(0);
            setClassicFonts(foundFonts);
        } else {
            setClassicFonts(searchPool);
        }
    }, [debouceSearchParam, searchParam]);

    const handleSelectItem = (id) => {
        setSelectedFont(prevId => (id === prevId ? 0 : id));
    }

    const handleUpdateTheme = async() => {
        await updateThemeFont(selectedFont);
    }

    const handleSave = async() =>{
        if (selectedFont > 0) {
            await handleUpdateTheme();
            handleClose();
        }
    }

    const handleClose = () => {
        setOpenFontGallery(false);
    }

    const renderSkeleton = () => (
        <div className="fixed h-screen w-screen top-0 left-0 grid place-items-center z-[9999999999]">
            <div className="absolute h-full w-full top-0 left-0 bg-black bg-opacity-[0.25] backdrop-blur-[1px]"></div>
            <div className="sm:h-[41.5rem] h-[90vh] sm:w-[31.90rem] w-[90vw] flex flex-col bg-white rounded-3xl shadow-lg p-5 animate-pulse">
                <div className="h-6 w-32 bg-gray-200 rounded-md mx-auto mb-3"></div>
                <div className="h-10 bg-gray-200 rounded-lg mb-3"></div>
                <div className="flex-1 overflow-auto">
                    <div className="h-5 w-20 bg-gray-200 rounded-md my-3"></div>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-12 bg-gray-200 rounded-3xl mb-1"></div>
                    ))}
                </div>
                <div className="h-12 bg-gray-200 rounded-3xl mt-3"></div>
            </div>
        </div>
    );

    if (!isInitialized) {
        return renderSkeleton();
    }

    return (
        <div className="fixed h-screen w-screen top-0 left-0 grid place-items-center z-[9999999999]">
            <div className="absolute h-full w-full top-0 left-0 bg-black bg-opacity-[0.25] backdrop-blur-[1px]" onClick={handleClose}></div>

            <div className="sm:h-[41.5rem] h-[90vh] sm:w-[31.90rem] gap-3 w-[90vw] flex flex-col bg-white rounded-3xl shadow-lg relative enter p-5">
                <div className="px-4 py-2 font-semibold text-center justify-center relative flex items-center w-full">
                    {translations.title}
                    <span className="absolute right-0 cursor-pointer" onClick={handleClose}> <FaX className="text-sm" /> </span>
                </div>
                <div className="relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-2 border-2 hover:border-black hover:border-opacity-[0.1] border-transparent">
                    <input
                        type="text"
                        className="flex-1 px-4 placeholder-shown:px-3 py-2 text-base outline-none opacity-100 bg-transparent peer appearance-none"
                        placeholder=" "
                        value={searchParam}
                        onChange={(e)=>setSearchParam(e.target.value)}
                    />
                    <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-xs text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:pt-2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-80 transition duration-[250] ease-linear">
                        {translations.searchPlaceholder}
                    </label>
                </div>

                <div className="flex-1 overflow-auto">
                    <section className="flex flex-col gap-1">
                        {classicFonts.length > 0 &&<span className="opacity-50 py-3">{translations.classicSection}</span>}
                        {classicFonts.map((fontItem => (
                            <div className={`${fontItem.class} select-none px-5 py-3 flex items-center justify-between cursor-pointer w-full rounded-3xl ${selectedFont === fontItem.id ? "bg-btnPrimary bg-opacity-20" : "hover:bg-black hover:bg-opacity-5"}`} key={fontItem.id} onClick={() => handleSelectItem(fontItem.id)}>
                                {fontItem.name}
                                {selectedFont === fontItem.id && <span className="flex items-center gap-1 text-sm text-btnPrimaryAlt">
                                    <FaCheck />
                                    {translations.selectedStatus}
                                </span>}
                            </div>
                        )))}

                        {classicFonts.length === 0 && <div className="w-full text-center opacity-50 py-4">
                            {translations.noFontsFound}
                        </div> }
                    </section>
                </div>
                <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] border w-full ${selectedFont > 0 ? "bg-btnPrimary text-white cursor-pointer" : "bg-black bg-opacity-20 opacity-40 cursor-not-allowed"}`} onClick={handleSave}>
                    {translations.saveButton}
                </div>
            </div>
        </div>
    );
}