"use client"
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { isAdmin } from "@/lib/adminAuth";
import { getAppearanceData } from "@/lib/services/appearanceService";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ProfileCard from "../NavComponents/ProfileCard";
import ShareCard from "../NavComponents/ShareCard";
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";

export const NavContext = React.createContext();

// ✅ GLOBAL CACHE: Store navbar data to prevent refetching
let globalNavDataCache = null;
let globalNavDataFetched = false;

export default function NavBar() {
    const router = usePathname();
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    const [activePage, setActivePage] = useState(0);
    const [profilePicture, setProfilePicture] = useState(null);
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [myLink, setMyLink] = useState("");
    const [showProfileCard, setShowProfileCard] = useState(false);
    const [showShareCard, setShowShareCard] = useState(false);
    const [isLoading, setIsLoading] = useState(!globalNavDataFetched);
    const profileCardRef = useRef(null);
    const shareCardRef = useRef(null);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            links: t('dashboard.navigation.links'),
            appearance: t('dashboard.navigation.appearance'),
            analytics: t('dashboard.navigation.analytics'),
            settings: t('dashboard.navigation.settings'),
            contacts: t('dashboard.navigation.contacts'),
            admin: t('dashboard.navigation.admin') || 'Admin Panel'
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Check if user is admin with proper email access
    const userIsAdmin = useMemo(() => {
        if (!currentUser?.email) {
            console.log('🔍 No user email available for admin check');
            return false;
        }
        
        const adminStatus = isAdmin(currentUser.email);
        console.log('🔍 Admin check:', {
            email: currentUser.email,
            isAdmin: adminStatus
        });
        
        return adminStatus;
    }, [currentUser?.email]);

    // ✅ PERSISTENT DATA FETCH: Use cache to prevent refetching
    const fetchUserData = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        
        // ✅ CHECK CACHE FIRST: Use cached data if available and not forcing refresh
        if (globalNavDataCache && !forceRefresh) {
            console.log('🔄 NavBar: Using cached data');
            updateNavbarState(globalNavDataCache);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        try {
            console.log('📥 NavBar: Fetching fresh data from server...');
            const data = await getAppearanceData();
            
            // ✅ CACHE DATA: Store globally for future use
            globalNavDataCache = {
                username: data.username || "",
                displayName: data.displayName || data.username || "",
                profilePhoto: data.profilePhoto || ""
            };
            globalNavDataFetched = true;
            
            updateNavbarState(globalNavDataCache);
            console.log('✅ NavBar: User data loaded and cached');
            
        } catch (error) {
            console.error('❌ NavBar: Failed to fetch user data:', error);
            
            // ✅ FALLBACK: Use email-based profile if fetch fails
            setProfilePicture(
                <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                    <span className="text-3xl font-semibold uppercase">
                        {currentUser.email ? currentUser.email.charAt(0) : 'U'}
                    </span>
                </div>
            );
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // ✅ HELPER: Update navbar state from data
    const updateNavbarState = useCallback((data) => {
        const newUsername = data.username || "";
        const newDisplayName = data.displayName || newUsername;
        const profilePhoto = data.profilePhoto || "";

        setUsername(newUsername);
        setDisplayName(newDisplayName);
        setMyLink(newUsername ? `https://mylinks.fabiconcept.online/${newUsername}` : "");

        // Set profile picture
        if (profilePhoto) {
            setProfilePicture(
                <Image
                    src={profilePhoto}
                    alt="profile"
                    height={1000}
                    width={1000}
                    className="min-w-full h-full object-cover"
                    priority
                />
            );
        } else {
            setProfilePicture(
                <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                    <span className="text-3xl font-semibold uppercase">
                        {newDisplayName ? newDisplayName.charAt(0) : (currentUser?.email ? currentUser.email.charAt(0) : 'U')}
                    </span>
                </div>
            );
        }
    }, [currentUser]);

    // ✅ LOAD DATA: Use cached data or fetch fresh
    useEffect(() => {
        if (currentUser && isInitialized) {
            if (globalNavDataCache) {
                // Use cached data immediately
                console.log('⚡ NavBar: Using cached data on mount');
                updateNavbarState(globalNavDataCache);
                setIsLoading(false);
            } else {
                // Fetch fresh data
                console.log('🚀 NavBar: No cache, fetching data...');
                fetchUserData();
            }
        } else if (!currentUser) {
            // Reset state and cache when user logs out
            console.log('👋 NavBar: User logged out, clearing state');
            globalNavDataCache = null;
            globalNavDataFetched = false;
            setUsername("");
            setDisplayName("");
            setMyLink("");
            setProfilePicture(null);
            setIsLoading(false);
        }
    }, [currentUser, isInitialized, fetchUserData, updateNavbarState]);

    const handleShowProfileCard = () => {
        if (username === "") return;
        setShowProfileCard(!showProfileCard);
        setShowShareCard(false);
    }

    const handleShowShareCard = () => {
        if (username === "") return;
        setShowShareCard(!showShareCard);
        setShowProfileCard(false);
    }

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileCardRef.current && !profileCardRef.current.contains(event.target)) {
                setShowProfileCard(false);
            }
        };
        if (showProfileCard) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showProfileCard]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (shareCardRef.current && !shareCardRef.current.contains(event.target)) {
                setShowShareCard(false);
            }
        };
        if (showShareCard) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showShareCard]);

    useEffect(() => {
        switch (router) {
            case "/dashboard": setActivePage(0); break;
            case "/dashboard/appearance": setActivePage(1); break;
            case "/dashboard/analytics": setActivePage(2); break;
            case "/dashboard/contacts": setActivePage(3); break;
            case "/dashboard/settings": setActivePage(4); break;
            case "/admin": 
            case "/admin/users": 
            case "/admin/analytics": setActivePage(5); break;
            default: setActivePage(0); break;
        }
    }, [router]);
    
    // While currentUser is loading, show minimal nav
    if (!currentUser) {
        return null;
    }

    // WAIT FOR TRANSLATIONS TO LOAD
    if (!isInitialized) {
        return (
            <div className="w-full justify-between flex items-center rounded-[3rem] py-3 sticky top-0 z-[9999999999] px-3 mx-auto bg-white border backdrop-blur-lg">
                <div className="flex items-center gap-8">
                    <Link href={'/dashboard'} className="ml-3">
                        <Image src={"https://linktree.sirv.com/Images/logo-icon.svg"} alt="logo" height={23} width={23} className="" priority />
                    </Link>
                    <div className="hidden md:flex items-center gap-6">
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    // ✅ CONTEXT VALUE: Optimized with refresh capability
    const contextValue = useMemo(() => ({
        username,
        displayName,
        myLink,
        profilePicture,
        showProfileCard,
        setShowProfileCard,
        showShareCard,
        setShowShareCard,
        currentUser,
        refreshUserData: () => fetchUserData(true) // Allow manual refresh
    }), [username, displayName, myLink, profilePicture, showProfileCard, showShareCard, currentUser, fetchUserData]);
    
    return (
        <NavContext.Provider value={contextValue}>
            <div className="w-full justify-between flex items-center rounded-[3rem] py-3 sticky top-0 z-[9999999999] px-3 mx-auto bg-white border backdrop-blur-lg">
                <div className="flex items-center gap-8">
                    <Link href={'/dashboard'} className="ml-3">
                        <Image src={"https://linktree.sirv.com/Images/logo-icon.svg"} alt="logo" height={23} width={23} className="" priority />
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        <Link href={'/dashboard'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 0 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/links.svg"} alt="links" height={16} width={16} />
                            {translations.links}
                        </Link>
                        <Link href={'/dashboard/appearance'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 1 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/appearance.svg"} alt="links" height={16} width={16} />
                            {translations.appearance}
                        </Link>
                        <Link href={'/dashboard/analytics'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 2 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/analytics.svg"} alt="analytics" height={16} width={16} />
                            {translations.analytics}
                        </Link>
                        <Link href={'/dashboard/contacts'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 3 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {translations.contacts}
                        </Link>
                        <Link href={'/dashboard/settings'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 4 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/setting.svg"} alt="settings" height={16} width={16} />
                            {translations.settings}
                        </Link>
                        
                        {/* ✅ ADMIN PANEL BUTTON - Desktop Version */}
                        {userIsAdmin && (
                            <Link href={'/admin'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-red-100 hover:bg-opacity-75 rounded-lg text-sm font-semibold border border-red-200 ${activePage === 5 ? "bg-red-100 text-red-700 opacity-100" : "text-red-600 hover:text-red-700"}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                {translations.admin}
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* LANGUAGE SWITCHER */}
                    <LanguageSwitcher />
                    
                    {/* ✅ ADMIN PANEL BUTTON - Mobile Version */}
                    {userIsAdmin && (
                        <Link href={'/admin'} className="p-2 flex items-center relative gap-2 rounded-full border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 active:scale-90 overflow-hidden md:hidden">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </Link>
                    )}
                    
                    <div className="p-3 flex items-center relative gap-2 rounded-3xl border cursor-pointer hover:bg-gray-100 active:scale-90 overflow-hidden" ref={shareCardRef} onClick={handleShowShareCard}>
                        <Image src={"https://linktree.sirv.com/Images/icons/share.svg"} alt="links" height={15} width={15} />
                    </div>
                    <div className="relative" ref={profileCardRef}>
                        <div className="grid place-items-center relative rounded-full border h-[2.5rem] w-[2.5rem] cursor-pointer hover:scale-110 active:scale-95 overflow-hidden" onClick={handleShowProfileCard}>
                            <div className="absolute z-10 w-full h-full sm:block hidden"></div>
                            {isLoading ? (
                                <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-200 animate-pulse"></div>
                            ) : (
                                profilePicture
                            )}
                        </div>
                        <ProfileCard />
                        <ShareCard />
                    </div>
                </div>
            </div>
            
            {/* ✅ MOBILE NAVIGATION - Bottom bar */}
            <div className="flex justify-between py-2 px-4 m-2 rounded-xl bg-white sm:hidden">
                <Link href={'/dashboard'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 0 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/links.svg"} alt="links" height={16} width={16} />
                    {translations.links}
                </Link>
                <Link href={'/dashboard/appearance'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 1 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/appearance.svg"} alt="appearance" height={16} width={16} />
                    {translations.appearance}
                </Link>
                <Link href={'/dashboard/contacts'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 3 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/contacts.svg"} alt="contacts" height={16} width={16} />
                    {translations.contacts}
                </Link>
                <Link href={'/dashboard/settings'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 4 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/setting.svg"} alt="settings" height={16} width={16} />
                    {translations.settings}
                </Link>
            </div>
        </NavContext.Provider>
    );
}