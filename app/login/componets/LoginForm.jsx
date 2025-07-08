"use client"
import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { collection, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";

export default function LoginForm() {
    const router = useRouter();
    const { signInWithUsername, signInWithGoogle } = useAuth();

    const [seePassword, setSeePassword] = useState(true);
    const [username, setUsername] = useState("");
    const [existingUsernames, setExistingUsernames] = useState([]);
    const [password, setPassword] = useState("");
    const [canProceed, setCanProceed] = useState(false);

    const debounceUsername = useDebounce(username, 500);
    const debouncePassword = useDebounce(password, 500);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    
    const [hasError, setHasError] = useState({
        username: 0,
        password: 0,
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;
        
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            const result = await signInWithUsername(debounceUsername.trimEnd(), debouncePassword);
            
            toast.success("Login Successful");
            
            setTimeout(() => {
                setCanProceed(false);
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Login error:", error);
            setHasError({ ...hasError, password: 1 });
            setPassword("");
            setErrorMessage(error.message || "Invalid username or password!");
            toast.error("Invalid Login credentials!");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        if (isGoogleLoading) return;
        
        setIsGoogleLoading(true);
        setErrorMessage("");
        
        try {
            await signInWithGoogle();
            toast.success("Google Sign-in Successful");
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Google sign-in error:", error);
            setErrorMessage(error.message || "Google sign-in failed!");
            toast.error("Google sign-in failed!");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    useEffect(() => {
        function fetchExistingUsername() {
            const existingUsernames = [];
        
            const collectionRef = collection(fireApp, "accounts");
            
            onSnapshot(collectionRef, (querySnapshot) => {
                querySnapshot.forEach((credential) => {
                    const data = credential.data();
                    const { username } = data;
                    if (username) {
                        existingUsernames.push(username.toLowerCase());
                    }
                });
                
                setExistingUsernames(existingUsernames);
            });
        }

        fetchExistingUsername();
    }, []);

    useEffect(() => {
        if (debounceUsername !== "") {
            if (!existingUsernames.includes(String(debounceUsername).toLowerCase())) {
                setHasError((prevData) => ({ ...prevData, username: 1 }));
                setErrorMessage("This username is not registered to any user.");
                return;
            }
            
            setHasError((prevData) => ({ ...prevData, username: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, username: 0 }));
        }
    }, [debounceUsername, existingUsernames]);

    useEffect(() => {
        if (debouncePassword !== "") {
            setHasError((prevData) => ({ ...prevData, password: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, password: 0 }));
        }
    }, [debouncePassword]);

    useEffect(() => {
        if (hasError.username <= 1) {
            setCanProceed(false);
            return;
        }
        
        if (hasError.password <= 1) {
            setCanProceed(false);
            return;
        }

        setCanProceed(true);
        setErrorMessage("");
    }, [hasError]);
    
    return (
        <div className="flex-1 sm:p-12 px-4 py-8 flex flex-col overflow-y-auto">
            <Link href={'/'} className="sm:p-0 p-3 w-fit">
                <Image src={"https://linktree.sirv.com/Images/full-logo.svg"} alt="logo" height={150} width={100} className="w-[7.05rem]" />
            </Link>
            <section className="mx-auto py-10 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">Log in to your Linktree</p>
                
                <form className="py-8 sm:py-12 flex flex-col gap-4 sm:gap-6 w-full" onSubmit={handleSubmit}>
                    <div className={`flex items-center py-2 sm:py-3 px-2 sm:px-6 rounded-md myInput ${hasError.username === 1 ? "hasError" : hasError.username === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <label className="opacity-40">mylinktree/</label>
                        <input
                            type="text"
                            placeholder="fabiconcept"
                            className="outline-none border-none bg-transparent ml-1 py-3 flex-1 text-sm sm:text-base"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isLoading || isGoogleLoading}
                        />
                        {hasError.username === 1 ?
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setUsername("")} />
                            :
                            hasError.username === 2 ?
                                <FaCheck className="text-themeGreen cursor-pointer" />
                                :
                                ""
                        }
                    </div>
                    
                    <div className={`flex items-center relative py-2 sm:py-3 px-2 sm:px-6 rounded-md  ${hasError.password === 1 ? "hasError": hasError.password === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={`${seePassword ? "password": "text"}`}
                            placeholder="Password"
                            className="peer outline-none border-none bg-transparent py-3 ml-1 flex-1 text-sm sm:text-base"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading || isGoogleLoading}
                        />
                        {seePassword && <FaEyeSlash className="opacity-60 cursor-pointer" onClick={() => setSeePassword(!seePassword)} />}
                        {!seePassword && <FaEye className="opacity-60 cursor-pointer text-themeGreen" onClick={() => setSeePassword(!seePassword)} />}
                    </div>

                    <Link href={"/forgot-password"} className="w-fit hover:rotate-2 hover:text-themeGreen origin-left">Forgot your password?</Link>

                    <button 
                        type="submit" 
                        disabled={!canProceed || isLoading || isGoogleLoading}
                        className={`rounded-md py-4 sm:py-5 grid place-items-center font-semibold ${canProceed && !isLoading && !isGoogleLoading ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" : "cursor-default opacity-50"}`}
                    >
                        {!isLoading && <span className="nopointer">Sign In</span>}
                        {isLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className=" mix-blend-screen" />}
                    </button>

                    {/* Google Sign In Button */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-gray-500">Or</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading || isGoogleLoading}
                        className={`flex items-center justify-center gap-3 py-4 sm:py-5 rounded-md border border-gray-300 font-semibold ${!isLoading && !isGoogleLoading ? "cursor-pointer hover:bg-gray-50 active:scale-95" : "cursor-default opacity-50"}`}
                    >
                        {!isGoogleLoading && (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                <span>Continue with Google</span>
                            </>
                        )}
                        {isGoogleLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" />}
                    </button>

                    {!isLoading && !isGoogleLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center">{errorMessage}</span>
                    )}
                </form>
                
                <p className="text-center sm:text-base text-sm">
                    <span className="opacity-60">Don&apos;t have an account?</span> 
                    <Link href={"/signup"} className="text-themeGreen ml-1">Sign up</Link>
                </p>
            </section>
        </div>
    )
}