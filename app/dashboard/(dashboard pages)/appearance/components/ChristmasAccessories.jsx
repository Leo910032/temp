"use client"
import { useAuth } from "@/contexts/AuthContext";
import { updateChristmasAccessory } from "@/lib/update data/updateChristmasAccessory";
import AssestCardVideo from "../elements/AssestCardVideo";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ChristmasAccessories() {
    const { currentUser } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleAccessoryClick = async (accessoryType) => {
        if (!currentUser || isUpdating) return;

        try {
            setIsUpdating(true);
            await updateChristmasAccessory(accessoryType, currentUser.uid);
            toast.success(`${accessoryType} applied!`);
        } catch (error) {
            console.error("Error updating Christmas accessory:", error);
            toast.error("Failed to apply accessory");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                <AssestCardVideo 
                    coverImg={"https://linktree.sirv.com/Images/Christmas/videoframe_1211.png"} 
                    src={"https://linktree.sirv.com/Images/Christmas/Snow_Falling_Animation_Black_and_Green_Screen_Background.mp4"} 
                    type={"video/mp4"} 
                    text={"Snow Fall"}
                    onClick={() => handleAccessoryClick("Snow Fall")}
                    disabled={isUpdating}
                />
                {/* Add more Christmas accessories here */}
            </div>
        </div>
    )
}