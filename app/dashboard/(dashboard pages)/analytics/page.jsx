//app/dashboard/(dashboard pages)/analytics/page.jsx
"use client"
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { getUserSubscription, canAccessAnalytics, getUpgradeMessage, FEATURES } from "@/lib/services/subscriptionService";

// Import components
import AnalyticsHeader from "./components/AnalyticsHeader";
import PeriodNavigation from "./components/PeriodNavigation";
import OverviewCards from "./components/OverviewCards";
import PerformanceChart from "./components/PerformanceChart";
import LinkAnalyticsChart from "./components/LinkAnalyticsChart"; // ✅ Updated import
import TrafficSourcesChart from "./components/TrafficSourcesChart";

export default function AnalyticsPage() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);

    // Check subscription status first
    useEffect(() => {
        const checkSubscription = async () => {
            if (!currentUser) return;

            setSubscriptionLoading(true);
            try {
                const subscriptionData = await getUserSubscription();
                setSubscription(subscriptionData);
            } catch (err) {
                console.error("Failed to fetch subscription data:", err);
                setError("Failed to load subscription information");
            } finally {
                setSubscriptionLoading(false);
            }
        };

        checkSubscription();
    }, [currentUser]);

    // Fetch analytics only if user has access
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!currentUser || !subscription) return;

            // Check if user can access analytics
            if (!canAccessAnalytics(subscription.accountType)) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const token = await currentUser.getIdToken();
                const response = await fetch('/api/user/analytics', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    
                    // Handle subscription-related errors
                    if (errorData.code === 'SUBSCRIPTION_REQUIRED') {
                        setError({
                            type: 'subscription',
                            message: errorData.error,
                            currentPlan: errorData.currentPlan,
                            requiredPlan: errorData.requiredPlan
                        });
                        return;
                    }
                    
                    throw new Error(errorData.error || `Error: ${response.status}`);
                }
                
                const data = await response.json();
                setAnalytics(data);

            } catch (err) {
                console.error("Failed to fetch analytics data:", err);
                setError({
                    type: 'general',
                    message: err.message
                });
            } finally {
                setLoading(false);
            }
        };

        if (subscription) {
            fetchAnalytics();
        }
    }, [currentUser, subscription]);

    // Loading states
    if (subscriptionLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-3 text-sm">Checking subscription...</span>
            </div>
        );
    }

    // Subscription access check
    if (subscription && !canAccessAnalytics(subscription.accountType)) {
        return <SubscriptionUpgradeRequired subscription={subscription} />;
    }

    // Loading analytics data
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-3 text-sm">Loading Analytics...</span>
            </div>
        );
    }

    // Handle errors
    if (error) {
        if (error.type === 'subscription') {
            return <SubscriptionUpgradeRequired subscription={subscription} error={error} />;
        }
        
        return (
            <div className="flex-1 flex items-center justify-center h-full text-center">
                <div className="max-w-md">
                    <p className="text-red-500 mb-4">⚠️ {error.message || error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Main analytics dashboard
    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            <div className="p-4 space-y-6">
                <AnalyticsHeader 
                    username={currentUser?.displayName} 
                    isConnected={!error} 
                    subscription={subscription}
                />
                <PeriodNavigation selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} />
                <OverviewCards analytics={analytics} selectedPeriod={selectedPeriod} />
                <PerformanceChart analytics={analytics} selectedPeriod={selectedPeriod} />
                <LinkAnalyticsChart analytics={analytics} selectedPeriod={selectedPeriod} isConnected={!error} />
                <TrafficSourcesChart analytics={analytics} />
            </div>
        </div>
    );
}

// Component for users who need to upgrade
function SubscriptionUpgradeRequired({ subscription, error }) {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex items-center justify-center h-full p-8">
            <div className="max-w-2xl mx-auto text-center">
                {/* Upgrade Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl p-8 shadow-lg border border-blue-200">
                    {/* Icon */}
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {t('analytics.upgrade.title') || 'Unlock Analytics'}
                    </h1>

                    {/* Description */}
                    <p className="text-lg text-gray-600 mb-6">
                        {getUpgradeMessage(FEATURES.ANALYTICS)}
                    </p>

                    {/* Current Plan Badge */}
                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border mb-6">
                        <span className="text-sm text-gray-500 mr-2">Current plan:</span>
                        <span className="font-semibold text-gray-900 capitalize">
                            {subscription?.accountType || 'Base'}
                        </span>
                    </div>

                    {/* Features List */}
                    <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            {t('analytics.upgrade.features_title') || 'Pro Analytics Features'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            {[
                                'Real-time visitor tracking',
                                'Link click analytics',
                                'Traffic source insights',
                                'Performance charts',
                                'Historical data',
                                'Export capabilities'
                            ].map((feature, index) => (
                                <div key={index} className="flex items-center">
                                    <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm text-gray-700">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md">
                            {t('analytics.upgrade.cta') || 'Upgrade to Pro'}
                        </button>
                        <button 
                            onClick={() => window.history.back()}
                            className="px-8 py-3 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors duration-200 border border-gray-300"
                        >
                            {t('common.go_back') || 'Go Back'}
                        </button>
                    </div>

                    {/* Error Message if any */}
                    {error && error.type === 'subscription' && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error.message}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}