"use client"
import { useAuth } from "@/contexts/AuthContext";
import { generateUniqueId } from "@/lib/utilities";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo } from "react"; // ADD useMemo
import { uploadBytes, getDownloadURL, ref } from "firebase/storage";
import { updateProfilePhoto } from "@/lib/update data/imageUpload";
import { FaCheck, FaX } from "react-icons/fa6";
import { appStorage, fireApp } from "@/important/firebase";
import { toast } from "react-hot-toast";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT

export default function ProfileImageManager() {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [uploadedPhoto, setUploadedPhoto] = useState('');
    const [uploadedPhotoPreview, setUploadedPhotoPreview] = useState('');
    const [profilePicture, setProfilePicture] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const inputRef = useRef();
    const formRef = useRef();

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            pickImage: t('dashboard.appearance.profile.pick_image'),
            remove: t('dashboard.appearance.profile.remove_image'),
            altProfile: t('dashboard.appearance.profile.alt_profile'),
            altLoading: t('dashboard.appearance.profile.alt_loading'),
            errorSelectImage: t('dashboard.appearance.profile.error_select_image'),
            errorImageTooLarge: t('dashboard.appearance.profile.error_image_too_large'),
            errorNotAuth: t('dashboard.appearance.profile.error_not_authenticated'),
            errorUploadFailed: t('dashboard.appearance.profile.error_upload_failed'),
            errorRemoveFailed: t('dashboard.appearance.profile.error_remove_failed'),
            errorGeneric: t('dashboard.appearance.profile.error_generic'),
            toastLoading: t('dashboard.appearance.profile.toast_loading'),
            toastSuccess: t('dashboard.appearance.profile.toast_success'),
        };
    }, [t, isInitialized]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) {
            return;
        }
        if (!selectedFile.type.startsWith('image/')) {
            toast.error(translations.errorSelectImage);
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
            toast.error(translations.errorImageTooLarge);
            return;
        }
        const previewImageURL = URL.createObjectURL(selectedFile);
        setUploadedPhotoPreview(previewImageURL);
        setUploadedPhoto(selectedFile);
        setPreviewing(true);
    };

    const handleUploadPhoto = async () => {
        if (!uploadedPhoto || !currentUser) {
            throw new Error(translations.errorNotAuth);
        }
        try {
            const fileExtension = uploadedPhoto.name.substring(uploadedPhoto.name.lastIndexOf('.') + 1);
            const fileName = `${generateUniqueId()}.${fileExtension}`;
            const storageRef = ref(appStorage, `profilePhoto/${currentUser.uid}/${fileName}`);
            const snapshot = await uploadBytes(storageRef, uploadedPhoto);
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error("Upload error:", error);
            throw new Error(`${translations.errorUploadFailed}: ${error.message}`);
        }
    }

    const handleUpdateUserInfo = async () => {
        if (!currentUser) {
            throw new Error(translations.errorNotAuth);
        }
        setIsLoading(true);
        try {
            const imageUrl = await handleUploadPhoto();
            await updateProfilePhoto(imageUrl, currentUser.uid);
            handleReset();
        } catch (error) {
            console.error("Update profile error:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    const handleRemoveProfilePicture = async () => {
        if (!currentUser) {
            toast.error(translations.errorNotAuth);
            return;
        }
        setIsRemoving(true);
        try {
            await updateProfilePhoto("", currentUser.uid);
        } catch (error) {
            console.error("Remove profile error:", error);
            toast.error(translations.errorRemoveFailed);
        } finally {
            setIsRemoving(false);
        }
    }

    const toasthandler = () => {
        const promise = handleUpdateUserInfo();
        toast.promise(promise, {
            loading: translations.toastLoading,
            success: translations.toastSuccess,
            error: (err) => err.message || translations.errorGeneric
        }, { /* toast styles */ });
    }

    const handleReset = () => {
        if (isLoading) return;
        if (formRef.current) formRef.current.reset();
        setUploadedPhoto('');
        setPreviewing(false);
        if (uploadedPhotoPreview) {
            URL.revokeObjectURL(uploadedPhotoPreview);
            setUploadedPhotoPreview('');
        }
    }

    useEffect(() => {
        if (!currentUser) return;
        const docRef = doc(collection(fireApp, "AccountData"), currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            let pictureElement;
            if (docSnap.exists()) {
                const { profilePhoto, displayName } = docSnap.data();
                if (profilePhoto) {
                    pictureElement = <Image src={profilePhoto} alt={translations.altProfile || 'Profile'} height={1000} width={1000} className="min-w-full h-full object-cover" priority />;
                } else {
                    const initial = displayName?.[0] || currentUser.email?.[0] || 'U';
                    pictureElement = (
                        <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                            <span className="text-3xl font-semibold uppercase">{initial}</span>
                        </div>
                    );
                }
            } else {
                const initial = currentUser.email?.[0] || 'U';
                pictureElement = (
                    <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                        <span className="text-3xl font-semibold uppercase">{initial}</span>
                    </div>
                );
            }
            setProfilePicture(pictureElement);
        }, (error) => {
            console.error("Error fetching profile picture:", error);
        });
        return () => unsubscribe();
    }, [currentUser, translations.altProfile]);

    useEffect(() => {
        return () => {
            if (uploadedPhotoPreview) URL.revokeObjectURL(uploadedPhotoPreview);
        };
    }, [uploadedPhotoPreview]);

    // LOADING SKELETON
    if (!isInitialized || !currentUser) {
        return (
            <div className="flex w-full p-6 items-center gap-4 animate-pulse">
                <div className="h-[6rem] w-[6rem] rounded-full bg-gray-200"></div>
                <div className="flex-1 grid gap-2">
                    <div className="h-12 rounded-3xl bg-gray-200"></div>
                    <div className="h-12 rounded-3xl bg-gray-200"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full p-6 items-center gap-4">
            <div className="h-[6rem] w-[6rem] cursor-pointer rounded-full grid place-items-center border overflow-hidden" onClick={() => inputRef.current?.click()}>
                {profilePicture}
            </div>
            <div className="flex-1 grid gap-2 relative">
                <input type="file" className="absolute opacity-0 pointer-events-none" ref={inputRef} accept="image/*" onChange={handleFileChange} />
                <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] bg-btnPrimary text-white w-full`} onClick={() => inputRef.current?.click()}>
                    {translations.pickImage}
                </div>
                <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl mix-blend-multiply cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] border w-full`} onClick={handleRemoveProfilePicture}>
                    {!isRemoving ? translations.remove : <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt={translations.altLoading} className="filter invert" />}
                </div>
            </div>
            {previewing && <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                <div className="absolute h-full w-full bg-black bg-opacity-[0.25] backdrop-blur-[1px] top-0 left-0 p-2" onClick={handleReset}></div>
                <form ref={formRef} className="relative z-10 sm:max-w-[30rem] max-w-18 max-h-[80vh] overflow-hidden p-4">
                    <div className="w-full scale-[0.95] relative rounded-full overflow-hidden place-items-center grid aspect-square bg-white">
                        <Image src={uploadedPhotoPreview} alt={translations.altProfile} height={1000} width={1000} priority className="min-w-[10rem] w-full object-cover min-h-full" />
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