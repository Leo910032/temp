import { fireApp } from "@/important/firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";

export async function updateLinks(arrayOfLinks, userId) {
    // Validate that a userId was provided
    if (!userId) {
        throw new Error("User not authenticated. Cannot update links.");
    }

    try {
        const AccountDocRef = collection(fireApp, "AccountData");
        // Use the provided userId instead of fetching from a session
        const docRef = doc(AccountDocRef, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // If the document exists, merge new links with existing data to prevent overwriting other fields
            const previousData = docSnap.data();
            const objectToUpdate = { ...previousData, links: arrayOfLinks };
            await setDoc(docRef, objectToUpdate);
        } else {
            // If the document doesn't exist, create it with the links array
            // NOTE: This now correctly uses setDoc to create a document with the specific userId
            await setDoc(docRef, { links: arrayOfLinks });
        }
    } catch (error) {
        console.error("Error updating links:", error);
        throw new Error("Could not update links in the database.");
    }
}