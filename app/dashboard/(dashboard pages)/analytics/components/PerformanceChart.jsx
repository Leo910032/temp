"use client";
import { useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ✅ FIXED: Move all helper functions outside the component to avoid hoisting issues

// Helper function for realistic hourly activity pattern
const getHourlyActivityMultiplier = (hour) => {
    // Simulate realistic user activity patterns throughout the day
    if (hour >= 6 && hour <= 9) return 1.2; // Morning peak
    if (hour >= 12 && hour <= 14) return 1.5; // Lunch peak
    if (hour >= 18 && hour <= 22) return 1.8; // Evening peak
    if (hour >= 0 && hour <= 6) return 0.3; // Night low
    return 1.0; // Normal activity
};

// Generate hourly data for today (simulated since we don't have hourly granularity yet)
const generateHourlyData = (dailyViews, dailyClicks) => {
    const today = new Date().toISOString().split('T')[0];
    const todayViews = dailyViews[today] || 0;
    const todayClicks = dailyClicks[today] || 0;
    
    // Simulate hourly distribution (in reality, you'd need hourly tracking)
    // For now, we'll create a realistic distribution pattern
    const hourlyData = [];
    const currentHour = new Date().getHours();
    
    for (let hour = 0; hour <= currentHour; hour += 2) {
        // Create a realistic activity pattern (higher during day hours)
        const activityMultiplier = getHourlyActivityMultiplier(hour);
        const estimatedViews = Math.round((todayViews * activityMultiplier) / 12); // Divide by 12 (2-hour intervals)
        const estimatedClicks = Math.round((todayClicks * activityMultiplier) / 12);
        
        hourlyData.push({
            name: `${hour.toString().padStart(2, '0')}:00`,
            views: estimatedViews,
            clicks: estimatedClicks,
            time: hour
        });
    }
    
    return hourlyData;
};

// Generate daily data for the last N days
const generateDailyData = (dailyViews, dailyClicks, days) => {
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        
        data.push({
            name: date.toLocaleDateString(undefined, { 
                weekday: 'short', 
                day: 'numeric' 
            }),
            fullDate: dateKey,
            views: dailyViews[dateKey] || 0,
            clicks: dailyClicks[dateKey] || 0,
        });
    }
    
    return data;
};

// Generate weekly data for the last N weeks
const generateWeeklyData = (dailyViews, dailyClicks, weeks) => {
    const data = [];
    const today = new Date();
    
    for (let week = weeks - 1; week >= 0; week--) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (week * 7) - 6);
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() - (week * 7));
        
        let weekViews = 0;
        let weekClicks = 0;
        
        // Sum up the week's data
        for (let day = 0; day < 7; day++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + day);
            const dateKey = date.toISOString().split('T')[0];
            
            weekViews += dailyViews[dateKey] || 0;
            weekClicks += dailyClicks[dateKey] || 0;
        }
        
        data.push({
            name: `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
            views: weekViews,
            clicks: weekClicks,
            weekNumber: weeks - week
        });
    }
    
    return data;
};

// Generate monthly data from first activity to now
const generateMonthlyData = (dailyViews, dailyClicks) => {
    const data = [];
    const today = new Date();
    
    // Find the earliest date with data
    const allDates = [...Object.keys(dailyViews), ...Object.keys(dailyClicks)]
        .filter(date => date && date.match(/^\d{4}-\d{2}-\d{2}$/))
        .sort();
    
    if (allDates.length === 0) return [];
    
    const earliestDate = new Date(allDates[0]);
    const monthsToShow = Math.min(12, Math.ceil((today - earliestDate) / (1000 * 60 * 60 * 24 * 30))); // Max 12 months
    
    for (let monthsBack = monthsToShow - 1; monthsBack >= 0; monthsBack--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
        const nextMonth = new Date(today.getFullYear(), today.getMonth() - monthsBack + 1, 1);
        
        let monthViews = 0;
        let monthClicks = 0;
        
        // Sum up the month's data
        const currentDate = new Date(monthDate);
        while (currentDate < nextMonth && currentDate <= today) {
            const dateKey = currentDate.toISOString().split('T')[0];
            monthViews += dailyViews[dateKey] || 0;
            monthClicks += dailyClicks[dateKey] || 0;
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        data.push({
            name: monthDate.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
            views: monthViews,
            clicks: monthClicks,
            month: monthDate.getMonth(),
            year: monthDate.getFullYear()
        });
    }
    
    return data;
};

export default function PerformanceChart({ analytics, selectedPeriod = 'week' }) {
    const { t } = useTranslation();

    // ✅ ENHANCED: Dynamic chart data based on selected period
    const chartData = useMemo(() => {
        if (!analytics?.dailyViews || !analytics?.dailyClicks) {
            return [];
        }

        const dailyViews = analytics.dailyViews || {};
        const dailyClicks = analytics.dailyClicks || {};

        switch (selectedPeriod) {
            case 'today':
                // For today: Show hourly data (simulated from daily data since we don't have hourly)
                // Note: This is a placeholder implementation - real hourly data would require API changes
                return generateHourlyData(dailyViews, dailyClicks);
                
            case 'week':
                // For week: Show daily data for last 7 days
                return generateDailyData(dailyViews, dailyClicks, 7);
                
            case 'month':
                // For month: Show weekly data for last 4 weeks
                return generateWeeklyData(dailyViews, dailyClicks, 4);
                
            case 'all':
                // For all time: Show monthly data from first activity
                return generateMonthlyData(dailyViews, dailyClicks);
                
            default:
                return generateDailyData(dailyViews, dailyClicks, 7);
        }
    }, [analytics, selectedPeriod]);

    // Check if there is any actual data to display
    const hasData = useMemo(() => chartData.some(item => item.views > 0 || item.clicks > 0), [chartData]);

    // Get appropriate title based on period
    const getChartTitle = () => {
        const titles = {
            today: t('analytics.performance_today') || 'Today\'s Performance (2-hour intervals)',
            week: t('analytics.performance_week') || 'Weekly Performance (daily)',
            month: t('analytics.performance_month') || 'Monthly Performance (weekly)',
            all: t('analytics.performance_all_time') || 'All-Time Performance (monthly)'
        };
        return titles[selectedPeriod] || titles.week;
    };

    // Get appropriate empty state message
    const getEmptyStateMessage = () => {
        const messages = {
            today: 'No activity recorded for today yet.',
            week: 'No data to display for the last 7 days.',
            month: 'No data to display for the last month.',
            all: 'No historical data available yet.'
        };
        return messages[selectedPeriod] || messages.week;
    };

    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                    {getChartTitle()}
                </h2>
                {selectedPeriod === 'today' && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        ⚠️ Simulated hourly data
                    </span>
                )}
            </div>
            
            <div className="w-full h-64">
                {!hasData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">{getEmptyStateMessage()}</p>
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
                                angle={selectedPeriod === 'month' ? -45 : 0}
                                textAnchor={selectedPeriod === 'month' ? 'end' : 'middle'}
                                height={selectedPeriod === 'month' ? 60 : 30}
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
                                formatter={(value, name) => [
                                    value.toLocaleString(),
                                    name === 'views' ? (t('analytics.views') || 'Views') : (t('analytics.clicks') || 'Clicks')
                                ]}
                                labelFormatter={(label) => {
                                    if (selectedPeriod === 'today') return `Time: ${label}`;
                                    if (selectedPeriod === 'month') return `Week: ${label}`;
                                    if (selectedPeriod === 'all') return `Month: ${label}`;
                                    return `Date: ${label}`;
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Line 
                                type="monotone" 
                                dataKey="views" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                name={t('analytics.profile_views') || "Profile Views"}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="clicks" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                name={t('analytics.link_clicks') || "Link Clicks"}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            
            {/* Data summary for the selected period */}
            {hasData && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center">
                            <span className="text-gray-500">Total Views</span>
                            <div className="font-semibold text-blue-600">
                                {chartData.reduce((sum, item) => sum + item.views, 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-gray-500">Total Clicks</span>
                            <div className="font-semibold text-purple-600">
                                {chartData.reduce((sum, item) => sum + item.clicks, 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}