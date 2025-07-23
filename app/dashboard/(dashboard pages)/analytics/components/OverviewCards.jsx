//app/dashboard/(dashboard pages)/analytics/components/OverviewCards.jsx
"use client"
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useMemo } from "react";

export default function OverviewCards({ selectedPeriod, analytics, isConnected }) {
    const { t } = useTranslation();

    // Helper to get date keys for calculation
    const getDateKeysForPeriod = (period, dailyDataKeys) => {
        const today = new Date();
        const dates = [];
        let numDays = 0;

        if (period === 'today') {
            numDays = 1;
        } else if (period === 'week') {
            numDays = 7;
        } else if (period === 'month') {
            numDays = 30; // Approximation for month
        }

        for (let i = 0; i < numDays; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    };

    // Calculate aggregated data for the selected period dynamically using useMemo
    const currentPeriodData = useMemo(() => {
        if (!analytics) {
            return { views: 0, clicks: 0, previousViews: 0, previousClicks: 0, periodLabel: t('analytics.period.today') || 'Today' };
        }

        const dailyViews = analytics.dailyViews || {};
        const dailyClicks = analytics.dailyClicks || {};
        const today = new Date();

        let currentViews = 0;
        let currentClicks = 0;
        let previousViews = 0;
        let previousClicks = 0;
        let periodLabel = t('analytics.period.all_time') || 'All Time'; // Default for 'all'

        if (selectedPeriod === 'all') {
            currentViews = analytics.totalViews || 0;
            currentClicks = analytics.totalClicks || 0;
            periodLabel = t('analytics.period.all_time') || 'All Time';
        } else {
            const periodKeys = getDateKeysForPeriod(selectedPeriod);
            
            // Sum views and clicks for the current period
            for (const dateKey of periodKeys) {
                currentViews += dailyViews[dateKey] || 0;
                currentClicks += dailyClicks[dateKey] || 0;
            }

            // Calculate for previous period
            let prevPeriodLengthDays = 0;
            if (selectedPeriod === 'today') prevPeriodLengthDays = 1;
            if (selectedPeriod === 'week') prevPeriodLengthDays = 7;
            if (selectedPeriod === 'month') prevPeriodLengthDays = 30;

            for (let i = prevPeriodLengthDays; i < prevPeriodLengthDays * 2; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                previousViews += dailyViews[dateKey] || 0;
                previousClicks += dailyClicks[dateKey] || 0;
            }
            periodLabel = t(`analytics.period.${selectedPeriod}`) || selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1);
        }

        return { views: currentViews, clicks: currentClicks, previousViews, previousClicks, periodLabel };
    }, [analytics, selectedPeriod, t]);

    const getChangeIndicator = (current, previous) => {
        if (previous === 0 && current === 0) return null;
        if (previous === 0 && current > 0) {
             return (
                <div className={`flex items-center text-xs text-green-600`}>
                  
                
                </div>
            );
        }

        const change = ((current - previous) / previous) * 100;
        const isPositive = change >= 0;
        
        return (
            <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
               
                {Math.abs(change).toFixed(1)}%
            </div>
        );
    };

    return (
        <div className="w-full"> 
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {currentPeriodData.periodLabel} Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Views Card */}
                <div className="bg-white rounded-xl shadow-sm border p-4 relative transition-all duration-300 hover:shadow-md">
                    <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-blue-500"></div>

                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-blue-100 p-1.5 rounded-md"> 
                            <Image 
                                src="https://linktree.sirv.com/Images/icons/analytics.svg"
                                alt="views"
                                width={20}
                                height={20}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">
                            {t('analytics.profile_views') || 'Profile Views'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5 transition-all duration-500">
                            {currentPeriodData.views.toLocaleString()}
                        </p>
                        <div className="mt-1.5">
                            {selectedPeriod !== 'all' && getChangeIndicator(currentPeriodData.views, currentPeriodData.previousViews)}
                        </div>
                    </div>
                </div>

                {/* Clicks Card */}
                <div className="bg-white rounded-xl shadow-sm border p-4 relative transition-all duration-300 hover:shadow-md">
                    <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-indigo-500"></div>

                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-indigo-100 p-1.5 rounded-md">
                            <Image 
                                src="https://linktree.sirv.com/Images/icons/links.svg"
                                alt="clicks"
                                width={20}
                                height={20}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">
                            {t('analytics.link_clicks') || 'Link Clicks'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5 transition-all duration-500">
                            {currentPeriodData.clicks.toLocaleString()}
                        </p>
                        <div className="mt-1.5">
                            {selectedPeriod !== 'all' && getChangeIndicator(currentPeriodData.clicks, currentPeriodData.previousClicks)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}