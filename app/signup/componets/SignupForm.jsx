// SignUpForm.jsx - Complete Code with Translation Support
"use client"
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT
import { validateEmail, validatePassword } from "@/lib/utilities";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // ADD useSearchParams
import { useEffect, useState, useMemo, Suspense } from "react"; // ADD useMemo and Suspense
import toast from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";
import { collection, query, where, getDocs } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

function SignUpFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get('returnTo') || '/dashboard'; // ADD RETURN URL SUPPORT
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const { signup, signInWithGoogle, signInWithMicrosoft, signInWithApple, loading: authLoading } = useAuth();
    const [seePassword, setSeePassword] = useState(true);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [hasError, setHasError] = useState({
        username: 0,
        email: 0,
        password: 0,
    });
    const [canProceed, setCanProceed] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStates, setLoadingStates] = useState({
        google: false,
        microsoft: false,
        apple: false
    });
    const debouncedUsername = useDebounce(username, 500);
    const debouncedPassword = useDebounce(password, 500);
    const debouncedEmail = useDebounce(email, 500);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('signup.title'),
            usernamePlaceholder: t('signup.username_placeholder'),
            emailPlaceholder: t('signup.email_placeholder'),
            passwordPlaceholder: t('signup.password_placeholder'),
            createAccount: t('signup.create_account'),
            orContinueWith: t('signup.or_continue_with'),
            google: t('signup.google'),
            microsoft: t('signup.microsoft'),
            apple: t('signup.apple'),
            alreadyHaveAccount: t('signup.already_have_account'),
            login: t('signup.login'),
            // Error messages
            usernameTooShort: t('signup.errors.username_too_short'),
            invalidUsernameFormat: t('signup.errors.invalid_username_format'),
            usernameTaken: t('signup.errors.username_taken'),
            invalidEmailFormat: t('signup.errors.invalid_email_format'),
            emailAlreadyInUse: t('signup.errors.email_already_in_use'),
            weakPassword: t('signup.errors.weak_password'),
            somethingWentWrong: t('signup.errors.something_went_wrong'),
            errorCheckingUsername: t('signup.errors.error_checking_username'),
            // Success messages
            accountCreatedSuccess: t('signup.success.account_created'),
            signedInWithGoogle: t('signup.success.signed_in_with_google'),
            signedInWithMicrosoft: t('signup.success.signed_in_with_microsoft'),
            signedInWithApple: t('signup.success.signed_in_with_apple'),
            // Loading messages
            loading: t('common.loading'),
            // Return URL message
            redirectMessage: t('signup.redirect_message')
        };
    }, [t, isInitialized]);

    // Helper function to check if username exists
    const checkUsernameExists = async (username) => {
        try {
            const accountsRef = collection(fireApp, "AccountData");
            const q = query(accountsRef, where("username", "==", username.toLowerCase()));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
        } catch (error) {
            console.error("Error checking username:", error);
            throw error;
        }
    };

    const handleSubmit = async(e) => {
        e.preventDefault();

        if (!canProceed || isLoading || authLoading) {
            return;
        }
        
        setIsLoading(true);

        try {
            // Create user with Firebase Auth
            await signup(email, password, username);
            
            // Success - user is automatically signed in
            toast.success(translations.accountCreatedSuccess);
            
            setTimeout(() => {
                console.log('🔄 Redirecting to:', returnTo);
                router.push(returnTo);
            }, 1000);
        } catch (error) {
            setIsLoading(false);
            setCanProceed(false);
            
            // Handle Firebase Auth specific errors
            let errorMsg = translations.somethingWentWrong;
            
            if (error.code === 'auth/email-already-in-use') {
                errorMsg = translations.emailAlreadyInUse;
                setHasError((prevData) => ({ ...prevData, email: 1 }));
            } else if (error.code === 'auth/weak-password') {
                errorMsg = translations.weakPassword;
                setHasError((prevData) => ({ ...prevData, password: 1 }));
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = translations.invalidEmailFormat;
                setHasError((prevData) => ({ ...prevData, email: 1 }));
            } else if (error.message === "Username already exists") {
                errorMsg = translations.usernameTaken;
                setHasError((prevData) => ({ ...prevData, username: 1 }));
            }
            
            setErrorMessage(errorMsg);
            console.error("Signup error:", error);
            toast.error(errorMsg);
        }
    }

    const createAccountHandler = async (e) => {
        e.preventDefault();
        await handleSubmit(e);
    }

    // Google Sign In Handler
    const handleGoogleSignIn = async () => {
        if (loadingStates.google) return;
        
        setLoadingStates(prev => ({ ...prev, google: true }));
        setErrorMessage("");
        
        try {
            await signInWithGoogle();
            toast.success(translations.signedInWithGoogle);
            
            setTimeout(() => {
                console.log('🔄 Redirecting to:', returnTo);
                router.push(returnTo);
            }, 1000);
        } catch (error) {
            console.error("Google sign in error:", error);
            setErrorMessage(error.message || "Google sign-in failed!");
            toast.error("Failed to sign in with Google");
        } finally {
            setLoadingStates(prev => ({ ...prev, google: false }));
        }
    };

    // Microsoft Sign In Handler
    const handleMicrosoftSignIn = async () => {
        if (loadingStates.microsoft) return;
        
        setLoadingStates(prev => ({ ...prev, microsoft: true }));
        setErrorMessage("");
        
        try {
            await signInWithMicrosoft();
            toast.success(translations.signedInWithMicrosoft);
            
            setTimeout(() => {
                console.log('🔄 Redirecting to:', returnTo);
                router.push(returnTo);
            }, 1000);
        } catch (error) {
            console.error("Microsoft sign in error:", error);
            setErrorMessage(error.message || "Microsoft sign-in failed!");
            toast.error("Failed to sign in with Microsoft");
        } finally {
            setLoadingStates(prev => ({ ...prev, microsoft: false }));
        }
    };

    // Apple Sign In Handler
    const handleAppleSignIn = async () => {
        if (loadingStates.apple) return;
        
        setLoadingStates(prev => ({ ...prev, apple: true }));
        setErrorMessage("");
        
        try {
            await signInWithApple();
            toast.success(translations.signedInWithApple);
            
            setTimeout(() => {
                console.log('🔄 Redirecting to:', returnTo);
                router.push(returnTo);
            }, 1000);
        } catch (error) {
            console.error("Apple sign in error:", error);
            setErrorMessage(error.message || "Apple sign-in failed!");
            toast.error("Failed to sign in with Apple");
        } finally {
            setLoadingStates(prev => ({ ...prev, apple: false }));
        }
    };

    const isAnyLoading = isLoading || authLoading || Object.values(loadingStates).some(Boolean);

    // Username validation
    useEffect(() => {
        if (debouncedUsername !== "") {
            if (String(debouncedUsername).length < 3) {
                setHasError((prevData) => ({ ...prevData, username: 1 }));
                setErrorMessage(translations.usernameTooShort);
                return;
            }

            if (/[^a-zA-Z0-9\-_]/.test(debouncedUsername)) {
                setHasError((prevData) => ({ ...prevData, username: 1 }));
                setErrorMessage(translations.invalidUsernameFormat);
                return;
            }

            const checkUsername = async () => {
                try {
                    const exists = await checkUsernameExists(debouncedUsername);
                    if (exists) {
                        setHasError((prevData) => ({ ...prevData, username: 1 }));
                        setErrorMessage(translations.usernameTaken);
                    } else {
                        setHasError((prevData) => ({ ...prevData, username: 2 }));
                    }
                } catch (error) {
                    setHasError((prevData) => ({ ...prevData, username: 1 }));
                    setErrorMessage(translations.errorCheckingUsername);
                }
            };

            checkUsername();
        } else {
            setHasError((prevData) => ({ ...prevData, username: 0 }));
        }
    }, [debouncedUsername, translations]);

    // Email validation
    useEffect(() => {
        if (debouncedEmail !== "") {
            if (!validateEmail(debouncedEmail)) {
                setHasError((prevData) => ({ ...prevData, email: 1 }));
                setErrorMessage(translations.invalidEmailFormat);
                return;
            }

            setHasError((prevData) => ({ ...prevData, email: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, email: 0 }));
        }
    }, [debouncedEmail, translations]);

    // Password validation
    useEffect(() => {
        if (debouncedPassword !== "") {
            if (typeof (validatePassword(debouncedPassword)) !== "boolean") {
                setHasError((prevData) => ({ ...prevData, password: 1 }));
                setErrorMessage(validatePassword(debouncedPassword));
                return;
            }

            setHasError((prevData) => ({ ...prevData, password: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, password: 0 }));
        }
    }, [debouncedPassword]);

    // Get username from URL params
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const usernameParam = urlParams.get('username');
        if (usernameParam) {
            setUsername(usernameParam);
        }
    }, []);

    // Check if form can proceed
    useEffect(() => {
        if (hasError.email <= 1 || hasError.username <= 1 || hasError.password <= 1) {
            setCanProceed(false);
            return;
        }

        setCanProceed(true);
        setErrorMessage("");
    }, [hasError]);

    // WAIT FOR TRANSLATIONS TO LOAD
    if (!isInitialized) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3 w-fit">
                    <div className="w-28 h-8 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mx-auto mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
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
                
                {/* RETURN URL MESSAGE */}
                {returnTo !== '/dashboard' && (
                    <p className="text-center text-blue-600 mt-2 text-sm">
                        {translations.redirectMessage}
                    </p>
                )}
                
                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={createAccountHandler}>
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
                    <div className={`flex items-center py-1 sm:py-2 px-2 sm:px-6 rounded-md myInput ${hasError.email === 1 ? "hasError" : hasError.email === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <input
                            type="email"
                            placeholder={translations.emailPlaceholder}
                            className="outline-none border-none bg-transparent ml-1 py-2 flex-1 text-sm sm:text-base"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isAnyLoading}
                        />
                        {hasError.email === 1 ? <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setEmail("")} /> : hasError.email === 2 ? <FaCheck className="text-themeGreen cursor-pointer" /> : ""}
                    </div>
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md  ${hasError.password === 1 ? "hasError" : hasError.password === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={`${seePassword ? "password" : "text"}`}
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
                    
                    <button type="submit" className={
                        `rounded-md py-3 sm:py-4 grid place-items-center font-semibold ${canProceed && !isAnyLoading ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" : "cursor-default opacity-50 "}`
                    }>
                        {!isLoading && <span className="nopointer">{translations.createAccount}</span>}
                        {isLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className=" mix-blend-screen" />}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
                        <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">{translations.orContinueWith}</span></div>
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
                            ) : ( <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" /> )}
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
                                        <path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M13 1h10v10H13z"/><path fill="#7fba00" d="M1 13h10v10H1z"/><path fill="#ffb900" d="M13 13h10v10H13z"/>
                                    </svg>
                                    <span className="hidden sm:inline">{translations.microsoft}</span>
                                </>
                            ) : ( <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" /> )}
                        </button>

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
                            ) : ( <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" /> )}
                        </button>
                        */}
                    </div>

                    {!isAnyLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center">{errorMessage}</span>
                    )}
                </form>
                
                <p className="text-center">
                    <span className="opacity-60">{translations.alreadyHaveAccount}</span> 
                    <Link className="text-themeGreen ml-1" href={`/login${returnTo !== '/dashboard' ? `?returnTo=${returnTo}` : ''}`}>{translations.login}</Link>
                </p>
            </section>
        </div>
    )
}

export default function SignUpForm() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignUpFormContent />
        </Suspense>
    );
}