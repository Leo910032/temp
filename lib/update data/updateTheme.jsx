import { collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

/**
 * A generic helper function to update a user's theme data in Firestore.
 * This is not exported and is used internally by the other functions in this file.
 * @param {string} userId - The Firebase Auth UID of the user.
 * @param {object} dataToUpdate - An object containing the key-value pairs to update.
 */
async function updateUserThemeData(userId, dataToUpdate) {
    if (!userId) {
        console.error("Update failed: User ID is required.");
        throw new Error("User not authenticated.");
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        
        // Use updateDoc for efficiency, as it only modifies specified fields.
        // It will throw an error if the document doesn't exist, so we can
        // wrap it with a get/set for robustness if needed, but for theme
        // updates, the user document should always exist.
        await updateDoc(docRef, dataToUpdate);

    } catch (error) {
        // Fallback for if the document doesn't exist yet
        if (error.code === 'not-found') {
            try {
                const docRef = doc(fireApp, "AccountData", userId);
                await setDoc(docRef, dataToUpdate, { merge: true });
                return;
            } catch (set_error) {
                console.error("Error setting new theme data after update failed:", set_error);
                throw new Error(set_error.message || "An unexpected error occurred while setting theme.");
            }
        }
        console.error("Error updating theme data:", error);
        throw new Error(error.message || "An unexpected error occurred while updating theme.");
    }
}


export async function updateTheme(theme, themeColor, userId) {
    await updateUserThemeData(userId, { 
        selectedTheme: theme, 
        themeFontColor: themeColor 
    });
}

export async function updateThemeBackground(type, userId) {
    await updateUserThemeData(userId, { backgroundType: type });
}

export async function updateThemeBackgroundColor(color, userId) {
    await updateUserThemeData(userId, { backgroundColor: color });
}

export async function updateThemeBtnColor(color, userId) {
    await updateUserThemeData(userId, { btnColor: color });
}

export async function updateThemeBtnFontColor(color, userId) {
    await updateUserThemeData(userId, { btnFontColor: color });
}

export async function updateThemeBtnShadowColor(color, userId) {
    await updateUserThemeData(userId, { btnShadowColor: color });
}

export async function updateThemeTextColour(color, userId) {
    await updateUserThemeData(userId, { themeTextColour: color });
}

export async function updateThemeGradientDirection(direction, userId) {
    await updateUserThemeData(userId, { gradientDirection: direction });
}

export async function updateThemeButton(btn, userId) {
    await updateUserThemeData(userId, { btnType: btn });
}

export async function updateThemeFont(font, userId) {
    await updateUserThemeData(userId, { fontType: font });
}