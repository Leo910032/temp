"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

// --- Reusable Test Results Display Component ---
const TestResultsDisplay = ({ title, results, overallSuccess, isLoading }) => {
    if (isLoading && results.length === 0) {
        return <div className="mt-4 p-4 border rounded-lg bg-gray-50 animate-pulse h-48"></div>;
    }
    if (results.length === 0) return null;

    return (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50 max-h-80 overflow-y-auto">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
                {title}:
                <span className={`px-2 py-0.5 text-xs rounded-full ${overallSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {overallSuccess === null ? 'Running...' : overallSuccess ? 'All Tests Passed' : 'Test Failed'}
                </span>
            </h4>
            <div className="font-mono text-xs space-y-1">
                {results.map((result, index) => (
                    <div key={index} className="flex items-start">
                        {result.status === 'success' && <span className="text-green-500 mr-2">✓</span>}
                        {result.status === 'running' && <span className="text-yellow-500 mr-2 animate-spin">⏳</span>}
                        {result.status === 'error' && <span className="text-red-500 mr-2">✗</span>}
                        <div className="flex-1">
                            <span className={result.status === 'error' ? 'text-red-600 font-bold' : 'text-gray-700'}>{result.step}</span>
                            {result.details && <p className="text-gray-500 pl-4 break-words">{result.details}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function AdminEnterprisePanel() {
    const { currentUser } = useAuth();
    
    // ✅ FIXED: Add all required state variables
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false); // ✅ This was missing!
    const [data, setData] = useState({ organizations: [], invitations: [] });
    const [isTesting, setIsTesting] = useState(false);
    const [testResults, setTestResults] = useState([]);
    const [overallTestSuccess, setOverallTestSuccess] = useState(null);
    const [recentlyCreatedUsers, setRecentlyCreatedUsers] = useState([]);
    
    // ✅ Add form state for manual tools
    const [addUserEmail, setAddUserEmail] = useState('');
    const [addUserOrgId, setAddUserOrgId] = useState('');
    const [addUserRole, setAddUserRole] = useState('employee');

    // ✅ Add utility function for copying to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    // ✅ Fetch enterprise data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_all_data' })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to fetch data');
            setData(result);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // ✅ Generic API action handler
    const handleApiAction = async (action, params = {}) => {
        setIsActionLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...params })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Action failed');
            
            // Handle different actions
            if (action === 'create_test_manager') {
                setRecentlyCreatedUsers(prev => [result.user, ...prev]);
                toast.success('Test manager created successfully!');
            } else if (action === 'add_user_to_org') {
                toast.success(`User added to organization successfully!`);
                setAddUserEmail('');
                setAddUserOrgId('');
                setAddUserRole('employee');
            } else {
                toast.success('Action completed successfully!');
            }
            
            // Refresh data
            await fetchData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    // ✅ Create test manager
    const handleCreateManager = () => {
        handleApiAction('create_test_manager');
    };

    // ✅ Delete test user
    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this test user?')) return;
        
        setIsActionLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_test_user', userId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Delete failed');
            
            setRecentlyCreatedUsers(prev => prev.filter(user => user.uid !== userId));
            toast.success('Test user deleted successfully!');
            await fetchData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    // ✅ Run comprehensive test
    const handleRunTest = async () => {
        setIsTesting(true);
        setTestResults([]);
        setOverallTestSuccess(null);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run_phase1_comprehensive_test' })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Test runner failed.');
            setTestResults(result.logs);
            setOverallTestSuccess(result.success);
            toast[result.success ? 'success' : 'error']('Comprehensive test run complete!');
        } catch (error) {
            toast.error(error.message);
            setTestResults(prev => [...prev, { step: "Framework Error", status: "error", details: error.message }]);
            setOverallTestSuccess(false);
        } finally {
            setIsTesting(false);
        }
    };

    // ✅ Load data on component mount
    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [currentUser, fetchData]);

    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-purple-200 p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Enterprise Data Management & Testing</h3>
                <button
                    onClick={fetchData}
                    disabled={isLoading || isActionLoading || isTesting}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                    {isLoading ? 'Loading...' : '🔄 Refresh'}
                </button>
            </div>
            
            {/* Current Data Overview */}
            {!isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                        <h5 className="font-medium text-blue-900">Organizations</h5>
                        <p className="text-2xl font-bold text-blue-700">{data.organizations.length}</p>
                        <p className="text-xs text-blue-600">Active organizations</p>
                    </div>
                    <div>
                        <h5 className="font-medium text-blue-900">Pending Invitations</h5>
                        <p className="text-2xl font-bold text-blue-700">{data.invitations.length}</p>
                        <p className="text-xs text-blue-600">Awaiting acceptance</p>
                    </div>
                </div>
            )}
            
            {/* Phase 1 Test Suite */}
            <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
                <h4 className="font-medium">Phase 1 Automated Test Suite</h4>
                <p className="text-xs text-gray-500 mt-1 mb-3">Runs a full suite of tests including permissions, edge cases, and cleanup.</p>
                <button
                    onClick={handleRunTest}
                    disabled={isTesting || isActionLoading} // ✅ FIXED: Now isActionLoading is defined
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                    {isTesting ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Running Tests...
                        </>
                    ) : (
                        <>🧪 Run Comprehensive Logic & Security Test</>
                    )}
                </button>
                <TestResultsDisplay 
                    title="Test Results"
                    results={testResults}
                    overallSuccess={overallTestSuccess}
                    isLoading={isTesting}
                />
            </div>
            
            {/* Action Buttons Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Generators */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-medium">Quick Generators</h4>
                    <button
                        onClick={handleCreateManager}
                        disabled={isActionLoading || isTesting}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                    >
                        {isActionLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Generating...
                            </>
                        ) : (
                            <>🚀 Generate Perfect Test Manager & Org</>
                        )}
                    </button>
                    <p className="text-xs text-gray-500">Creates a new user with an `isTestAccount: true` flag, a new organization, and assigns the user as manager.</p>
                </div>
                
                {/* Manual Tools */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-medium">Manual Tools</h4>
                    <form onSubmit={(e) => { 
                        e.preventDefault(); 
                        handleApiAction('add_user_to_org', { 
                            email: addUserEmail, 
                            orgId: addUserOrgId, 
                            role: addUserRole 
                        }); 
                    }} className="space-y-3">
                        <select 
                            value={addUserOrgId} 
                            onChange={e => setAddUserOrgId(e.target.value)} 
                            required 
                            className="w-full p-2 border rounded-md bg-white"
                            disabled={isActionLoading || isTesting}
                        >
                            <option value="">Select an Organization</option>
                            {data.organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                        <input 
                            type="email" 
                            placeholder="User Email" 
                            value={addUserEmail} 
                            onChange={e => setAddUserEmail(e.target.value)} 
                            required 
                            className="w-full p-2 border rounded-md"
                            disabled={isActionLoading || isTesting}
                        />
                        <select 
                            value={addUserRole} 
                            onChange={e => setAddUserRole(e.target.value)} 
                            required 
                            className="w-full p-2 border rounded-md bg-white"
                            disabled={isActionLoading || isTesting}
                        >
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                        </select>
                        <button 
                            type="submit" 
                            disabled={isActionLoading || isTesting} 
                            className="w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isActionLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Adding...
                                </>
                            ) : (
                                'Add User to Org'
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Recently Created Test Users */}
            {recentlyCreatedUsers.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-md font-semibold">Recently Generated Test Users</h4>
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border max-h-64 overflow-y-auto">
                        {recentlyCreatedUsers.map(user => (
                            <div key={user.uid} className="bg-white p-3 rounded-md shadow-sm border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="font-mono text-xs space-y-1">
                                    <p><strong className="text-gray-600">Name:</strong> {user.displayName}</p>
                                    <p><strong className="text-gray-600">Email:</strong> {user.email}</p>
                                    <div className="flex items-center gap-2">
                                        <strong className="text-gray-600">Pass:</strong> 
                                        <span>{user.password}</span>
                                        <button 
                                            onClick={() => copyToClipboard(user.password)} 
                                            title="Copy password" 
                                            className="p-1 hover:bg-gray-100 rounded"
                                            disabled={isActionLoading || isTesting}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteUser(user.uid)}
                                    disabled={isActionLoading || isTesting}
                                    className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {isActionLoading ? '⏳' : '🗑️'} Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Organizations List */}
            {data.organizations.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-md font-semibold">Current Organizations</h4>
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border max-h-40 overflow-y-auto">
                        {data.organizations.map(org => (
                            <div key={org.id} className="bg-white p-2 rounded-md shadow-sm border flex items-center justify-between">
                                <div className="font-mono text-xs">
                                    <p><strong>Name:</strong> {org.name}</p>
                                    <p><strong>ID:</strong> {org.id}</p>
                                    <p><strong>Teams:</strong> {Object.keys(org.teams || {}).length}</p>
                                </div>
                                {org.isTestOrganization && (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                        Test Org
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}