import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// --- Helper Functions (Server-Side) ---

function getDateKeys() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return { today, yesterday, weekKey, monthKey };
}

function processAnalyticsData(data) {
    const safeData = data || {};
    const { today, yesterday, weekKey, monthKey } = getDateKeys();

    const topLinks = Object.entries(safeData.linkClicks || {})
        .map(([linkId, linkData]) => ({
            linkId,
            title: linkData?.title || 'Untitled Link',
            url: linkData?.url || '',
            type: linkData?.type || 'custom',
            totalClicks: linkData?.totalClicks || 0,
            todayClicks: linkData?.dailyClicks?.[today] || 0,
            weekClicks: linkData?.weeklyClicks?.[weekKey] || 0,
            monthClicks: linkData?.monthlyClicks?.[monthKey] || 0,
            lastClicked: linkData?.lastClicked?.toDate?.().toISOString() || null,
        }))
        .filter(link => link.totalClicks > 0)
        .sort((a, b) => b.totalClicks - a.totalClicks);

    const trafficSources = safeData.trafficSources || {};
    const trafficSourceStats = {
        totalSources: Object.keys(trafficSources).length,
        topSource: null,
        socialTraffic: 0, searchTraffic: 0, directTraffic: 0, referralTraffic: 0
    };

    if (trafficSourceStats.totalSources > 0) {
        const sortedSources = Object.entries(trafficSources).sort(([, a], [, b]) => (b?.clicks || 0) - (a?.clicks || 0));
        if (sortedSources.length > 0) {
            trafficSourceStats.topSource = { name: sortedSources[0][0], clicks: sortedSources[0][1]?.clicks || 0 };
        }
        Object.values(trafficSources).forEach(sourceData => {
            const clicks = sourceData?.clicks || 0;
            if (sourceData?.medium === 'social') trafficSourceStats.socialTraffic += clicks;
            else if (['search', 'organic'].includes(sourceData?.medium)) trafficSourceStats.searchTraffic += clicks;
            else if (sourceData?.medium === 'direct') trafficSourceStats.directTraffic += clicks;
            else if (sourceData?.medium === 'referral') trafficSourceStats.referralTraffic += clicks;
        });
    }

    return {
        totalViews: safeData.totalViews || 0,
        todayViews: safeData.dailyViews?.[today] || 0,
        yesterdayViews: safeData.dailyViews?.[yesterday] || 0,
        thisWeekViews: safeData.weeklyViews?.[weekKey] || 0,
        thisMonthViews: safeData.monthlyViews?.[monthKey] || 0,
        totalClicks: safeData.totalClicks || 0,
        todayClicks: safeData.dailyClicks?.[today] || 0,
        yesterdayClicks: safeData.dailyClicks?.[yesterday] || 0,
        thisWeekClicks: safeData.weeklyClicks?.[weekKey] || 0,
        thisMonthClicks: safeData.monthlyClicks?.[monthKey] || 0,
        
        // ✅ THE FIX IS HERE: Add the full daily objects to the response
        dailyViews: safeData.dailyViews || {},
        dailyClicks: safeData.dailyClicks || {},
        
        topLinks,
        trafficSources,
        trafficSourceStats,
    };
}


// --- Main API Handler ---
export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        const analyticsRef = adminDb.collection('Analytics').doc(uid);
        const analyticsDoc = await analyticsRef.get();
        
        const rawData = analyticsDoc.exists ? analyticsDoc.data() : {};
        const processedData = processAnalyticsData(rawData);
        
        return NextResponse.json(processedData);

    } catch (error) {
        console.error("💥 API Error in /api/user/analytics:", error);
        if (error.code?.startsWith('auth/')) {
            return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}