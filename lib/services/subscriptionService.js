// lib/services/subscriptionService.js
import { auth } from '@/important/firebase';

/**
 * Subscription levels and their features
 */
export const SUBSCRIPTION_LEVELS = {
  BASE: 'base',
  PRO: 'pro',
  PREMIUM: 'premium',
  BUSINESS: 'business'
};

export const FEATURES = {
  ANALYTICS: 'analytics',
  CUSTOM_DOMAINS: 'custom_domains',
  ADVANCED_THEMES: 'advanced_themes',
  PRIORITY_SUPPORT: 'priority_support',
  WHITE_LABEL: 'white_label'
};

/**
 * Feature matrix - what each subscription level includes
 */
const FEATURE_MATRIX = {
  [SUBSCRIPTION_LEVELS.BASE]: [
    // Base features only
  ],
  [SUBSCRIPTION_LEVELS.PRO]: [
    FEATURES.ANALYTICS,
  ],
  [SUBSCRIPTION_LEVELS.PREMIUM]: [
    FEATURES.ANALYTICS,
    FEATURES.CUSTOM_DOMAINS,
    FEATURES.ADVANCED_THEMES,
  ],
  [SUBSCRIPTION_LEVELS.BUSINESS]: [
    FEATURES.ANALYTICS,
    FEATURES.CUSTOM_DOMAINS,
    FEATURES.ADVANCED_THEMES,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.WHITE_LABEL,
  ]
};

/**
 * Get user's subscription level from server
 */
export async function getUserSubscription() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/user/subscription', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription data');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
}

/**
 * Check if user has access to a specific feature
 */
export function hasFeatureAccess(subscriptionLevel, feature) {
  if (!subscriptionLevel || !feature) return false;
  
  const userFeatures = FEATURE_MATRIX[subscriptionLevel] || [];
  return userFeatures.includes(feature);
}

/**
 * Check if user can access analytics
 */
export function canAccessAnalytics(subscriptionLevel) {
  return hasFeatureAccess(subscriptionLevel, FEATURES.ANALYTICS);
}

/**
 * Get subscription level hierarchy for comparisons
 */
export function getSubscriptionHierarchy() {
  return [
    SUBSCRIPTION_LEVELS.BASE,
    SUBSCRIPTION_LEVELS.PRO,
    SUBSCRIPTION_LEVELS.PREMIUM,
    SUBSCRIPTION_LEVELS.BUSINESS
  ];
}

/**
 * Check if subscription level meets minimum requirement
 */
export function meetsMinimumSubscription(userLevel, requiredLevel) {
  const hierarchy = getSubscriptionHierarchy();
  const userIndex = hierarchy.indexOf(userLevel);
  const requiredIndex = hierarchy.indexOf(requiredLevel);
  
  return userIndex >= requiredIndex;
}

/**
 * Get display name for subscription level
 */
export function getSubscriptionDisplayName(level) {
  const displayNames = {
    [SUBSCRIPTION_LEVELS.BASE]: 'Base',
    [SUBSCRIPTION_LEVELS.PRO]: 'Pro',
    [SUBSCRIPTION_LEVELS.PREMIUM]: 'Premium',
    [SUBSCRIPTION_LEVELS.BUSINESS]: 'Business'
  };
  
  return displayNames[level] || 'Unknown';
}

/**
 * Get upgrade message for features
 */
export function getUpgradeMessage(feature) {
  const messages = {
    [FEATURES.ANALYTICS]: 'Upgrade to Pro to access detailed analytics and insights about your profile performance.',
    [FEATURES.CUSTOM_DOMAINS]: 'Upgrade to Premium to use your own custom domain.',
    [FEATURES.ADVANCED_THEMES]: 'Upgrade to Premium to access advanced themes and customization options.',
    [FEATURES.PRIORITY_SUPPORT]: 'Upgrade to Business for priority customer support.',
    [FEATURES.WHITE_LABEL]: 'Upgrade to Business to remove branding and use white-label features.'
  };
  
  return messages[feature] || 'Upgrade your subscription to access this feature.';
}
