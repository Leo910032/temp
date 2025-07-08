import Image from "next/image";
import "@/app/styles/MarioCloud.css"

export default function Mario() {
    return (
        <div className="fixed h-screen w-screen top-0 left-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0">
                <Image
                    src={"https://linktree.sirv.com/Images/Scene/Mario/mario-bg.jpg"}
                    alt="Mario Background"
                    width={6284}
                    height={3535}
                    className="min-w-screen max-h-screen min-h-screen h-screen object-cover"
                />
            </div>
            <Image
                src={"https://linktree.sirv.com/Images/Scene/Mario/mario.him.gif"}
                alt="Mario Him"
                width={650}
                height={660}
                className="absolute bottom-0 left-0 h-32 w-auto runMario object-contain"
            />

            <div id="clouds">
                <div class="cloud x1"></div>
                <div class="cloud x2"></div>
                <div class="cloud x3"></div>
                <div class="cloud x4"></div>
                <div class="cloud x5"></div>
            </div>
        </div>
    )
}