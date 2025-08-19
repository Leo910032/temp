"use client"
import { useState, useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// --- Main Page Component ---
export default function JoinTeamPage() {
    const { currentUser } = useAuth();
    
    // State to manage the multi-step flow
    const [step, setStep] = useState('enter_code'); // 'enter_code', 'review_invite', 'accepted'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State to hold invitation data
    const [inviteCode, setInviteCode] = useState('');
    const [inviteDetails, setInviteDetails] = useState(null);

    // --- API Handlers ---
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        if (!inviteCode) return;

        setIsLoading(true);
        setError(null);
        
        // This relies on the invited user knowing their own email.
        // A more advanced version could use a single verification endpoint.
        // For now, we prompt for the email if not logged in.
        let userEmail = currentUser?.email;
        if (!userEmail) {
            userEmail = prompt("Please enter the email address the invitation was sent to:");
            if (!userEmail) {
                setIsLoading(false);
                return;
            }
        }

        try {
            const response = await fetch(`/api/enterprise/invitations/verify/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: inviteCode, email: userEmail })
            });
            
            const result = await response.json();
            if (!response.ok || !result.valid) {
                throw new Error(result.error || 'Invalid invitation code or email.');
            }

            setInviteDetails(result.invitation);
            setStep('review_invite');
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptInvite = async () => {
        if (!currentUser) {
            toast.error("You must be logged in to accept an invitation.");
            // You could redirect to login here: router.push('/login?redirect=/join-team')
            return;
        }

        if (currentUser.email.toLowerCase() !== inviteDetails.email.toLowerCase()) {
            setError(`This invite is for ${inviteDetails.email}. You are logged in as ${currentUser.email}.`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/enterprise/invitations/accept', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ invitationId: inviteDetails.id })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Failed to accept invitation.");
            }
            
            toast.success("Welcome to the team!");
            setStep('accepted');
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render correct component based on the current step ---
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Join Your Team</h1>
                <div className="bg-white rounded-xl shadow-lg p-8">
                    {step === 'enter_code' && (
                        <EnterCodeForm 
                            inviteCode={inviteCode}
                            setInviteCode={setInviteCode}
                            onSubmit={handleVerifyCode}
                            isLoading={isLoading}
                            error={error}
                        />
                    )}
                    {step === 'review_invite' && (
                        <ReviewInvite
                            inviteDetails={inviteDetails}
                            onAccept={handleAcceptInvite}
                            currentUser={currentUser}
                            isLoading={isLoading}
                            error={error}
                        />
                    )}
                    {step === 'accepted' && (
                        <SuccessDisplay teamName={inviteDetails?.team.name} />
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sub-Component for Step 1: Entering the Code ---
function EnterCodeForm({ inviteCode, setInviteCode, onSubmit, isLoading, error }) {
    return (
        <form onSubmit={onSubmit}>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Enter Invitation Code</h2>
            <p className="text-sm text-gray-500 mb-6">Check your email for the 6-character code from your manager.</p>
            
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            
            <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700">Invitation Code</label>
                <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-lg tracking-[.2em]"
                    maxLength="6"
                    required
                />
            </div>
            
            <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
                {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>
        </form>
    );
}

// --- Sub-Component for Step 2: Reviewing the Invitation ---
function ReviewInvite({ inviteDetails, onAccept, currentUser, isLoading, error }) {
    const isCorrectUser = currentUser && currentUser.email.toLowerCase() === inviteDetails.email.toLowerCase();

    return (
        <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2 text-center">You're Invited!</h2>
            
            <div className="my-6 p-4 bg-gray-50 border rounded-lg text-center space-y-1">
                <p className="text-sm text-gray-500">You have been invited to join</p>
                <p className="text-2xl font-bold text-purple-700">{inviteDetails.team.name}</p>
                <p className="text-sm text-gray-500">at {inviteDetails.organization.name}</p>
            </div>

            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

            {!currentUser ? (
                <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">You must be logged in to accept.</p>
                    <Link href="/login" className="mt-2 inline-block text-sm text-purple-600 font-semibold hover:underline">
                        Login or Create an Account
                    </Link>
                </div>
            ) : isCorrectUser ? (
                <button
                    onClick={onAccept}
                    disabled={isLoading}
                    className="w-full mt-4 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    {isLoading ? 'Joining...' : 'Accept & Join Team'}
                </button>
            ) : (
                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-bold">Account Mismatch</p>
                    <p className="text-xs text-red-700 mt-1">
                        This invitation is for <span className="font-semibold">{inviteDetails.email}</span>, but you are logged in as <span className="font-semibold">{currentUser.email}</span>. Please log in with the correct account.
                    </p>
                </div>
            )}
        </div>
    );
}

// --- Sub-Component for Step 3: Success Message ---
function SuccessDisplay({ teamName }) {
    return (
        <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Welcome to the Team!</h2>
            <p className="text-gray-600 mt-2">You are now a member of <span className="font-semibold">{teamName}</span>.</p>
            <Link href="/dashboard/enterprise" className="w-full inline-block mt-6 px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors">
                Go to Enterprise Dashboard
            </Link>
        </div>
    );
}