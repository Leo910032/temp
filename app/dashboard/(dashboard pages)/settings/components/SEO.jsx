"use client"
import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateCustomMetaData } from "@/lib/update data/updateSocials";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function SEO() {
    const { currentUser } = useAuth(); // Get current user from Firebase Auth
    const [metaTitle, setMetaTitle] = useState(null);
    const [metaDescription, setMetaDescription] = useState(null);
    const debounceMetaTitle = useDebounce(metaTitle, 500);
    const debounceMetaDescription = useDebounce(metaDescription, 500);

    useEffect(() => {
        if (metaTitle === null) {
            return;
        }

        if (metaDescription === null) {
            return;
        }

        if (!currentUser) {
            return;
        }

        updateCustomMetaData({
            title: metaTitle,
            description: metaDescription,
        }, currentUser.uid); // Pass the Firebase Auth UID
    }, [debounceMetaTitle, debounceMetaDescription, currentUser]);

    useEffect(() => {
        function fetchLinks() {
            // Only fetch if user is authenticated
            if (!currentUser) return;

            const collectionRef = collection(fireApp, "AccountData");
            const docRef = doc(collectionRef, currentUser.uid); // Use Firebase Auth UID

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const { metaData } = docSnap.data();

                    if (metaData) {
                        setMetaTitle(metaData.title);
                        setMetaDescription(metaData.description);
                    } else {
                        setMetaTitle("");
                        setMetaDescription("");
                    }
                } else {
                    // Document doesn't exist, set empty values
                    setMetaTitle("");
                    setMetaDescription("");
                }
            }, (error) => {
                console.error("Error fetching metadata:", error);
                // Set empty values on error
                setMetaTitle("");
                setMetaDescription("");
            });

            // Return cleanup function
            return unsubscribe;
        }

        const unsubscribe = fetchLinks();
        
        // Cleanup on unmount or when currentUser changes
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [currentUser]);

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

    return (
        <div className="w-full my-4 px-2" id="Settings--SEO">
            <div className="flex items-center gap-3 py-4">
                <Image
                    src={"https://linktree.sirv.com/Images/icons/seo.svg"}
                    alt="icon"
                    height={24}
                    width={24}
                />
                <span className="text-xl font-semibold">SEO</span>
            </div>
            <div className="p-5 bg-white rounded-lg">
                <p className="font-semibold">Custom metadata</p>
                <p className="opacity-60 sm:text-base text-sm">Changes to metadata may take some time to appear on other platforms.</p>

                <div className="my-3 grid gap-3">
                    <div className="rounded-[10px] relative focus-within:ring-2 focus-within:ring-black transition duration-75 ease-out hover:shadow-[inset_0_0_0_2px_#e0e2d9] hover:focus-within:shadow-none bg-black bg-opacity-[0.025]">
                        <div className="flex rounded-[10px] leading-[48px] border-solid border-2 border-transparent">
                            <div className="flex w-full items-center bg-chalk rounded-sm px-3">
                                <div className="relative grow">
                                    <input
                                        placeholder="Meta title"
                                        className="placeholder-transparent font-semibold peer px-0 sm:text-base text-sm leading-[48px] placeholder:leading-[48px] rounded-xl block pt-6 pb-2 w-full bg-chalk text-black transition duration-75 ease-out !outline-none bg-transparent"
                                        type="text"
                                        value={metaTitle ? metaTitle : ""}
                                        onChange={(e) => setMetaTitle(e.target.value)}
                                    />
                                    <label
                                        className="absolute pointer-events-none text-base text-concrete transition-all transform -translate-y-2.5 scale-[0.85] top-[13px] origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-1 peer-placeholder-shown:tracking-normal peer-focus:scale-[0.85] peer-focus:-translate-y-2.5 max-w-[calc(100%-16px)] truncate"
                                    >
                                        Meta title
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
                                        placeholder="Meta description"
                                        className="placeholder-transparent font-semibold peer px-0 sm:text-base text-sm leading-[48px] placeholder:leading-[48px] rounded-xl block pt-6 pb-2 w-full bg-chalk text-black transition duration-75 ease-out !outline-none bg-transparent"
                                        type="text"
                                        value={metaDescription ? metaDescription : ""}
                                        onChange={(e) => setMetaDescription(e.target.value)}
                                    />
                                    <label
                                        className="absolute pointer-events-none text-base text-concrete transition-all transform -translate-y-2.5 scale-[0.85] top-[13px] origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-1 peer-placeholder-shown:tracking-normal peer-focus:scale-[0.85] peer-focus:-translate-y-2.5 max-w-[calc(100%-16px)] truncate"
                                    >
                                        Meta description
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