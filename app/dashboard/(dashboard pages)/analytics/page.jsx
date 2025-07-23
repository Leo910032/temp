"use client"
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";

// Import components
import AnalyticsHeader from "./components/AnalyticsHeader";
import PeriodNavigation from "./components/PeriodNavigation";
import OverviewCards from "./components/OverviewCards";
import PerformanceChart from "./components/PerformanceChart";
import TopClickedLinks from "./components/TopClickedLinks";
import TrafficSourcesChart from "./components/TrafficSourcesChart";

export default function AnalyticsPage() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('all');

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!currentUser) {
                // Wait for auth context to provide user
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
                    throw new Error(errorData.error || `Error: ${response.status}`);
                }
                
                const data = await response.json();
                setAnalytics(data);

            } catch (err) {
                console.error("Failed to fetch analytics data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [currentUser]); // Re-fetch if the user changes

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-3 text-sm">Loading Analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center h-full text-center">
                <p className="text-red-500">⚠️ {error}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            <div className="p-4 space-y-6">
                <AnalyticsHeader username={currentUser.displayName} isConnected={!error} />
                <PeriodNavigation selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} />
                <OverviewCards analytics={analytics} selectedPeriod={selectedPeriod} />
                <PerformanceChart analytics={analytics} />
                <TrafficSourcesChart analytics={analytics} />
                <TopClickedLinks analytics={analytics} />
            </div>
        </div>
    );
}