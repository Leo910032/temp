"use client";
import { useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PerformanceChart({ analytics }) {
    const { t } = useTranslation();

    // ✅ FIX 1: useMemo to ensure chartData is only calculated when analytics is valid.
    const chartData = useMemo(() => {
        // If analytics data is not ready, return an empty array.
        if (!analytics?.dailyViews || !analytics?.dailyClicks) {
            return [];
        }

        // Prepare data for the last 7 days.
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            
            return {
                name: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
                views: analytics.dailyViews[dateKey] || 0,
                clicks: analytics.dailyClicks[dateKey] || 0,
            };
        }).reverse(); // Reverse to show oldest date first.
    }, [analytics]);

    // ✅ FIX 2: Check if there is any actual data to display.
    const hasData = useMemo(() => chartData.some(day => day.views > 0 || day.clicks > 0), [chartData]);

    return (
        <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
                {t('analytics.performance_last_7_days') || 'Weekly Performance'}
            </h2>
            
            <div className="w-full h-64">
                {/* ✅ FIX 3: Add a clear empty/loading state for the chart itself. */}
                {!hasData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">No data to display for the last 7 days.</p>
                        <p className="text-xs mt-1">Share your profile to get views and clicks!</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="name" 
                                stroke="#6b7280" 
                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis 
                                stroke="#6b7280" 
                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    fontSize: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Line 
                                type="monotone" 
                                dataKey="views" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                name={t('analytics.Profile_views') || "Views"}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="clicks" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                name={t('analytics.Link_clicks') || "Clicks"}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}