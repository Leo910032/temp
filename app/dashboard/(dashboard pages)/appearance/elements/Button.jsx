"use client"
import { updateThemeButton } from "@/lib/update data/updateTheme";
import { useAuth } from "@/contexts/AuthContext";

export default function Button({modifierClass, modifierStyles, type}) {
    const { currentUser } = useAuth();
    
    const handleUpdateTheme = async() => {
        if (!currentUser) {
            console.error("User not authenticated");
            return;
        }
        
        try {
            await updateThemeButton(type ? type : 0, currentUser.uid);
        } catch (error) {
            console.error("Error updating theme button:", error);
        }
    }
    
    return (
        <div 
            onClick={handleUpdateTheme}
            className={`${modifierClass} cursor-pointer hover:scale-105 active:scale-95 min-w-[30%] h-10 flex-1`}
            style={modifierStyles}
        ></div>
    );
}