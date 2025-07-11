"use client"
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useContext, useMemo } from "react";
import { HouseContext } from "../House";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD TRANSLATION IMPORT

export default function SensitiveWarning() {
    const { setSensitiveWarning, sensitiveType } = useContext(HouseContext);
    const router = useRouter();
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('public.sensitive_warning.title'),
            description: t('public.sensitive_warning.description'),
            continueButton: t('public.sensitive_warning.continue_button'),
            goBackButton: t('public.sensitive_warning.go_back_button'),
            // Age-specific buttons
            over18: t('public.sensitive_warning.age_buttons.over_18'),
            over21: t('public.sensitive_warning.age_buttons.over_21'),
            over25: t('public.sensitive_warning.age_buttons.over_25'),
            under18: t('public.sensitive_warning.age_buttons.under_18'),
            under21: t('public.sensitive_warning.age_buttons.under_21'),
            under25: t('public.sensitive_warning.age_buttons.under_25')
        };
    }, [t, isInitialized]);

    const handleBack = () => {
        router.back();
    }

    const handleProceed = () => { 
        setSensitiveWarning(false);
    }

    // GET BUTTON TEXTS BASED ON SENSITIVE TYPE
    const getContinueButtonText = () => {
        if (!isInitialized) return "Continue"; // Fallback
        
        switch(sensitiveType) {
            case 1: return translations.over18;
            case 2: return translations.over21;
            case 3: return translations.over25;
            default: return translations.continueButton;
        }
    };

    const getGoBackButtonText = () => {
        if (!isInitialized) return "Go Back"; // Fallback
        
        switch(sensitiveType) {
            case 1: return translations.under18;
            case 2: return translations.under21;
            case 3: return translations.under25;
            default: return translations.goBackButton;
        }
    };

    // SHOW LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div className="h-screen w-screen grid place-items-center p-5" style={{backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), linear-gradient(125deg, rgb(11, 175, 255), rgb(57, 224, 155) 50%, rgb(255, 194, 19))`}}>
                <main className="flex flex-col gap-4 text-white max-w-[40rem] w-full items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    <div className="h-6 w-48 bg-white bg-opacity-20 rounded animate-pulse"></div>
                    <div className="h-4 w-64 bg-white bg-opacity-20 rounded animate-pulse"></div>
                    <div className="my-4 w-full space-y-2">
                        <div className="h-12 w-full bg-white bg-opacity-20 rounded-xl animate-pulse"></div>
                        <div className="h-12 w-full bg-white bg-opacity-20 rounded-xl animate-pulse"></div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen grid place-items-center p-5" style={{backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), linear-gradient(125deg, rgb(11, 175, 255), rgb(57, 224, 155) 50%, rgb(255, 194, 19))`}}>
            <main className="flex flex-col gap-4 text-white max-w-[40rem] w-full items-center">
                <Image
                    src={"https://linktree.sirv.com/Images/icons/close-eye.svg"}
                    alt={"icon"}
                    width={30}
                    height={30}
                />
                <h1 className="font-bold sm:text-2xl text-xl">{translations.title}</h1>
                <p className="sm:text-xl text-center">{translations.description}</p>

                <div className="my-4 w-full">
                    <div className="p-3 font-semibold text-center hover:scale-105 active:scale-90 border border-white border-opacity-50 hover:border-opacity-100 w-full rounded-xl cursor-pointer" onClick={handleProceed}>
                        {getContinueButtonText()}
                    </div>
                    <div className="p-3 font-semibold text-center hover:scale-105 active:scale-90 w-full rounded-xl cursor-pointer" onClick={handleBack}>
                        {getGoBackButtonText()}
                    </div>
                </div>
            </main>
        </div>
    );
}