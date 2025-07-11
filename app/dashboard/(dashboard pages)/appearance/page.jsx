"use client"

import { useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import Backgrounds from "./components/Backgrounds";
import ChristmasAccessories from "./components/ChristmasAccessories";
import Buttons from "./components/Buttons";
import FontsOptions from "./components/FontsOptions";
import ProfileCard from "./components/ProfileCard";
import Themes from "./components/Themes";

export default function AppearancePage() {
    const { t, isInitialized } = useTranslation();

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profile: t('dashboard.appearance.headings.profile'),
            themes: t('dashboard.appearance.headings.themes'),
            customAppearance: t('dashboard.appearance.headings.custom_appearance'),
            customAppearanceDesc: t('dashboard.appearance.custom_appearance_description'),
            backgrounds: t('dashboard.appearance.headings.backgrounds'),
            christmas: t('dashboard.appearance.headings.christmas'),
            buttons: t('dashboard.appearance.headings.buttons'),
            fonts: t('dashboard.appearance.headings.fonts'),
            newBadge: t('dashboard.appearance.new_badge')
        };
    }, [t, isInitialized]);

    if (!isInitialized) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto animate-pulse">
                <div className="py-4">
                    <div className="h-7 w-24 bg-gray-200 rounded-md mb-2"></div>
                    <div className="h-[21rem] bg-gray-200 rounded-3xl"></div>
                </div>
                <div className="py-4">
                    <div className="h-7 w-20 bg-gray-200 rounded-md"></div>
                </div>
                <div className="py-4">
                    <div className="h-7 w-40 bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-full bg-gray-200 rounded-md mt-4"></div>
                    <div className="h-4 w-10/12 bg-gray-200 rounded-md mt-2"></div>
                </div>
                <div className="py-4">
                    <div className="h-7 w-32 bg-gray-200 rounded-md"></div>
                </div>
                <div className="py-4">
                    <div className="h-7 w-36 bg-gray-200 rounded-md"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.profile}</span>
                <ProfileCard />
            </div>
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.themes}</span>
                <Themes />
            </div>
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.customAppearance}</span>
                <p className="py-3 sm:text-base text-sm">
                    {translations.customAppearanceDesc}
                </p>
            </div>
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.backgrounds}</span>
                <Backgrounds />
            </div>
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.christmas} <span className="py-1 px-3 rounded bg-green-500 text-white font-medium text-sm">{translations.newBadge}</span></span>
                <ChristmasAccessories />
            </div>
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.buttons}</span>
                <Buttons />
            </div>
            <div className="py-4">
                <span className="text-lg font-semibold my-4">{translations.fonts}</span>
                <FontsOptions />
            </div>
        </div>
    );
}