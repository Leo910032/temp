"use client"
import { useContext, useMemo } from "react";
import { HouseContext } from "../House";
import Button from "../elements/Button";
import Socials from "../elements/Socials";
import { filterProperly } from "@/lib/utilities";

export default function MyLinks() {
    const { userData } = useContext(HouseContext);
    const {
        links = [],
        socials = [],
        socialPosition = 0,
        supportBannerStatus = false,
        themeFontColor = "",
        themeTextColour = "",
        sensitiveStatus = false
    } = userData;

    const displayLinks = useMemo(() =>
        links.filter((link) => link.isActive !== false),
        [links]
    );

    const displayColor = themeFontColor === "#000" ? themeTextColour : themeFontColor;

    return (
        <div className={`flex flex-col gap-4 my-4 w-full px-5 py-1 items-center max-h-fit ${supportBannerStatus ? "pb-12" : ""}`}>
            {socialPosition === 0 && socials.length > 0 && <Socials />}
            {displayLinks.map((link) => {
                if (link.type === 0) { // Header type
                    return (
                        <span key={link.id} style={{ color: displayColor }} className="mx-auto font-semibold text-sm mt-2">
                            {sensitiveStatus ? link.title : filterProperly(link.title)}
                        </span>
                    );
                } else { // Button type
                    return (
                        <Button
                            key={link.id}
                            linkData={link}
                            content={sensitiveStatus ? link.title : filterProperly(link.title)}
                        />
                    );
                }
            })}
            {socialPosition === 1 && socials.length > 0 && <Socials />}
        </div>
    );
}