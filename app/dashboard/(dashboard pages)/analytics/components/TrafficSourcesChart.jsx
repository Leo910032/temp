// app/dashboard/(dashboard pages)/analytics/components/TrafficSourcesChart.jsx - ENHANCED WITH INFO MODAL
"use client"
import { useTranslation } from "@/lib/translation/useTranslation";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useState } from 'react';

export default function TrafficSourcesChart({ analytics }) {
    const { t } = useTranslation();
    const [showInfoModal, setShowInfoModal] = useState(false);

    // Guard clause if analytics data is not yet available
    if (!analytics || !analytics.trafficSources) {
        return (
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {t('analytics.traffic_sources') || 'Traffic Sources'}
                        </h2>
                        <InfoIcon onClick={() => setShowInfoModal(true)} />
                    </div>
                </div>
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    {t('analytics.no_traffic_data') || 'No traffic source data available yet.'}
                </div>
                {showInfoModal && (
                    <InfoModal onClose={() => setShowInfoModal(false)} />
                )}
            </div>
        );
    }

    // Process traffic sources data
    const trafficData = Object.entries(analytics.trafficSources)
        .map(([source, data]) => ({
            name: getSourceDisplayName(source),
            clicks: data.clicks || 0,
            views: data.views || 0,
            medium: data.medium || 'unknown',
            source: source
        }))
        .sort((a, b) => (b.clicks + b.views) - (a.clicks + a.views));

    // Only render if we have actual data points
    if (trafficData.length === 0 || trafficData.every(item => item.clicks === 0 && item.views === 0)) {
        return (
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {t('analytics.traffic_sources') || 'Traffic Sources'}
                        </h2>
                        <InfoIcon onClick={() => setShowInfoModal(true)} />
                    </div>
                </div>
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    {t('analytics.no_traffic_data') || 'No traffic source data available yet.'}
                </div>
                {showInfoModal && (
                    <InfoModal onClose={() => setShowInfoModal(false)} />
                )}
            </div>
        );
    }

    // Colors for different traffic sources
    const getSourceColor = (source, medium) => {
        if (medium === 'social') {
            switch (source) {
                case 'instagram': return '#E1306C';
                case 'tiktok': return '#000000';
                case 'twitter': return '#1DA1F2';
                case 'facebook': return '#4267B2';
                case 'linkedin': return '#0077B5';
                case 'youtube': return '#FF0000';
                case 'snapchat': return '#FFFC00';
                case 'discord': return '#5865F2';
                case 'reddit': return '#FF4500';
                case 'pinterest': return '#BD081C';
                default: return '#8B5CF6';
            }
        } else if (medium === 'search') {
            switch (source) {
                case 'google': return '#4285F4';
                case 'bing': return '#0078D4';
                case 'yahoo': return '#720E9E';
                case 'duckduckgo': return '#DE5833';
                default: return '#10B981';
            }
        } else if (medium === 'direct') {
            return '#6B7280';
        } else if (medium === 'email') {
            return '#F59E0B';
        } else if (medium === 'referral') {
            return '#EC4899';
        } else {
            return '#3B82F6';
        }
    };

    const COLORS = trafficData.map(item => getSourceColor(item.source, item.medium));

    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {t('analytics.traffic_sources') || 'Traffic Sources'}
                    </h2>
                    <InfoIcon onClick={() => setShowInfoModal(true)} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-4">
                        {t('analytics.source_distribution') || 'Source Distribution'}
                    </h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={trafficData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="clicks"
                                >
                                    {trafficData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name === 'clicks' ? 'Clicks' : 'Views']} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart */}
                <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-4">
                        {t('analytics.clicks_by_source') || 'Clicks by Source'}
                    </h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <BarChart data={trafficData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="clicks" fill="#3B82F6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Traffic Sources Table */}
            <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">
                    {t('analytics.detailed_breakdown') || 'Detailed Breakdown'}
                </h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.source') || 'Source'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.medium') || 'Medium'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.clicks') || 'Clicks'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.views') || 'Views'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.conversion_rate') || 'CTR'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {trafficData.map((source, index) => (
                                <tr key={source.source} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div 
                                                className="w-3 h-3 rounded-full mr-3"
                                                style={{ backgroundColor: COLORS[index] }}
                                            ></div>
                                            <span className="text-sm font-medium text-gray-900 capitalize">
                                                {getSourceIcon(source.source)} {source.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMediumBadgeClass(source.medium)}`}>
                                            {source.medium}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                        {source.clicks}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {source.views}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {source.views > 0 ? ((source.clicks / source.views) * 100).toFixed(1) : 0}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Modal */}
            {showInfoModal && (
                <InfoModal onClose={() => setShowInfoModal(false)} />
            )}
        </div>
    );
}

// ✅ NEW: Info Icon Component
const InfoIcon = ({ onClick }) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200 flex items-center justify-center text-xs font-bold cursor-pointer"
                title={t('analytics.info.click_for_more') || 'Click for more info'}
            >
                i
            </button>
            
            {/* Hover Tooltip */}
            {isHovered && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {t('analytics.info.click_for_more') || 'Click for more info'}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                </div>
            )}
        </div>
    );
};

// ✅ NEW: Info Modal Component
const InfoModal = ({ onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {t('analytics.info.traffic_sources_explained') || 'How Traffic Sources Work'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Introduction */}
                    <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                            {t('analytics.info.what_are_traffic_sources') || 'What are Traffic Sources?'}
                        </h4>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            {t('analytics.info.traffic_sources_description') || 
                            'Traffic sources show you where your visitors are coming from when they visit your profile. This helps you understand which platforms drive the most engagement and optimize your content strategy.'}
                        </p>
                    </div>

                    {/* Source Types */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900">
                            {t('analytics.info.source_types') || 'Types of Traffic Sources'}
                        </h4>

                        {/* Social Media */}
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📱</span>
                                <h5 className="font-medium text-gray-900">
                                    {t('analytics.info.social_media') || 'Social Media'}
                                </h5>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {t('analytics.info.social_description') || 
                                'When visitors click your link from social media platforms like Instagram, TikTok, or Twitter.'}
                            </p>
                            <div className="text-xs text-gray-500">
                                {t('analytics.info.social_examples') || 'Examples: Instagram bio, TikTok profile, Twitter posts'}
                            </div>
                        </div>

                        {/* Direct Traffic */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔗</span>
                                <h5 className="font-medium text-gray-900">
                                    {t('analytics.info.direct_traffic') || 'Direct Traffic'}
                                </h5>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {t('analytics.info.direct_description') || 
                                'When visitors type your URL directly or use bookmarks. This often indicates strong brand recognition.'}
                            </p>
                            <div className="text-xs text-gray-500">
                                {t('analytics.info.direct_examples') || 'Examples: Typing tapit.fr/yourname, clicking bookmarks, some mobile apps'}
                            </div>
                        </div>

                        {/* Search Engines */}
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔍</span>
                                <h5 className="font-medium text-gray-900">
                                    {t('analytics.info.search_engines') || 'Search Engines'}
                                </h5>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {t('analytics.info.search_description') || 
                                'When visitors find your profile through Google, Bing, or other search engines.'}
                            </p>
                            <div className="text-xs text-gray-500">
                                {t('analytics.info.search_examples') || 'Examples: Google search results, Bing, Yahoo search'}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📧</span>
                                <h5 className="font-medium text-gray-900">
                                    {t('analytics.info.email_traffic') || 'Email'}
                                </h5>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {t('analytics.info.email_description') || 
                                'When visitors click your link from email newsletters, campaigns, or signatures.'}
                            </p>
                            <div className="text-xs text-gray-500">
                                {t('analytics.info.email_examples') || 'Examples: Email newsletters, signature links, promotional emails'}
                            </div>
                        </div>

                        {/* UTM Campaigns */}
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🎯</span>
                                <h5 className="font-medium text-gray-900">
                                    {t('analytics.info.utm_campaigns') || 'UTM Campaigns'}
                                </h5>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {t('analytics.info.utm_description') || 
                                'Special tracking links with UTM parameters that let you track specific campaigns or collaborations.'}
                            </p>
                            <div className="text-xs text-gray-500 font-mono bg-white p-2 rounded border">
                                tapit.fr/yourname?utm_source=email&utm_campaign=newsletter
                            </div>
                        </div>
                    </div>

                    {/* How to Use This Data */}
                    <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-3">
                            {t('analytics.info.how_to_use') || 'How to Use This Data'}
                        </h4>
                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 mt-1">✓</span>
                                <span>{t('analytics.info.tip_1') || 'Focus your content on platforms that drive the most engagement'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 mt-1">✓</span>
                                <span>{t('analytics.info.tip_2') || 'Track the success of collaborations and campaigns with UTM links'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 mt-1">✓</span>
                                <span>{t('analytics.info.tip_3') || 'Optimize your bio links on platforms with high conversion rates'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 mt-1">✓</span>
                                <span>{t('analytics.info.tip_4') || 'High direct traffic shows strong brand recognition'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                    >
                        {t('common.close') || 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper functions
function getSourceDisplayName(source) {
    const displayNames = {
        'instagram': 'Instagram',
        'tiktok': 'TikTok',
        'twitter': 'Twitter',
        'facebook': 'Facebook',
        'linkedin': 'LinkedIn',
        'youtube': 'YouTube',
        'snapchat': 'Snapchat',
        'discord': 'Discord',
        'reddit': 'Reddit',
        'pinterest': 'Pinterest',
        'google': 'Google',
        'bing': 'Bing',
        'yahoo': 'Yahoo',
        'duckduckgo': 'DuckDuckGo',
        'direct': 'Direct',
        'email': 'Email',
        'unknown': 'Unknown'
    };
    return displayNames[source] || source.charAt(0).toUpperCase() + source.slice(1);
}

function getSourceIcon(source) {
    const icons = {
        'instagram': '📸',
        'tiktok': '🎵',
        'twitter': '🐦',
        'facebook': '👤',
        'linkedin': '💼',
        'youtube': '📺',
        'snapchat': '👻',
        'discord': '🎮',
        'reddit': '🤖',
        'pinterest': '📌',
        'google': '🔍',
        'bing': '🔍',
        'yahoo': '🔍',
        'duckduckgo': '🔍',
        'direct': '🔗',
        'email': '📧',
        'unknown': '❓'
    };
    return icons[source] || '🌐';
}

function getMediumBadgeClass(medium) {
    switch (medium) {
        case 'social':
            return 'bg-purple-100 text-purple-800';
        case 'search':
            return 'bg-green-100 text-green-800';
        case 'direct':
            return 'bg-gray-100 text-gray-800';
        case 'email':
            return 'bg-yellow-100 text-yellow-800';
        case 'referral':
            return 'bg-pink-100 text-pink-800';
        default:
            return 'bg-blue-100 text-blue-800';
    }
}