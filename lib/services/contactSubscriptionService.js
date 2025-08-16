// lib/services/contactSubscriptionService.js
import { getUserSubscription, SUBSCRIPTION_LEVELS, meetsMinimumSubscription } from './subscriptionService';

/**
 * Contact-specific features and their requirements
 */
export const CONTACT_FEATURES = {
  BASIC_CONTACTS: 'basic_contacts',
  BASIC_GROUPS: 'basic_groups',
  ADVANCED_GROUPS: 'advanced_groups',
  EVENT_DETECTION: 'event_detection',
  BUSINESS_CARD_SCANNER: 'business_card_scanner',
  TEAM_SHARING: 'team_sharing',
  MAP_VISUALIZATION: 'map_visualization'
};

/**
 * Contact feature matrix - what each subscription level includes
 */
const CONTACT_FEATURE_MATRIX = {
  [SUBSCRIPTION_LEVELS.BASE]: [
    // Base users have no contact features
  ],
  [SUBSCRIPTION_LEVELS.PRO]: [
    CONTACT_FEATURES.BASIC_CONTACTS,
    CONTACT_FEATURES.BASIC_GROUPS,
    CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
    CONTACT_FEATURES.MAP_VISUALIZATION
  ],
  [SUBSCRIPTION_LEVELS.PREMIUM]: [
    CONTACT_FEATURES.BASIC_CONTACTS,
    CONTACT_FEATURES.BASIC_GROUPS,
    CONTACT_FEATURES.ADVANCED_GROUPS,
    CONTACT_FEATURES.EVENT_DETECTION,
    CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
    CONTACT_FEATURES.TEAM_SHARING,
    CONTACT_FEATURES.MAP_VISUALIZATION
  ],
  [SUBSCRIPTION_LEVELS.BUSINESS]: [
    CONTACT_FEATURES.BASIC_CONTACTS,
    CONTACT_FEATURES.BASIC_GROUPS,
    CONTACT_FEATURES.ADVANCED_GROUPS,
    CONTACT_FEATURES.EVENT_DETECTION,
    CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
    CONTACT_FEATURES.TEAM_SHARING,
    CONTACT_FEATURES.MAP_VISUALIZATION
  ]
};

/**
 * Group generation options based on subscription level
 */
export const getGroupGenerationOptions = (subscriptionLevel) => {
  const options = {
    groupByCompany: false,
    groupByTime: false,
    groupByLocation: false,
    groupByEvents: false,
    maxGroups: 0,
    maxApiCalls: 0,
    costBudget: 0
  };

  switch (subscriptionLevel) {
    case SUBSCRIPTION_LEVELS.BASE:
      // No contact features for base users
      return options;

    case SUBSCRIPTION_LEVELS.PRO:
      return {
        ...options,
        groupByCompany: true,     // Free methods only
        groupByTime: true,        // Free methods only
        groupByLocation: false,   // Not available
        groupByEvents: false,     // Not available
        maxGroups: 10,
        maxApiCalls: 0,           // No API calls for Pro
        costBudget: 0
      };

    case SUBSCRIPTION_LEVELS.PREMIUM:
    case SUBSCRIPTION_LEVELS.BUSINESS:
      return {
        ...options,
        groupByCompany: true,     // Free methods first
        groupByTime: true,        // Free methods first
        groupByLocation: true,    // With cost controls
        groupByEvents: true,      // With cost controls
        maxGroups: subscriptionLevel === SUBSCRIPTION_LEVELS.BUSINESS ? 50 : 30,
        maxApiCalls: subscriptionLevel === SUBSCRIPTION_LEVELS.BUSINESS ? 20 : 15,
        costBudget: subscriptionLevel === SUBSCRIPTION_LEVELS.BUSINESS ? 0.20 : 0.15
      };

    default:
      return options;
  }
};

/**
 * Check if user has access to a specific contact feature
 */
export function hasContactFeatureAccess(subscriptionLevel, feature) {
  if (!subscriptionLevel || !feature) return false;
  
  const userFeatures = CONTACT_FEATURE_MATRIX[subscriptionLevel] || [];
  return userFeatures.includes(feature);
}

/**
 * Check if user can access basic contacts functionality
 */
export function canAccessContacts(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.BASIC_CONTACTS);
}

/**
 * Check if user can create basic groups (company/time-based)
 */
export function canCreateBasicGroups(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.BASIC_GROUPS);
}

/**
 * Check if user can create advanced groups (location/event-based)
 */
export function canCreateAdvancedGroups(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.ADVANCED_GROUPS);
}

/**
 * Check if user can use event detection
 */
export function canUseEventDetection(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.EVENT_DETECTION);
}

/**
 * Check if user can share contacts with team
 */
export function canShareWithTeam(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.TEAM_SHARING);
}

/**
 * Get upgrade message for contact features
 */
export function getContactUpgradeMessage(feature) {
  const messages = {
    [CONTACT_FEATURES.BASIC_CONTACTS]: 'Upgrade to Pro to access contact management features.',
    [CONTACT_FEATURES.BASIC_GROUPS]: 'Upgrade to Pro to organize contacts into groups.',
    [CONTACT_FEATURES.ADVANCED_GROUPS]: 'Upgrade to Premium to create location and event-based groups.',
    [CONTACT_FEATURES.EVENT_DETECTION]: 'Upgrade to Premium to automatically detect events and create smart groups.',
    [CONTACT_FEATURES.TEAM_SHARING]: 'Upgrade to Premium to share contacts with your team.',
    [CONTACT_FEATURES.BUSINESS_CARD_SCANNER]: 'Upgrade to Pro to scan business cards and auto-extract contact information.',
    [CONTACT_FEATURES.MAP_VISUALIZATION]: 'Upgrade to Pro to visualize your contacts on an interactive map.'
  };
  
  return messages[feature] || 'Upgrade your subscription to access this contact feature.';
}

/**
 * Get user's contact subscription status
 */
export async function getContactSubscriptionStatus() {
  try {
    const subscriptionData = await getUserSubscription();
    const subscriptionLevel = subscriptionData.accountType;
    
    return {
      subscriptionLevel,
      features: CONTACT_FEATURE_MATRIX[subscriptionLevel] || [],
      groupOptions: getGroupGenerationOptions(subscriptionLevel),
      canAccessContacts: canAccessContacts(subscriptionLevel),
      canCreateBasicGroups: canCreateBasicGroups(subscriptionLevel),
      canCreateAdvancedGroups: canCreateAdvancedGroups(subscriptionLevel),
      canUseEventDetection: canUseEventDetection(subscriptionLevel),
      canShareWithTeam: canShareWithTeam(subscriptionLevel)
    };
  } catch (error) {
    console.error('Error fetching contact subscription status:', error);
    throw error;
  }
}

/**
 * Get subscription requirements for a feature
 */
export function getFeatureRequirements(feature) {
  const requirements = {
    [CONTACT_FEATURES.BASIC_CONTACTS]: SUBSCRIPTION_LEVELS.PRO,
    [CONTACT_FEATURES.BASIC_GROUPS]: SUBSCRIPTION_LEVELS.PRO,
    [CONTACT_FEATURES.ADVANCED_GROUPS]: SUBSCRIPTION_LEVELS.PREMIUM,
    [CONTACT_FEATURES.EVENT_DETECTION]: SUBSCRIPTION_LEVELS.PREMIUM,
    [CONTACT_FEATURES.TEAM_SHARING]: SUBSCRIPTION_LEVELS.PREMIUM,
    [CONTACT_FEATURES.BUSINESS_CARD_SCANNER]: SUBSCRIPTION_LEVELS.PRO,
    [CONTACT_FEATURES.MAP_VISUALIZATION]: SUBSCRIPTION_LEVELS.PRO
  };
  
  return requirements[feature] || SUBSCRIPTION_LEVELS.BUSINESS;
}