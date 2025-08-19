"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';

// =============================================================================
// --- MAIN PAGE COMPONENT ---
// =============================================================================
export default function EnterprisePage() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [organization, setOrganization] = useState(null);
    const [teams, setTeams] = useState([]);

    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/enterprise/teams', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch enterprise data.');
            }
            
            const data = await response.json();
            // The API returns teams as an object with keys, so we convert to an array
            setTeams(Object.values(data.teams || {})); 
            setOrganization({ id: data.organizationId, userRole: data.userRole });

        } catch (err) {
            console.error(err);
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Action Handlers ---
    const handleCreateTeam = async (teamName, description) => {
        const toastId = toast.loading('Creating team...');
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/enterprise/teams', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: teamName, description })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create team.');
            }
            
            toast.success('Team created successfully!', { id: toastId });
            setCreateModalOpen(false);
            await fetchData(); // Refresh the list
            return true;
        } catch (err) {
            toast.error(err.message, { id: toastId });
            return false;
        }
    };

    const handleInviteMember = async (email, role) => {
        const toastId = toast.loading('Sending invitation...');
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/enterprise/invitations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ teamId: selectedTeam.id, invitedEmail: email, role })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to send invitation.');
            }
            
            toast.success('Invitation sent!', { id: toastId });
            setInviteModalOpen(false);
            // No need to refetch teams, as pending invites aren't shown here yet
            return true;
        } catch (err) {
            toast.error(err.message, { id: toastId });
            return false;
        }
    };
    
    // --- Render Logic ---
    if (loading) {
        return <div className="flex-1 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center h-full p-8 text-center">
                <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-red-800">An Error Occurred</h2>
                    <p className="text-red-600 mt-2">{error}</p>
                    <p className="text-sm text-gray-500 mt-4">This could be a permission issue or a server problem. Ensure you have a Business or Enterprise subscription.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 py-4 px-6 flex flex-col max-h-full overflow-y-auto">
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Enterprise Management</h1>
                    <p className="text-gray-600">Manage your organization's teams and members.</p>
                </div>
                <button
                    onClick={() => setCreateModalOpen(true)}
                    className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                >
                    Create New Team
                </button>
            </header>

            <main className="space-y-4">
                {teams.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <h3 className="text-lg font-medium text-gray-900">No teams found</h3>
                        <p className="text-gray-500 mt-1">Get started by creating your first team.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teams.map(team => (
                            <TeamCard 
                                key={team.id} 
                                team={team}
                                onInvite={() => {
                                    setSelectedTeam(team);
                                    setInviteModalOpen(true);
                                }} 
                            />
                        ))}
                    </div>
                )}
            </main>

            <CreateTeamModal 
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={handleCreateTeam}
            />
            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onSubmit={handleInviteMember}
                teamName={selectedTeam?.name}
            />
        </div>
    );
}

// =============================================================================
// --- SUB-COMPONENTS ---
// =============================================================================

function TeamCard({ team, onInvite }) {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-col">
            <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-600 mt-1 h-10">{team.description || 'No description provided.'}</p>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <span>{team.memberCount || 0} Member{team.memberCount !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div className="mt-4 border-t pt-4">
                <button
                    onClick={onInvite}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Invite Member
                </button>
            </div>
        </div>
    );
}

function CreateTeamModal({ isOpen, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(name, description);
        setIsSubmitting(false);
        if (success) {
            setName('');
            setDescription('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-4">Create a New Team</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg"></textarea>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3 rounded-b-lg">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                            {isSubmitting ? 'Creating...' : 'Create Team'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function InviteMemberModal({ isOpen, onClose, onSubmit, teamName }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('employee');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(email, role);
        setIsSubmitting(false);
        if (success) {
            setEmail('');
            setRole('employee');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-1">Invite to {teamName}</h2>
                        <p className="text-sm text-gray-500 mb-4">Assign a role and send an invitation.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                                    <option value="employee">Employee</option>
                                    <option value="team_lead">Team Lead</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3 rounded-b-lg">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {isSubmitting ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}