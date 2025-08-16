// components/admin/StatsCards.jsx
"use client"

export default function StatsCards({ stats }) {
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-green-600">{formatNumber(stats.totalViews)}</div>
                <div className="text-sm text-gray-600">Total Views</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-purple-600">{formatNumber(stats.totalClicks)}</div>
                <div className="text-sm text-gray-600">Total Clicks</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-orange-600">{stats.activeToday}</div>
                <div className="text-sm text-gray-600">Active Today</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-indigo-600">{stats.withAnalytics}</div>
                <div className="text-sm text-gray-600">With Analytics</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-red-600">{stats.sensitiveContent}</div>
                <div className="text-sm text-gray-600">Sensitive Content</div>
            </div>
        </div>
    );
}