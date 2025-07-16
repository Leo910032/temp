// app/dashboard/(dashboard pages)/appearance/elements/BackgroundCard.jsx - SERVER-SIDE VERSION
"use client"
import { useAuth } from "@/contexts/AuthContext";
import { 
    updateThemeBackground, 
    uploadBackgroundImage, 
    uploadBackgroundVideo,
    getAppearanceData 
} from "@/lib/services/appearanceService";
import Image from "next/image";
import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { FaCheck, FaX } from "react-icons/fa6";
import { backgroundContext } from "../components/Backgrounds";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function BackgroundCard({ text, identifier, colorValue, backImg }) {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { setIsGradient } = useContext(backgroundContext);
    const [isSelected, setIsSelected] = useState(false);
    const [uploadedFilePreview, setUploadedFilePreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const formRef = useRef();
    const inputRef = useRef();

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            errorImageTooLarge: t('dashboard.appearance.background_card.error_image_too_large') || 'Image too large (max 10MB)',
            errorVideoTooLarge: t('dashboard.appearance.background_card.error_video_too_large') || 'Video too large (max 50MB)',
            errorNotAuth: t('dashboard.appearance.background_card.error_not_authenticated') || 'Please log in',
            errorLoginRequired: t('dashboard.appearance.background_card.error_login_required') || 'Login required',
            toastLoading: t('dashboard.appearance.background_card.toast_loading') || 'Uploading...',
            toastSuccess: t('dashboard.appearance.background_card.toast_success') || 'Background updated!',
            toastError: t('dashboard.appearance.background_card.toast_error') || 'Upload failed',
            altUploadIcon: t('dashboard.appearance.background_card.alt_upload_icon') || 'Upload',
            altPreview: t('dashboard.appearance.background_card.alt_preview') || 'Preview',
            altLoading: t('dashboard.appearance.profile.alt_loading') || 'Loading',
            videoFallback: t('dashboard.appearance.background_card.video_fallback') || 'Video not supported'
        };
    }, [t, isInitialized]);

    // Fetch current background type to determine if selected
    const fetchCurrentBackgroundType = async () => {
        if (!currentUser) return;
        
        try {
            const data = await getAppearanceData();
            const isCurrentlySelected = data.backgroundType === identifier;
            setIsSelected(isCurrentlySelected);
            setIsGradient(data.backgroundType === "Gradient");
        } catch (error) {
            console.error("Failed to fetch background type:", error);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
    
        // Client-side validation
        if (identifier === "Image" && selectedFile.size > 10 * 1024 * 1024) {
            toast.error(translations.errorImageTooLarge);
            return;
        }
        if (identifier === "Video" && selectedFile.size > 50 * 1024 * 1024) {
            toast.error(translations.errorVideoTooLarge);
            return;
        }
    
        const previewImageURL = URL.createObjectURL(selectedFile);
        setUploadedFilePreview(previewImageURL);
        setUploadedFile(selectedFile);
        setPreviewing(true);
    };
    
    const handleUpdateTheme = async () => {
        if (!currentUser) {
            throw new Error(translations.errorNotAuth);
        }
        
        try {
            await updateThemeBackground(identifier);
            setIsSelected(true);
        } catch (error) {
            throw error;
        }
    };
    
    const handlePickingProcess = async () => {
        if (!currentUser || !uploadedFile) {
            throw new Error(translations.errorNotAuth);
        }
        
        setIsLoading(true);
        try {
            // Upload file and update background type
            if (identifier === "Image") {
                await uploadBackgroundImage(uploadedFile);
            } else if (identifier === "Video") {
                await uploadBackgroundVideo(uploadedFile);
            }
            
            // The API automatically sets the background type
            handleReset();
            await fetchCurrentBackgroundType(); // Refresh selection state
            
        } catch (error) {
            console.error("Upload error:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        if (isLoading) return;
        if (formRef.current) formRef.current.reset();
        setUploadedFile(null);
        setPreviewing(false);
        if (uploadedFilePreview) {
            URL.revokeObjectURL(uploadedFilePreview);
            setUploadedFilePreview('');
        }
    };
    
    function functionType() {
        if (!currentUser) {
            toast.error(translations.errorLoginRequired);
            return;
        }
        
        switch (identifier) {
            case "Image":
            case "Video":
                inputRef.current?.click();
                break;
            default:
                // For non-upload backgrounds, update immediately
                toast.promise(handleUpdateTheme(), {
                    loading: 'Updating background...',
                    success: 'Background updated!',
                    error: (err) => err.message || 'Failed to update background'
                });
                break;
        }
    }
    
    const toasthandler = () => {
        if (!currentUser) {
            toast.error(translations.errorLoginRequired);
            return;
        }
        
        const promise = handlePickingProcess();
        toast.promise(promise, {
            loading: translations.toastLoading,
            success: translations.toastSuccess,
            error: (err) => err.message || translations.toastError
        });
    };
    
    // Initial data fetch
    useEffect(() => {
        if (currentUser) {
            fetchCurrentBackgroundType();
        }
    }, [identifier, currentUser]);

    // Cleanup preview URL
    useEffect(() => {
        return () => {
            if (uploadedFilePreview) {
                URL.revokeObjectURL(uploadedFilePreview);
            }
        };
    }, [uploadedFilePreview]);

    if (!isInitialized || !currentUser) return null;

    return (
        <div className="min-w-[8rem] flex-1 items-center flex flex-col">
            <div 
                className={`w-full h-[13rem] relative ${
                    !colorValue && !backImg ? "border-dashed border-black" : ""
                } border rounded-lg hover:scale-105 active:scale-90 grid place-items-center cursor-pointer overflow-hidden transition-transform duration-200`} 
                onClick={functionType}
            >
                {isSelected && (
                    <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-[0.5] grid place-items-center z-10 text-white text-xl">
                        <FaCheck />
                    </div>
                )}
                
                {colorValue ? (
                    <div className="h-full w-full" style={{ backgroundColor: colorValue }}></div>
                ) : backImg ? (
                    <div className="h-full w-full bg-cover bg-no-repeat" style={{ backgroundImage: backImg }}></div>
                ) : (
                    <div className="h-full w-full grid place-items-center">
                        {identifier === "Image" && (
                            <input 
                                type="file" 
                                className="absolute opacity-0 pointer-events-none" 
                                ref={inputRef} 
                                accept="image/*" 
                                onChange={handleFileChange} 
                            />
                        )}
                        {identifier === "Video" && (
                            <input 
                                type="file" 
                                className="absolute opacity-0 pointer-events-none" 
                                ref={inputRef} 
                                accept="video/*" 
                                onChange={handleFileChange} 
                            />
                        )}
                        <div className="bg-black bg-opacity-[0.1] rounded-lg p-1">
                            <Image 
                                src={"https://linktree.sirv.com/Images/icons/image.svg"} 
                                alt={translations.altUploadIcon} 
                                height={27} 
                                width={27} 
                            />
                        </div>
                    </div>
                )}
            </div>
            <span className="py-3 text-sm">{text}</span>
            
            {/* Preview Modal */}
            {previewing && (
                <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                    <div 
                        className="absolute h-full w-full bg-black bg-opacity-[0.25] backdrop-blur-[1px] top-0 left-0 p-2" 
                        onClick={handleReset}
                    ></div>
                    <form ref={formRef} className="relative z-10 sm:max-w-[30rem] max-w-18 max-h-[80vh] overflow-hidden p-4">
                        <div className="w-full scale-[0.95] relative overflow-hidden place-items-center grid aspect-square bg-white">
                            {identifier === "Image" && (
                                <Image 
                                    src={uploadedFilePreview} 
                                    alt={translations.altPreview} 
                                    height={1000} 
                                    width={1000} 
                                    priority 
                                    className="min-w-[10rem] w-full object-contain min-h-full" 
                                />
                            )}
                            {identifier === "Video" && (
                                <video 
                                    className="min-w-[10rem] w-full object-contain min-h-full" 
                                    controls 
                                    autoPlay 
                                    loop
                                >
                                    <source src={uploadedFilePreview} type={uploadedFile?.type || 'video/mp4'} />
                                    {translations.videoFallback}
                                </video>
                            )}
                            {isLoading && (
                                <div className="absolute z-10 h-full w-full scale-110 grid place-items-center bg-black bg-opacity-[0.25] mix-blend-screen">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        {!isLoading && (
                            <>
                                <div 
                                    className="absolute top-2 right-2 rounded-full p-2 hover:bg-red-500 active:scale-90 bg-black text-white text-sm cursor-pointer" 
                                    onClick={handleReset}
                                >
                                    <FaX />
                                </div>
                                <div 
                                    className="p-3 text-lg text-white bg-btnPrimary w-fit rounded-full mx-auto active:bg-btnPrimaryAlt active:scale-90 hover:scale-110 cursor-pointer my-3" 
                                    onClick={toasthandler}
                                >
                                    <FaCheck />
                                </div>
                            </>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}