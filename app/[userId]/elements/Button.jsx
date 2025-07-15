"use client"
import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { HouseContext } from "../House"; // Import the central context
import { hexToRgba, makeValidUrl } from "@/lib/utilities";
import { getCompanyFromUrl } from "@/lib/BrandLinks";
import { availableFonts_Classic } from "@/lib/FontsList";
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from "react-hot-toast";
import { FaCopy } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";
import IconDiv from "./IconDiv";
import ButtonText from "./ButtonText";
import "./style/3d.css";

// Special font component for the "New Mario" theme
const SuperFont = ({ text, isHovered }) => {
    const colors = ['#fff', '#fff', '#fff', '#fff', '#fff']; // Mario colors
    const coloredText = text.split('').map((char, index) => (
        <span
            className="md:text-2xl sm:text-xl text-lg drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-transparent"
            key={index}
            style={{ color: isHovered ? "#3b82f6" : colors[index % colors.length] }}
        >
            {char}
        </span>
    ));
    return <div>{coloredText}</div>;
};

export default function Button({ linkData, content }) {
    // --- Data from Central Context ---
    const { userData } = useContext(HouseContext);
    const {
        btnType = 0,
        btnShadowColor = '#000',
        btnFontColor = '#000',
        btnColor = '#fff',
        selectedTheme = 'Lake White',
        fontType = 0,
        themeTextColour = ''
    } = userData;
    const { url } = linkData; // Get URL from the linkData prop

    // --- Component State ---
    const [modifierClass, setModifierClass] = useState("");
    const [specialElements, setSpecialElements] = useState(null);
    const [accentColor, setAccentColor] = useState([]);
    const [isHovered, setIsHovered] = useState(false);
    const urlRef = useRef(null);

    // --- Translations ---
    const { t, isInitialized } = useTranslation();
    const copySuccessMessage = useMemo(() => 
        isInitialized ? t('public.links.copy_success') : 'Link copied!',
        [isInitialized, t]
    );

    // --- Styling Objects ---
    const [modifierStyles, setModifierStyles] = useState({
        backgroundColor: "",
        color: "",
        boxShadow: "",
    });
    const [btnFontStyle, setBtnFontStyle] = useState({
        color: ""
    });

    // --- Functions ---
    const handleCopy = () => {
        navigator.clipboard.writeText(makeValidUrl(url));
        toast.success(copySuccessMessage, {
            style: { border: '1px solid #6fc276', padding: '16px', color: '#6fc276' },
            iconTheme: { primary: '#6fc276', secondary: '#FFFAEE' },
        });
    };

    function getRootNameFromUrl(linkUrl) {
        try {
            return new URL(makeValidUrl(linkUrl)).hostname;
        } catch (error) {
            console.error("Invalid URL for parsing root name:", linkUrl, error);
            return '';
        }
    }

    // --- Effects to Calculate Styles ---

    // Effect for the "3D Blocks" theme special styling
    useEffect(() => {
        if (selectedTheme !== "3D Blocks") return;

        const rootName = getRootNameFromUrl(url);
        let colors = ["#191414", "#14171A"]; // Default colors

        switch (String(getCompanyFromUrl(rootName)).toLowerCase()) {
            case 'tiktok': colors = ["#ff0050", "#00f2ea"]; break;
            case 'twitter': colors = ["#1DA1F2", "#657786"]; break;
            case 'spotify': colors = ["#1DB954", "#1DB954"]; break;
            case 'youtube': colors = ["#FF0000", "#FF0000"]; break;
            case 'instagram': colors = ["#E1306C", "#833AB4"]; break;
            // ... add other brand colors as needed
        }
        setAccentColor(colors);
    }, [selectedTheme, url]);

    // Main effect to determine button classes and special elements based on theme and type
    useEffect(() => {
        if (selectedTheme === "3D Blocks") {
            setModifierClass("relative after:absolute after:h-2 after:w-[100.5%] after:bg-black bg-white after:-bottom-2 after:left-[1px] after:skew-x-[57deg] after:ml-[2px] before:absolute before:h-[107%] before:w-3 before:bg-[currentColor] before:top-[1px] before:border-2 before:border-black before:-right-3 before:skew-y-[30deg] before:grid before:grid-rows-2 border-2 border-black inset-2 ml-[-20px] btn");
            setSpecialElements(null);
            setModifierStyles({ backgroundColor: accentColor[0] || '', color: accentColor[1] || '' });
            setBtnFontStyle({ color: '#fff' });
            return;
        }

        const classMap = {
            0: "", 1: "rounded-lg", 2: "rounded-3xl",
            3: "border border-black bg-opacity-0", 4: "border border-black rounded-lg bg-opacity-0", 5: "border border-black rounded-3xl bg-opacity-0",
            6: "bg-white border border-black", 7: "bg-white border border-black rounded-lg", 8: "bg-white border border-black rounded-3xl",
            9: "bg-white", 10: "bg-white rounded-lg", 11: "bg-white rounded-3xl",
            15: "border border-black bg-black rounded-3xl",
        };
        setModifierClass(classMap[btnType] || "");

        let newSpecialElements = null;
        if (btnType === 12) {
            setModifierClass("relative border border-black bg-black");
            newSpecialElements = <>
                <span className="w-full absolute left-0 bottom-0 translate-y-[6px]"><Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="" width={1000} height={100} priority className="w-full scale-[-1]" /></span>
                <span className="w-full absolute left-0 top-0 -translate-y-[6px]"><Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="" width={1000} height={1000} priority className="w-full" /></span>
            </>;
        }
        // ... (add other special cases for btnType 13, 14, 16 here if needed)
        setSpecialElements(newSpecialElements);

    }, [btnType, selectedTheme, accentColor]);

    // Effect to calculate box-shadow style
    useEffect(() => {
        if (selectedTheme === "3D Blocks") return;
        const shadowMap = {
            6: `4px 4px 0 0 ${hexToRgba(btnShadowColor)}`,
            7: `4px 4px 0 0 ${hexToRgba(btnShadowColor)}`,
            8: `4px 4px 0 0 ${hexToRgba(btnShadowColor)}`,
            9: `0 4px 4px 0 ${hexToRgba(btnShadowColor, 0.16)}`,
            10: `0 4px 4px 0 ${hexToRgba(btnShadowColor, 0.16)}`,
            11: `0 4px 4px 0 ${hexToRgba(btnShadowColor, 0.16)}`,
        };
        setModifierStyles(prev => ({ ...prev, boxShadow: shadowMap[btnType] || '' }));
    }, [btnShadowColor, btnType, selectedTheme]);

    // Effect to calculate background and font colors
    useEffect(() => {
        if (selectedTheme === "3D Blocks") return;
        const isSpecialType = [12, 13].includes(btnType);
        setModifierStyles(prev => ({ ...prev, backgroundColor: isSpecialType ? '' : btnColor }));
        setBtnFontStyle({ color: isSpecialType ? '#fff' : btnFontColor });
    }, [btnColor, btnFontColor, btnType, selectedTheme]);


    // --- Render Logic ---
    const fontName = availableFonts_Classic[fontType] || availableFonts_Classic[0];

    if (selectedTheme === "New Mario") {
        return (
            <div className="userBtn relative overflow-hidden flex justify-between items-center h-16 md:w-[35rem] sm:w-[30rem] w-clamp">
                {Array(9).fill("").map((_, i) => (
                    <Image key={i} src={"https://linktree.sirv.com/Images/Scene/Mario/mario-brick.png"} alt="Mario Brick" width={650} height={660} className="h-16 w-auto object-contain hover:-translate-y-2 cursor-pointer" onClick={() => urlRef.current?.click()} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} />
                ))}
                <Link ref={urlRef} href={makeValidUrl(url)} target="_blank" className="absolute top-0 left-0 z-30 pointer-events-none cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1">
                    <div className="grid place-items-center">
                        <Image src={"https://linktree.sirv.com/Images/Scene/Mario/mario-box.png"} alt="Mario Box" width={650} height={660} className={`h-12 w-auto object-contain hover:-translate-y-2 ${isHovered ? "rotate-2" : ""}`} />
                        <div className={`absolute ${isHovered ? "rotate-2" : ""}`}><IconDiv url={url} unique="Mario" /></div>
                    </div>
                    <ButtonText content={<SuperFont text={content} isHovered={isHovered} />} fontClass="MariaFont" />
                </Link>
                <div onClick={handleCopy} className="absolute p-2 h-9 right-3 z-40 grid place-items-center aspect-square rounded-full border border-white group cursor-pointer bg-black text-white hover:scale-105 active:scale-90"><FaCopy className="rotate-10 group-hover:rotate-0" /></div>
            </div>
        );
    }

    return (
        <div className={`${modifierClass} userBtn relative justify-between items-center flex hover:scale-[1.025] md:w-[35rem] sm:w-[30rem] w-clamp`} style={{ ...modifierStyles, borderColor: selectedTheme === "Matrix" ? themeTextColour : "" }}>
            <Link href={makeValidUrl(url)} target="_blank" className="cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1">
                {specialElements}
                <IconDiv url={url} />
                <ButtonText btnFontStyle={btnFontStyle} content={content} fontClass={fontName.class} />
            </Link>
            <div onClick={handleCopy} className="absolute p-2 h-9 right-3 grid place-items-center aspect-square rounded-full border border-white group cursor-pointer bg-black text-white hover:scale-105 active:scale-90">
                <FaCopy className="rotate-10 group-hover:rotate-0" />
            </div>
        </div>
    );
}