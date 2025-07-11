"use client"
import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateCustomMetaData } from "@/lib/update data/updateSocials";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function SEO() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [metaTitle, setMetaTitle] = useState(null);
    const [metaDescription, setMetaDescription] = useState(null);
    const debounceMetaTitle = useDebounce(metaTitle, 500);
    const debounceMetaDescription = useDebounce(metaDescription, 500);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.seo.title'),
            altIcon: t('dashboard.settings.seo.alt_icon'),
            cardTitle: t('dashboard.settings.seo.card_title'),
            cardDescription: t('dashboard.settings.seo.card_description'),
            metaTitleLabel: t('dashboard.settings.seo.meta_title_label'),
            metaDescriptionLabel: t('dashboard.settings.seo.meta_description_label'),
        };
    }, [t, isInitialized]);

    useEffect(() => {
        if (metaTitle === null || metaDescription === null || !currentUser) return;
        updateCustomMetaData({
            title: metaTitle,
            description: metaDescription,
        }, currentUser.uid);
    }, [debounceMetaTitle, debounceMetaDescription, currentUser, metaTitle, metaDescription]);

    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { metaData } = docSnap.data();
                setMetaTitle(metaData?.title || "");
                setMetaDescription(metaData?.description || "");
            } else {
                setMetaTitle("");
                setMetaDescription("");
            }
        }, (error) => {
            console.error("Error fetching metadata:", error);
            setMetaTitle("");
            setMetaDescription("");
        });
        return () => unsubscribe();
    }, [currentUser]);

    if (!isInitialized || !currentUser) {
        return (
            <div className="w-full my-4 px-2 animate-pulse" id="Settings--SEO">
                <div className="flex items-center gap-3 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded-md"></div>
                    <div className="h-7 w-16 bg-gray-200 rounded-md"></div>
                </div>
                <div className="p-5 bg-gray-200 rounded-lg">
                    <div className="h-5 w-32 bg-gray-300 rounded-md"></div>
                    <div className="h-4 w-full bg-gray-300 rounded-md mt-2"></div>
                    <div className="my-3 grid gap-3">
                        <div className="h-14 bg-gray-300 rounded-lg"></div>
                        <div className="h-14 bg-gray-300 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full my-4 px-2" id="Settings--SEO">
            <div className="flex items-center gap-3 py-4">
                <Image
                    src={"https://linktree.sirv.com/Images/icons/seo.svg"}
                    alt={translations.altIcon}
                    height={24}
                    width={24}
                />
                <span className="text-xl font-semibold">{translations.title}</span>
            </div>
            <div className="p-5 bg-white rounded-lg">
                <p className="font-semibold">{translations.cardTitle}</p>
                <p className="opacity-60 sm:text-base text-sm">{translations.cardDescription}</p>

                <div className="my-3 grid gap-3">
                    <div className="rounded-[10px] relative focus-within:ring-2 focus-within:ring-black transition duration-75 ease-out hover:shadow-[inset_0_0_0_2px_#e0e2d9] hover:focus-within:shadow-none bg-black bg-opacity-[0.025]">
                        <div className="flex rounded-[10px] leading-[48px] border-solid border-2 border-transparent">
                            <div className="flex w-full items-center bg-chalk rounded-sm px-3">
                                <div className="relative grow">
                                    <input
                                        placeholder={translations.metaTitleLabel}
                                        className="placeholder-transparent font-semibold peer px-0 sm:text-base text-sm leading-[48px] placeholder:leading-[48px] rounded-xl block pt-6 pb-2 w-full bg-chalk text-black transition duration-75 ease-out !outline-none bg-transparent"
                                        type="text"
                                        value={metaTitle || ""}
                                        onChange={(e) => setMetaTitle(e.target.value)}
                                    />
                                    <label
                                        className="absolute pointer-events-none text-base text-concrete transition-all transform -translate-y-2.5 scale-[0.85] top-[13px] origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-1 peer-placeholder-shown:tracking-normal peer-focus:scale-[0.85] peer-focus:-translate-y-2.5 max-w-[calc(100%-16px)] truncate"
                                    >
                                        {translations.metaTitleLabel}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="rounded-[10px] relative focus-within:ring-2 focus-within:ring-black transition duration-75 ease-out hover:shadow-[inset_0_0_0_2px_#e0e2d9] hover:focus-within:shadow-none bg-black bg-opacity-[0.025]">
                        <div className="flex rounded-[10px] leading-[48px] border-solid border-2 border-transparent">
                            <div className="flex w-full items-center bg-chalk rounded-sm px-3">
                                <div className="relative grow">
                                    <input
                                        placeholder={translations.metaDescriptionLabel}
                                        className="placeholder-transparent font-semibold peer px-0 sm:text-base text-sm leading-[48px] placeholder:leading-[48px] rounded-xl block pt-6 pb-2 w-full bg-chalk text-black transition duration-75 ease-out !outline-none bg-transparent"
                                        type="text"
                                        value={metaDescription || ""}
                                        onChange={(e) => setMetaDescription(e.target.value)}
                                    />
                                    <label
                                        className="absolute pointer-events-none text-base text-concrete transition-all transform -translate-y-2.5 scale-[0.85] top-[13px] origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-1 peer-placeholder-shown:tracking-normal peer-focus:scale-[0.85] peer-focus:-translate-y-2.5 max-w-[calc(100%-16px)] truncate"
                                    >
                                        {translations.metaDescriptionLabel}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}