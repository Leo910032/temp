"use client"
import { useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import SelectFonts from "../elements/SelectFonts";

export default function FontsOptions() {
    const { t, isInitialized } = useTranslation();

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            fontLabel: t('dashboard.appearance.fonts.font_label')
        };
    }, [t, isInitialized]);

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="h-5 w-12 bg-gray-200 rounded-md mb-2"></div>
                <div className="h-10 bg-gray-200 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            <span className="font-semibold text-sm">{translations.fontLabel}</span>
            <SelectFonts />
        </div>
    );
}