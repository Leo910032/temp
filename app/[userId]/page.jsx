import { fireApp } from "@/important/firebase";
import { collection, doc, getDoc, query, where, getDocs } from "firebase/firestore";
import House from "./House";
import Filter from "bad-words"
import { Toaster } from "react-hot-toast";
import { notFound } from 'next/navigation';

export async function generateMetadata({ params: { userId } }) {
    try {
        const filter = new Filter();
        
        // Look up user by username first
        const accountsRef = collection(fireApp, "AccountData");
        const q = query(accountsRef, where("username", "==", userId.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        let actualUserId = null;
        
        if (!querySnapshot.empty) {
            // Found user by username
            actualUserId = querySnapshot.docs[0].id;
        } else {
            // If not found by username, try direct Firebase Auth UID lookup
            const docRef = doc(fireApp, "AccountData", userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                actualUserId = userId;
            }
        }
        
        if (!actualUserId) {
            notFound();
        }
        
        // Get user data with the found user ID
        const docRef = doc(fireApp, "AccountData", actualUserId);
        const docSnap = await getDoc(docRef);
    
        if (docSnap.exists()) {
            const { metaData, displayName, username } = docSnap.data();
            
            return ({
                title: metaData && metaData.title ? filter.clean(metaData.title) : `@${username || userId} Landing Page`,
                description: metaData && metaData.description ? filter.clean(metaData.description) : `Check out ${displayName || username || userId}'s links`,
            });
        } else {
            notFound();
        }
    } catch (error) {
        console.error("Error generating metadata:", error);
        notFound();
    }
}

export default function UserLinksPage({ params: { userId } }) {
    return (
        <div className="w-screen h-screen flex flex-col">
            <Toaster />
            <House userId={userId} />
        </div>
    );
}