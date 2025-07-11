"use client"
import { useAuth } from "@/contexts/AuthContext";
import { generateUniqueId } from "@/lib/utilities";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadBytes, getDownloadURL, ref } from "firebase/storage";
import { updateProfilePhoto } from "@/lib/update data/imageUpload";
import { FaCheck, FaX } from "react-icons/fa6";
import { appStorage, fireApp } from "@/important/firebase";
import { toast } from "react-hot-toast";
import { useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";

export default function ProfileImageManager() {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [uploadedPhoto, setUploadedPhoto] = useState('');
    const [uploadedPhotoPreview, setUploadedPhotoPreview] = useState('');
    const [profilePicture, setProfilePicture] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const inputRef = useRef();
    const formRef = useRef();

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) {
            return;
        }

        // Validate file type
        if (!selectedFile.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }

        // Validate file size (max 5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            return;
        }

        // Handle image preview
        const previewImageURL = URL.createObjectURL(selectedFile);
        setUploadedPhotoPreview(previewImageURL);
        setUploadedPhoto(selectedFile);
        setPreviewing(true);
    };

    const handleUploadPhoto = async () => {
        if (!uploadedPhoto || !currentUser) {
            throw new Error("No photo selected or user not authenticated");
        }

        try {
            // Create unique filename
            const fileExtension = uploadedPhoto.name.substring(uploadedPhoto.name.lastIndexOf('.') + 1);
            const fileName = `${generateUniqueId()}.${fileExtension}`;
            const storageRef = ref(appStorage, `profilePhoto/${fileName}`);

            // Upload file
            const snapshot = await uploadBytes(storageRef, uploadedPhoto);
            
            // Get download URL
            const photoUrl = await getDownloadURL(snapshot.ref);
            
            return photoUrl;
        } catch (error) {
            console.error("Upload error:", error);
            throw new Error("Failed to upload image: " + error.message);
        }
    }

    const handleUpdateUserInfo = async () => {
        if (!currentUser) {
            throw new Error("User not authenticated");
        }

        setIsLoading(true);
        try {
            const imageUrl = await handleUploadPhoto();
            await updateProfilePhoto(imageUrl, currentUser.uid); // Pass user ID
            
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
            toast.error("User not authenticated");
            return;
        }

        setIsRemoving(true);
        try {
            await updateProfilePhoto("", currentUser.uid); // Pass user ID
        } catch (error) {
            console.error("Remove profile error:", error);
            toast.error("Failed to remove profile picture");
        } finally {
            setIsRemoving(false);
        }
    }

    const toasthandler = () => {
        const promise = handleUpdateUserInfo();
        toast.promise(
            promise,
            {
                loading: "Setting new profile picture",
                success: "Profile Picture set",
                error: (err) => err.message || "An error occurred!"
            },
            {
                style: {
                    border: '1px solid #8129D9',
                    padding: '16px',
                    color: '#8129D9',
                },
                iconTheme: {
                    primary: '#8129D9',
                    secondary: '#FFFAEE',
                },
            }
        );
    }

    const handleReset = () => {
        if (isLoading) {
            return;
        }
        if (formRef.current) {
            formRef.current.reset();
        }
        setUploadedPhoto('');
        setPreviewing(false);
        
        // Clean up preview URL to prevent memory leaks
        if (uploadedPhotoPreview) {
            URL.revokeObjectURL(uploadedPhotoPreview);
            setUploadedPhotoPreview('');
        }
    }

    useEffect(() => {
        function fetchProfilePicture() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { profilePhoto, displayName } = docSnap.data();

                    if (profilePhoto && profilePhoto !== '') {
                        setProfilePicture(
                            <Image
                                src={profilePhoto}
                                alt="profile"
                                height={1000}
                                width={1000}
                                className="min-w-full h-full object-cover"
                                priority
                            />
                        );
                    } else {
                        setProfilePicture(
                            <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                                <span className="text-3xl font-semibold uppercase">
                                    {displayName ? displayName.split('')[0] : 
                                     currentUser.email ? currentUser.email.split('')[0] : 'U'}
                                </span>
                            </div>
                        );
                    }
                } else {
                    // Set default profile picture if document doesn't exist
                    setProfilePicture(
                        <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                            <span className="text-3xl font-semibold uppercase">
                                {currentUser.email ? currentUser.email.split('')[0] : 'U'}
                            </span>
                        </div>
                    );
                }
            }, (error) => {
                console.error("Error fetching profile picture:", error);
                // Set default on error
                setProfilePicture(
                    <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                        <span className="text-3xl font-semibold uppercase">
                            {currentUser.email ? currentUser.email.split('')[0] : 'U'}
                        </span>
                    </div>
                );
            });

            // Return cleanup function
            return unsubscribe;
        }

        const unsubscribe = fetchProfilePicture();
        
        // Cleanup subscription on unmount or currentUser change
        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [currentUser]); // Depend on currentUser

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (uploadedPhotoPreview) {
                URL.revokeObjectURL(uploadedPhotoPreview);
            }
        };
    }, [uploadedPhotoPreview]);

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

    return (
        <div className="flex w-full p-6 items-center gap-4">
            <div className="h-[6rem] w-[6rem] cursor-pointer rounded-full grid place-items-center border overflow-hidden" onClick={() => inputRef.current?.click()}>
                {profilePicture}
            </div>
            <div className="flex-1 grid gap-2 relative">
                <input 
                    type="file" 
                    className="absolute opacity-0 pointer-events-none" 
                    ref={inputRef} 
                    accept="image/*" 
                    onChange={handleFileChange} 
                />
                <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] bg-btnPrimary text-white w-full`} onClick={() => inputRef.current?.click()}>
                    Pick an image
                </div>
                <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl mix-blend-multiply cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] border w-full`} onClick={handleRemoveProfilePicture}>
                    {!isRemoving ?
                        "Remove" :
                        <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className="filter invert" />
                    }
                </div>
            </div>
            {previewing && <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                <div className="absolute h-full w-full bg-black bg-opacity-[0.25] backdrop-blur-[1px] top-0 left-0 p-2" onClick={handleReset}></div>
                <form ref={formRef} className="relative z-10 sm:max-w-[30rem] max-w-18 max-h-[80vh] overflow-hidden p-4">
                    <div className="w-full scale-[0.95] relative rounded-full overflow-hidden place-items-center grid aspect-square bg-white">
                        <Image src={uploadedPhotoPreview} alt="profile pic" height={1000} width={1000} priority className="min-w-[10rem] w-full object-cover min-h-full" />
                        {isLoading && <div className="absolute z-10 h-fullupdateProfilePhoto w-full scale-110 grid place-items-center bg-black bg-opacity-[0.25] mix-blend-screen">
                            <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={50} height={50} alt="loading" className="mix-blend-screen" />
                        </div>}
                    </div>
                    {!isLoading && <div className="absolute top-2 right-2 rounded-full p-2 hover:bg-red-500 active:scale-90 bg-black text-white text-sm cursor-pointer" onClick={handleReset}>
                        <FaX />
                    </div>}
                    {!isLoading && <div className="p-3 text-lg text-white bg-btnPrimary w-fit rounded-full mx-auto active:bg-btnPrimaryAlt active:scale-90 hover:scale-110 cursor-pointer my-3" onClick={toasthandler}>
                        <FaCheck />
                    </div>}
                </form>
            </div>}
        </div>
    );
}