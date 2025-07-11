// LoginForm.jsx - Complete Code with Translations
"use client"

import React, { useContext, useEffect, useState, useMemo } from "react";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD TRANSLATION IMPORT
import { collection, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";

export default function LoginForm() {
    const router = useRouter();
    const { login, signInWithGoogle, signInWithMicrosoft, signInWithApple } = useAuth();
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK

    const [seePassword, setSeePassword] = useState(true);
    const [username, setUsername] = useState("");
    const [existingUsernames, setExistingUsernames] = useState([]);
    const [password, setPassword] = useState("");
    const [canProceed, setCanProceed] = useState(false);

    const debounceUsername = useDebounce(username, 500);
    const debouncePassword = useDebounce(password, 500);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStates, setLoadingStates] = useState({
        google: false,
        microsoft: false,
        apple: false
    });
    const [errorMessage, setErrorMessage] = useState("");
    
    const [hasError, setHasError] = useState({
        username: 0,
        password: 0,
    });

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('login.title'),
            usernamePlaceholder: t('login.username_placeholder'),
            passwordPlaceholder: t('login.password_placeholder'),
            forgotPassword: t('login.forgot_password'),
            signIn: t('login.sign_in'),
            signUp: t('login.sign_up'),
            noAccount: t('login.no_account'),
            continueWith: t('login.continue_with'),
            google: t('login.google'),
            microsoft: t('login.microsoft'),
            apple: t('login.apple'),
            loginSuccessful: t('login.login_successful'),
            googleSignInSuccessful: t('login.google_signin_successful'),
            microsoftSignInSuccessful: t('login.microsoft_signin_successful'),
            appleSignInSuccessful: t('login.apple_signin_successful'),
            invalidCredentials: t('login.invalid_credentials'),
            googleSignInFailed: t('login.google_signin_failed'),
            microsoftSignInFailed: t('login.microsoft_signin_failed'),
            appleSignInFailed: t('login.apple_signin_failed'),
            usernameNotRegistered: t('login.username_not_registered'),
            loading: t('common.loading')
        };
    }, [t, isInitialized]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;
        
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            const result = await login(debounceUsername.trimEnd(), debouncePassword);
            
            toast.success(translations.loginSuccessful);
            
            setTimeout(() => {
                setCanProceed(false);
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Login error:", error);
            setHasError({ ...hasError, password: 1 });
            setPassword("");
            setErrorMessage(error.message || translations.invalidCredentials);
            toast.error(translations.invalidCredentials);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        if (loadingStates.google) return;
        
        setLoadingStates(prev => ({ ...prev, google: true }));
        setErrorMessage("");
        
        try {
            await signInWithGoogle();
            toast.success(translations.googleSignInSuccessful);
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Google sign-in error:", error);
            setErrorMessage(error.message || translations.googleSignInFailed);
            toast.error(translations.googleSignInFailed);
        } finally {
            setLoadingStates(prev => ({ ...prev, google: false }));
        }
    };

    /*
    const handleMicrosoftSignIn = async () => {
        if (loadingStates.microsoft) return;
        
        setLoadingStates(prev => ({ ...prev, microsoft: true }));
        setErrorMessage("");
        
        try {
            await signInWithMicrosoft();
            toast.success(translations.microsoftSignInSuccessful);
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Microsoft sign-in error:", error);
            setErrorMessage(error.message || translations.microsoftSignInFailed);
            toast.error(translations.microsoftSignInFailed);
        } finally {
            setLoadingStates(prev => ({ ...prev, microsoft: false }));
        }
    };
    */
    /*
    const handleAppleSignIn = async () => {
        if (loadingStates.apple) return;
        
        setLoadingStates(prev => ({ ...prev, apple: true }));
        setErrorMessage("");
        
        try {
            await signInWithApple();
            toast.success(translations.appleSignInSuccessful);
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Apple sign-in error:", error);
            setErrorMessage(error.message || translations.appleSignInFailed);
            toast.error(translations.appleSignInFailed);
        } finally {
            setLoadingStates(prev => ({ ...prev, apple: false }));
        }
    };*/

    const isAnyLoading = isLoading || Object.values(loadingStates).some(Boolean);

    useEffect(() => {
        function fetchExistingUsername() {
            const existingUsernames = [];
            const collectionRef = collection(fireApp, "AccountData");
            
            const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
                const usernames = [];
                querySnapshot.forEach((credential) => {
                    const { username } = credential.data();
                    if (username) {
                        usernames.push(username.toLowerCase());
                    }
                });
                setExistingUsernames(usernames);
            });

            return () => unsubscribe();
        }

        fetchExistingUsername();
    }, []);

    useEffect(() => {
        if (debounceUsername !== "") {
            if (!existingUsernames.includes(String(debounceUsername).toLowerCase())) {
                setHasError((prevData) => ({ ...prevData, username: 1 }));
                setErrorMessage(translations.usernameNotRegistered);
                return;
            }
            
            setHasError((prevData) => ({ ...prevData, username: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, username: 0 }));
        }
    }, [debounceUsername, existingUsernames, translations.usernameNotRegistered]);

    useEffect(() => {
        if (debouncePassword !== "") {
            setHasError((prevData) => ({ ...prevData, password: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, password: 0 }));
        }
    }, [debouncePassword]);

    useEffect(() => {
        if (hasError.username <= 1 || hasError.password <= 1) {
            setCanProceed(false);
            return;
        }

        setCanProceed(true);
        setErrorMessage("");
    }, [hasError]);

    // SHOW LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3 w-fit">
                    <div className="w-28 h-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="h-12 bg-gray-200 rounded animate-pulse mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                </section>
            </div>
        );
    }
    
    return (
        <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
            <Link href={'/'} className="sm:p-0 p-3 w-fit">
                <Image src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"} alt="logo" height={70} width={70} className="filter invert" priority />
            </Link>
            <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">{translations.title}</p>
                
                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                    <div className={`flex items-center py-1 sm:py-2 px-2 sm:px-6 rounded-md myInput ${hasError.username === 1 ? "hasError" : hasError.username === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <label className="opacity-40">mylinktree/</label>
                        <input
                            type="text"
                            placeholder={translations.usernamePlaceholder}
                            className="outline-none border-none bg-transparent ml-1 py-2 flex-1 text-sm sm:text-base"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isAnyLoading}
                        />
                        {hasError.username === 1 ? <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setUsername("")} /> : hasError.username === 2 ? <FaCheck className="text-themeGreen cursor-pointer" /> : ""}
                    </div>
                    
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md  ${hasError.password === 1 ? "hasError": hasError.password === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={`${seePassword ? "password": "text"}`}
                            placeholder={translations.passwordPlaceholder}
                            className="peer outline-none border-none bg-transparent py-2 ml-1 flex-1 text-sm sm:text-base"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isAnyLoading}
                        />
                        {seePassword && <FaEyeSlash className="opacity-60 cursor-pointer" onClick={() => setSeePassword(!seePassword)} />}
                        {!seePassword && <FaEye className="opacity-60 cursor-pointer text-themeGreen" onClick={() => setSeePassword(!seePassword)} />}
                    </div>

                    <Link href={"/forgot-password"} className="w-fit hover:rotate-2 hover:text-themeGreen origin-left">{translations.forgotPassword}</Link>

                    <button 
                        type="submit" 
                        disabled={!canProceed || isAnyLoading}
                        className={`rounded-md py-3 sm:py-4 grid place-items-center font-semibold ${canProceed && !isAnyLoading ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" : "cursor-default opacity-50"}`}
                    >
                        {!isLoading && <span className="nopointer">{translations.signIn}</span>}
                        {isLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className=" mix-blend-screen" />}
                    </button>

                    {/* Social Sign In Buttons */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
                        <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">{translations.continueWith}</span></div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isAnyLoading}
                            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-gray-300 font-semibold ${!isAnyLoading ? "cursor-pointer hover:bg-gray-50 active:scale-95" : "cursor-default opacity-50"}`}
                        >
                            {!loadingStates.google ? (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    <span>{translations.google}</span>
                                </>
                            ) : (
                                <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" />
                            )}
                        </button>
                        {/*
                        <button
                            type="button"
                            onClick={handleMicrosoftSignIn}
                            disabled={isAnyLoading}
                            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-gray-300 font-semibold ${!isAnyLoading ? "cursor-pointer hover:bg-gray-50 active:scale-95" : "cursor-default opacity-50"}`}
                        >
                            {!loadingStates.microsoft ? (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#f25022" d="M1 1h10v10H1z"/>
                                        <path fill="#00a4ef" d="M13 1h10v10H13z"/>
                                        <path fill="#7fba00" d="M1 13h10v10H1z"/>
                                        <path fill="#ffb900" d="M13 13h10v10H13z"/>
                                    </svg>
                                    <span className="hidden sm:inline">{translations.microsoft}</span>
                                </>
                            ) : (
                                <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" />
                            )}
                        </button>
                        */}
                       {/*
                        <button
                            type="button"
                            onClick={handleAppleSignIn}
                            disabled={isAnyLoading}
                            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-gray-300 font-semibold ${!isAnyLoading ? "cursor-pointer hover:bg-gray-50 active:scale-95" : "cursor-default opacity-50"}`}
                        >
                            {!loadingStates.apple ? (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.51-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                                    </svg>
                                    <span className="hidden sm:inline">{translations.apple}</span>
                                </>
                            ) : (
                                <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" />
                            )}
                        </button>
                        */}
                    </div>

                    {!isAnyLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center">{errorMessage}</span>
                    )}
                </form>
                
                <p className="text-center sm:text-base text-sm">
                    <span className="opacity-60">{translations.noAccount}</span> 
                    <Link href={"/signup"} className="text-themeGreen ml-1">{translations.signUp}</Link>
                </p>
            </section>
        </div>
    );
}