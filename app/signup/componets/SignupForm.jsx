"use client"
import { useDebounce } from "@/LocalHooks/useDebounce";
import { firebaseAuthService } from "@/lib/authentication/firebaseAuth";
import { getSessionCookie } from "@/lib/authentication/session";
import { validateEmail, validatePassword } from "@/lib/utilities";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";

export default function SignUpForm() {
    const router = useRouter();
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
    const debouncedUsername = useDebounce(username, 500);
    const debouncedPassword = useDebounce(password, 500);
    const debouncedEmail = useDebounce(email, 500);

    const handleSubmit = async(e) => {
        e.preventDefault();

        if (!canProceed || isLoading) {
            return;
        }
        
        setIsLoading(true);

        try {
            // Create user with Firebase Auth
            const user = await firebaseAuthService.createAccount(email, password, username);
            
            // Success - user is automatically signed in
            toast.success("Account created successfully!");
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
        } catch (error) {
            setIsLoading(false);
            setCanProceed(false);
            
            // Handle Firebase Auth specific errors
            let errorMsg = "Something went wrong";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMsg = "You already have an account with us!";
                setHasError((prevData) => ({ ...prevData, email: 1 }));
            } else if (error.code === 'auth/weak-password') {
                errorMsg = "Password is too weak";
                setHasError((prevData) => ({ ...prevData, password: 1 }));
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = "Invalid email format";
                setHasError((prevData) => ({ ...prevData, email: 1 }));
            } else if (error.message === "This username is already taken.") {
                errorMsg = error.message;
                setHasError((prevData) => ({ ...prevData, username: 1 }));
            }
            
            setErrorMessage(errorMsg);
            console.error("Signup error:", error);
        }
    }

    const createAccountHandler = (e) => {
        e.preventDefault();
        const promise = handleSubmit(e);
        toast.promise(
            promise,
            {
                loading: "Setting up your account...",
                error: "Couldn't complete registration",
                success: "Setup complete!",
            },
            {
                style: {
                    border: '1px solid #8129D9',
                    padding: '16px',
                    color: '#8129D9',
                },
                iconTheme: {
                    primary: '#8129D9',
                    secondary: '#FFFAEE',
                },
            }
        );
    }

    // Google Sign In Handler
    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            await firebaseAuthService.signInWithGoogle();
            toast.success("Signed in with Google!");
            router.push("/dashboard");
        } catch (error) {
            setIsLoading(false);
            console.error("Google sign in error:", error);
            toast.error("Failed to sign in with Google");
        }
    };

    // Username validation
    useEffect(() => {
        if (debouncedUsername !== "") {
            if (String(debouncedUsername).length < 3) {
                setHasError((prevData) => ({ ...prevData, username: 1 }));
                setErrorMessage("Username is too short.");
                return;
            }

            if (/[^a-zA-Z0-9\-_]/.test(debouncedUsername)) {
                setHasError((prevData) => ({ ...prevData, username: 1 }));
                setErrorMessage("Invalid username format");
                return;
            }

            // Check username availability with Firebase
            const checkUsername = async () => {
                try {
                    const exists = await firebaseAuthService.checkUsernameExists(debouncedUsername);
                    if (exists) {
                        setHasError((prevData) => ({ ...prevData, username: 1 }));
                        setErrorMessage("This username is already taken.");
                    } else {
                        setHasError((prevData) => ({ ...prevData, username: 2 }));
                    }
                } catch (error) {
                    console.error("Error checking username:", error);
                    setHasError((prevData) => ({ ...prevData, username: 1 }));
                    setErrorMessage("Error checking username availability");
                }
            };

            checkUsername();
        } else {
            setHasError((prevData) => ({ ...prevData, username: 0 }));
        }
    }, [debouncedUsername]);

    // Email validation
    useEffect(() => {
        if (debouncedEmail !== "") {
            if (!validateEmail(debouncedEmail)) {
                setHasError((prevData) => ({ ...prevData, email: 1 }));
                setErrorMessage("Invalid Email format!");
                return;
            }

            setHasError((prevData) => ({ ...prevData, email: 2 }));
            return;
        } else {
            setHasError((prevData) => ({ ...prevData, email: 0 }));
        }
    }, [debouncedEmail]);

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

    // Check for existing username from landing page
    useEffect(() => {
        const sessionUsername = getSessionCookie("username");
        if (sessionUsername !== undefined) {
            setUsername(sessionUsername);
        }
    }, []);

    // Check if form can proceed
    useEffect(() => {
        if (hasError.email <= 1) {
            setCanProceed(false);
            return;
        }

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
        <div className="flex-1 sm:p-12 py-8 p-2 flex flex-col overflow-y-auto">
            <Link href={'/'} className="sm:p-0 p-3 w-fit">
                <Image priority src={"https://linktree.sirv.com/Images/full-logo.svg"} alt="logo" height={150} width={100} className="w-[7.05rem]" />
            </Link>
            <section className="mx-auto py-10 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">Create your account</p>
                
                {/* Google Sign In Button */}
                <div className="py-4">
                    <button 
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-md hover:bg-gray-50 active:scale-95 disabled:opacity-50"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {isLoading ? "Signing in..." : "Continue with Google"}
                    </button>
                </div>

                <div className="text-center text-gray-500 py-2">or</div>

                <form className="py-8 sm:py-12 flex flex-col gap-4 sm:gap-6 w-full" onSubmit={createAccountHandler}>
                    <div className={`flex items-center py-2 sm:py-3 px-2 sm:px-6 rounded-md myInput ${hasError.username === 1 ? "hasError" : hasError.username === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <label className="opacity-40">mylinktree/</label>
                        <input
                            type="text"
                            placeholder="fabiconcept"
                            className="outline-none border-none bg-transparent ml-1 py-3 flex-1 text-sm sm:text-base"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
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
                    <div className={`flex items-center py-2 sm:py-3 px-2 sm:px-6 rounded-md myInput ${hasError.email === 1 ? "hasError" : hasError.email === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <input
                            type="email"
                            placeholder="Email"
                            className="outline-none border-none bg-transparent ml-1 py-3 flex-1 text-sm sm:text-base"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        {hasError.email === 1 ?
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setEmail("")} />
                            :
                            hasError.email === 2 ?
                                <FaCheck className="text-themeGreen cursor-pointer" />
                                :
                                ""
                        }
                    </div>
                    <div className={`flex items-center relative py-2 sm:py-3 px-2 sm:px-6 rounded-md  ${hasError.password === 1 ? "hasError" : hasError.password === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={`${seePassword ? "password" : "text"}`}
                            placeholder="Password"
                            className="peer outline-none border-none bg-transparent py-3 ml-1 flex-1 text-sm sm:text-base"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {seePassword && <FaEyeSlash className="opacity-60 cursor-pointer" onClick={() => setSeePassword(!seePassword)} />}
                        {!seePassword && <FaEye className="opacity-60 cursor-pointer text-themeGreen" onClick={() => setSeePassword(!seePassword)} />}
                    </div>
                    <button type="submit" className={
                        `rounded-md py-4 sm:py-5 grid place-items-center font-semibold ${canProceed ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" : "cursor-default opacity-50 "}`
                    }>
                        {!isLoading && <span className="nopointer">Create Account</span>}
                        {isLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className=" mix-blend-screen" />}
                    </button>

                    {!isLoading && <span className="text-sm text-red-500 text-center">{errorMessage}</span>}
                </form>
                <p className="text-center"><span className="opacity-60">Already have an account?</span> <Link className="text-themeGreen" href={"/login"}>Log in</Link> </p>
            </section>
        </div>
    )
}ay