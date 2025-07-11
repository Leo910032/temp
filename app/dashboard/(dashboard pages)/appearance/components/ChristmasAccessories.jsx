"use client"
import { useAuth } from "@/contexts/AuthContext";
import { updateChristmasAccessory } from "@/lib/update data/updateChristmasAccessory";
import AssestCardVideo from "../elements/AssestCardVideo";
import { useState, useMemo } from "react"; // ADD useMemo
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT

export default function ChristmasAccessories() {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const { currentUser } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);

    // PRE-COMPUTE TRANSLATIONS
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            snowFall: t('dashboard.appearance.christmas.snow_fall'),
            toastSuccess: t('dashboard.appearance.christmas.toast_success'),
            toastError: t('dashboard.appearance.christmas.toast_error'),
        };
    }, [t, isInitialized]);

    // This mapping helps translate the accessory name for the toast message
    // while keeping the internal identifier ('Snow Fall') for the logic.
    const accessoryDisplayNames = useMemo(() => ({
        'Snow Fall': translations.snowFall,
        // Add other accessories here as you create them
    }), [translations]);

    const handleAccessoryClick = async (accessoryType) => {
        if (!currentUser || isUpdating) return;

        try {
            setIsUpdating(true);
            await updateChristmasAccessory(accessoryType, currentUser.uid);

            // Use the translated name for the toast message
            const displayName = accessoryDisplayNames[accessoryType] || accessoryType;
            toast.success(translations.toastSuccess.replace('{{accessory}}', displayName));

        } catch (error) {
            console.error("Error updating Christmas accessory:", error);
            toast.error(translations.toastError);
        } finally {
            setIsUpdating(false);
        }
    };

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    <div className="h-[10rem] bg-gray-200 rounded-lg"></div>
                    {/* Add more skeleton cards if you have more accessories */}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                <AssestCardVideo 
                    coverImg={"https://linktree.sirv.com/Images/Christmas/videoframe_1211.png"} 
                    src={"https://linktree.sirv.com/Images/Christmas/Snow_Falling_Animation_Black_and_Green_Screen_Background.mp4"} 
                    type={"video/mp4"} 
                    text={translations.snowFall} // Use translated text for display
                    onClick={() => handleAccessoryClick("Snow Fall")} // Use English identifier for logic
                    disabled={isUpdating}
                />
                {/* Add more Christmas accessories here, following the same pattern */}
            </div>
        </div>
    )
}