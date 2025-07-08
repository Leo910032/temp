import AssestCardVideo from "../elements/AssestCardVideo";

export default function ChristmasAccessories() {
    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                <AssestCardVideo 
                    coverImg={"https://linktree.sirv.com/Images/Christmas/videoframe_1211.png"} 
                    src={"https://linktree.sirv.com/Images/Christmas/Snow_Falling_Animation_Black_and_Green_Screen_Background.mp4"} 
                    type={"video/mp4"} 
                    text={"Snow Fall"}
                />
            </div>
        </div>
    )
}
