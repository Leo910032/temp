"use client"
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import React, { useState, useEffect, useMemo } from "react";
import LakeWhite from "../elements/themes/LakeWhite";
import LakeBlack from "../elements/themes/LakeBlack";
import PebbleBlue from "../elements/themes/PebbleBlue";
import PebbleYellow from "../elements/themes/PebbleYellow";
import PebblePink from "../elements/themes/PebblePink";
import BreezePink from "../elements/themes/BreezePink";
import BreezeOrange from "../elements/themes/BreezeOrange";
import BreezeGreen from "../elements/themes/BreezeGreen";
import Confetti from "../elements/themes/Confetti";
import CloudRed from "../elements/themes/CloudRed";
import CloudGreen from "../elements/themes/CloudGreen";
import CloudBlue from "../elements/themes/CloudBlue";
import Rainbow from "../elements/themes/Rainbow";
import StarryNight from "../elements/themes/StarryNight";
import MatrixBG from "../elements/themes/Matrix";
import Mario from "../elements/themes/Mario";
import Blocks3D from "../elements/themes/3DBlocks";
import CustomTheme from "../elements/themes/CustomTheme";
import SnowFall from "../elements/themes/SnowFall";
import { useTranslation } from "@/lib/translation/useTranslation";

export const BgContext = React.createContext();

export default function BgDiv({ userId }) {
    const { t, isInitialized } = useTranslation();
    const [backgroundPicture, setBackgroundPicture] = useState(null);
    const [bgType, setBgType] = useState("");
    const [bgTheme, setBgTheme] = useState('Flat Colour');
    const [gradientDirection, setGradientDirection]= useState("");
    const [bgColor, setBgColor] = useState("#e8edf5");
    const [bgImage, setBgImage] = useState('');
    const [bgVideo, setBgVideo] = useState('');
    const [themeTextColour, setThemeTextColour] = useState("");

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        // Re-using existing translation key
        return { altProfile: t('dashboard.appearance.profile.alt_profile') };
    }, [t, isInitialized]);

    useEffect(() => {
        if (!userId) return;

        const docRef = doc(collection(fireApp, "AccountData"), userId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { profilePhoto, displayName, themeFontColor, selectedTheme, backgroundType, gradientDirection, backgroundColor, backgroundImage, backgroundVideo } = docSnap.data();

                setBgType(selectedTheme);
                setBgTheme(backgroundType || "Flat Colour");
                setGradientDirection(gradientDirection || 0);
                setBgColor(backgroundColor || "#e8edf5");
                setBgVideo(backgroundVideo);
                setBgImage(backgroundImage);
                setThemeTextColour(themeFontColor || "");

                if (profilePhoto) {
                    setBackgroundPicture(
                        <Image
                            src={profilePhoto}
                            alt={translations.altProfile || 'Profile'}
                            height={1000}
                            width={1000}
                            className="min-w-full h-full object-cover scale-[1.25]"
                            priority
                        />
                    );
                } else {
                    setBackgroundPicture(
                        <div className="h-full aspect-square w-full bg-gray-300 border grid place-items-center">
                            <span className="text-3xl font-semibold uppercase">
                                {displayName?.[0] || ''}
                            </span>
                        </div>
                    );
                }
            }
        }, (error) => {
            console.error("Error fetching background data:", error);
        });

        return () => unsubscribe();
    }, [userId, translations]);

    if (!isInitialized) {
        return (
            // Basic skeleton while translations load
            <div className="h-full w-full bg-gray-200 animate-pulse"></div>
        )
    }
    
    return (
        <BgContext.Provider value={{bgTheme, bgColor, gradientDirection, bgImage, bgVideo}}>
            {bgType === "Lake White" && <LakeWhite backgroundPicture={backgroundPicture} />}
            {bgType === "Lake Black" && <LakeBlack backgroundPicture={backgroundPicture} />}
            {bgType === "Pebble Blue" && <PebbleBlue />}
            {bgType === "Pebble Yellow" && <PebbleYellow />}
            {bgType === "Pebble Pink" && <PebblePink />}
            {bgType === "Breeze Pink" && <BreezePink />}
            {bgType === "Breeze Orange" && <BreezeOrange />}
            {bgType === "Breeze Green" && <BreezeGreen />}
            {bgType === "Confetti" && <Confetti />}
            {bgType === "Cloud Red" && <CloudRed />}
            {bgType === "Cloud Green" && <CloudGreen />}
            {bgType === "Cloud Blue" && <CloudBlue />}
            {bgType === "Rainbow" && <Rainbow />}
            {bgType === "Starry Night" && <StarryNight />}
            {bgType === "3D Blocks" && <Blocks3D />}
            {bgType === "Matrix" && <MatrixBG textColor={themeTextColour} />}
            {bgType === "New Mario" && <Mario />}
            {bgType === "Custom" && <CustomTheme />}
            {bgType === "Snow Fall" && <SnowFall />}
        </BgContext.Provider>
    );
}