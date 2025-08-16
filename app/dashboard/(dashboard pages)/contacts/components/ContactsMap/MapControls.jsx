// components/ContactsMap/MapControls.jsx
import React from 'react';

export default function MapControls({
    isLoaded,
    isMobile,
    isSelectingMode,
    selectedMarkers,
    showFilters,
    setShowFilters,
    filters,
    loadingEvents,
    startGroupSelection,
    cancelGroupSelection,
    createGroupFromSelection
}) {
    if (!isLoaded || isMobile) return null;

    return (
        <div className="absolute top-20 right-4 z-20">
            {!isSelectingMode ? (
                <div className="flex flex-col gap-2">
                    {/* Filters Button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                        </svg>
                        Filters
                        {Object.values(filters).some(f => f !== 'all') && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                Active
                            </span>
                        )}
                    </button>
                    
                    {/* Create Group Button */}
                    <button
                        onClick={startGroupSelection}
                        className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Create Group
                    </button>
                    
                    {/* Loading Events Indicator */}
                    {loadingEvents && (
                        <div className="bg-white p-2 rounded-lg shadow-lg border flex items-center gap-2 text-xs text-gray-600">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                            Detecting events...
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-3 rounded-lg shadow-lg border">
                    <div className="text-sm font-medium text-gray-900 mb-2">
                        Select contacts for group
                    </div>
                    <div className="text-xs text-gray-600 mb-3">
                        {selectedMarkers.length} selected
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={cancelGroupSelection}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={createGroupFromSelection}
                            disabled={selectedMarkers.length === 0}
                            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                            Create ({selectedMarkers.length})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}