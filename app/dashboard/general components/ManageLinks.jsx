"use client"

import Image from "next/image";
import AddBtn from "../general elements/addBtn";
import DraggableList from "./Drag";
import React, { useEffect, useState } from "react";
import { generateRandomId } from "@/lib/utilities";
import { updateLinks } from "@/lib/update data/updateLinks";
import { useAuth } from "@/contexts/AuthContext"; // 1. Import the new useAuth hook
import { fireApp } from "@/important/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

export const ManageLinksContent = React.createContext();

export default function ManageLinks() {
    const { currentUser } = useAuth(); // 2. Get the current user from the context
    const [data, setData] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    const addItem = () => {
        const newItem = { id: `${generateRandomId()}`, title: "", isActive: true, type: 0 };
        setData(prevData => {
            return [newItem, ...prevData];
        });
    };
    
    // This useEffect handles SAVING data
    useEffect(() => {
        // Prevent running on initial load
        if (!hasLoaded) {
            return;
        }
        
        // 3. Only update if a user is logged in
        if (currentUser) {
            // 4. Pass the user's UID to the updated updateLinks function
            updateLinks(data, currentUser.uid);
        }
    }, [data, hasLoaded, currentUser]); // 5. Add currentUser to the dependency array

    // This useEffect handles FETCHING data
    useEffect(() => {
        // 6. Don't try to fetch data if there's no user
        if (!currentUser) {
            setData([]); // Clear data on logout
            return;
        }

        const collectionRef = collection(fireApp, "AccountData");
        // 7. Use the Firebase Auth UID to get the correct document
        const docRef = doc(collectionRef, currentUser.uid);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const { links } = docSnap.data();
                setData(links ? links : []);
            } else {
                // If the document doesn't exist, start with an empty array
                setData([]);
            }
            setHasLoaded(true);
        }, (error) => {
            console.error("Error fetching links:", error);
            setData([]); // Set to empty on error
            setHasLoaded(true);
        });

        // 8. Return the unsubscribe function for cleanup when the component unmounts or user changes
        return () => unsubscribe();
        
    }, [currentUser]); // 9. Rerun this effect when the user logs in or out

    return (
        <ManageLinksContent.Provider value={{ setData, data }}>
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1 transition-[min-height]">
                <AddBtn />

                <div className={`flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] border hover:bg-black hover:bg-opacity-[0.05] w-fit text-sm p-3 mt-3`} onClick={addItem}>
                    <>
                        <Image src={"https://linktree.sirv.com/Images/icons/add.svg"} alt="links" height={15} width={15} />
                        <span>Add Header</span>
                    </>
                </div>

                {data.length === 0 && (
                    <div className="p-6 flex-col gap-4 flex items-center justify-center opacity-30">
                        <Image
                            src={"https://linktree.sirv.com/Images/logo-icon.svg"}
                            alt="logo"
                            height={100}
                            width={100}
                            className="opacity-50 sm:w-24 w-16"
                        />
                        <span className="text-center sm:text-base text-sm max-w-[15rem] font-semibold">
                            Show the world who you are.
                            Add a link to get started.
                        </span>
                    </div>
                )}

                {data.length > 0 && <DraggableList array={data} />}
            </div>
        </ManageLinksContent.Provider>
    );
}