"use client"
import { appStorage, fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateThemeBackground } from "@/lib/update data/updateTheme";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { FaCheck, FaX, } from "react-icons/fa6";
import { backgroundContext } from "../components/Backgrounds";
import { toast } from "react-hot-toast";
import { generateUniqueId } from "@/lib/utilities";
import { backgroundImageUpload } from "@/lib/update data/backgroundImageUpload";
import { backgroundVideoUpload } from "@/lib/update data/backgroundVideoUpload";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function BackgroundCard({ text, identifier, colorValue, backImg }) {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { setIsGradient } = useContext(backgroundContext);
    const [isSelected, setIsSelected] = useState(false);
    const [uploadedFilePreview, setUploadedFilePreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState('');
    const [previewing, setPreviewing] = useState(false);
    const formRef = useRef();
    const inputRef = useRef();

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            errorImageTooLarge: t('dashboard.appearance.background_card.error_image_too_large'),
            errorVideoTooLarge: t('dashboard.appearance.background_card.error_video_too_large'),
            errorNotAuth: t('dashboard.appearance.background_card.error_not_authenticated'),
            errorLoginRequired: t('dashboard.appearance.background_card.error_login_required'),
            toastLoading: t('dashboard.appearance.background_card.toast_loading'),
            toastSuccess: t('dashboard.appearance.background_card.toast_success'),
            toastError: t('dashboard.appearance.background_card.toast_error'),
            altUploadIcon: t('dashboard.appearance.background_card.alt_upload_icon'),
            altPreview: t('dashboard.appearance.background_card.alt_preview'),
            altLoading: t('dashboard.appearance.profile.alt_loading'),
            videoFallback: t('dashboard.appearance.background_card.video_fallback')
        };
    }, [t, isInitialized]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
    
        if (identifier === "Image" && selectedFile.size > 2 * 1024 * 1024) {
            toast.error(translations.errorImageTooLarge); return;
        }
        if (identifier === "Video" && selectedFile.size > 20 * 1024 * 1024) {
            toast.error(translations.errorVideoTooLarge); return;
        }
    
        const previewImageURL = URL.createObjectURL(selectedFile);
        setUploadedFilePreview(previewImageURL);
        setUploadedFile(selectedFile);
        setPreviewing(true);
    }
    
    const handleUploadFile = async () => {
        if (!currentUser) throw new Error(translations.errorNotAuth);
        if (!uploadedFile) return;
    
        const fileExtension = uploadedFile.name.substring(uploadedFile.name.lastIndexOf('.') + 1);
        const fileName = `${generateUniqueId()}.${fileExtension}`;
        const filePath = identifier === "Image" 
            ? `backgroundImage/${currentUser.uid}/${fileName}` 
            : `backgroundVideo/${currentUser.uid}/${fileName}`;
            
        const storageRef = ref(appStorage, filePath);
        const snapshot = await uploadBytes(storageRef, uploadedFile);
        return await getDownloadURL(snapshot.ref);
    }
    
    const handleUpdateTheme = async () => {
        if (!currentUser) throw new Error(translations.errorNotAuth);
        await updateThemeBackground(identifier, currentUser.uid);
    }
    
    const handlePickingProcess = async () => {
        if (!currentUser) throw new Error(translations.errorNotAuth);
        setIsLoading(true);
        try {
            const fileUrl = await handleUploadFile();
            if (identifier === "Image") await backgroundImageUpload(fileUrl, currentUser.uid);
            if (identifier === "Video") await backgroundVideoUpload(fileUrl, currentUser.uid);
            await handleUpdateTheme();
            handleReset();
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleReset = () => {
        if (isLoading) return;
        if (formRef.current) formRef.current.reset();
        setUploadedFile('');
        setPreviewing(false);
    }
    
    function functionType() {
        if (!currentUser) {
            toast.error(translations.errorLoginRequired); return;
        }
        switch (identifier) {
            case "Image":
            case "Video":
                inputRef.current.click(); break;
            default:
                handleUpdateTheme(); break;
        }
    }
    
    const toasthandler = () => {
        if (!currentUser) {
            toast.error(translations.errorLoginRequired); return;
        }
        const promise = handlePickingProcess();
        toast.promise(promise, {
            loading: translations.toastLoading,
            success: translations.toastSuccess,
            error: translations.toastError
        }, { /* style object */ });
    }
    
    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { backgroundType } = docSnap.data();
                setIsGradient(backgroundType === "Gradient");
                setIsSelected(backgroundType === identifier);
            }
        });
        return () => unsubscribe();
    }, [identifier, currentUser, setIsGradient]);

    if (!isInitialized || !currentUser) return null;

    return (
        <div className="min-w-[8rem] flex-1 items-center flex flex-col">
            <div className={`w-full h-[13rem] relative ${!colorValue && !backImg ? "border-dashed border-black" : ""} border rounded-lg hover:scale-105 active:scale-90 grid place-items-center cursor-pointer overflow-hidden`} onClick={functionType}>
                {isSelected && <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-[0.5] grid place-items-center z-10 text-white text-xl">
                    <FaCheck />
                </div>}
                {colorValue ?
                    <div className="h-full w-full" style={{ backgroundColor: colorValue }}></div>
                    :
                    backImg ?
                        <div className="h-full w-full bg-cover bg-no-repeat" style={{ backgroundImage: backImg }}></div>
                        :
                        <div className="h-full w-full grid place-items-center">
                            {identifier === "Image" && <input type="file" className="absolute opacity-0 pointer-events-none" ref={inputRef} accept="image/*" onChange={handleFileChange} />}
                            {identifier === "Video" && <input type="file" className="absolute opacity-0 pointer-events-none" ref={inputRef} accept="video/*" onChange={handleFileChange} />}
                            <div className="bg-black bg-opacity-[0.1] rounded-lg p-1">
                                <Image src={"https://linktree.sirv.com/Images/icons/image.svg"} alt={translations.altUploadIcon} height={27} width={27} />
                            </div>
                        </div>
                }
            </div>
            <span className="py-3 text-sm">{text}</span>
            {previewing && <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                <div className="absolute h-full w-full bg-black bg-opacity-[0.25] backdrop-blur-[1px] top-0 left-0 p-2" onClick={handleReset}></div>
                <form ref={formRef} className="relative z-10 sm:max-w-[30rem] max-w-18 max-h-[80vh] overflow-hidden p-4">
                    <div className="w-full scale-[0.95] relative overflow-hidden place-items-center grid aspect-square bg-white">
                        {identifier ==="Image" && <Image src={uploadedFilePreview} alt={translations.altPreview} height={1000} width={1000} priority className="min-w-[10rem] w-full object-contain min-h-full" />}
                        {identifier === "Video" && <video className="min-w-[10rem] w-full object-contain min-h-full" controls autoPlay loop>
                            <source src={uploadedFilePreview} type={uploadedFile?.type || 'video/mp4'} />
                            {translations.videoFallback}
                        </video>}
                        {isLoading && <div className="absolute z-10 h-full w-full scale-110 grid place-items-center bg-black bg-opacity-[0.25] mix-blend-screen">
                            <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={50} height={50} alt={translations.altLoading} className="mix-blend-screen" />
                        </div>}
                    </div>
                    {!isLoading && <div className="absolute top-2 right-2 rounded-full p-2 hover:bg-red-500 active:scale-90 bg-black text-white text-sm cursor-pointer" onClick={handleReset}><FaX /></div>}
                    {!isLoading && <div className="p-3 text-lg text-white bg-btnPrimary w-fit rounded-full mx-auto active:bg-btnPrimaryAlt active:scale-90 hover:scale-110 cursor-pointer my-3" onClick={toasthandler}><FaCheck /></div>}
                </form>
            </div>}
        </div>
    );
}