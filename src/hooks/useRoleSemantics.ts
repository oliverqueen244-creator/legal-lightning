/**
 * CORRECTNESS PLAN 3 + 4 + 5: Role-Aware Semantics Hook
 * 
 * Provides role-specific labels and checks for the UI.
 * Clerks see "Tracked case" instead of "Your case".
 * Only lawyers (SENIOR/JUNIOR) can claim ownership.
 * 
 * CP-4 Addition: Case context awareness
 * - Personal cases: "Your case"
 * - Chamber cases: "Chamber case"
 * - Clerk viewing any: "Tracked case"
 * 
 * CP-5 Addition: Delegation awareness
 * - Clerks with delegation see "Assisting Adv. <Name>"
 * - Scope-based action visibility
 */

import { useAuth, AppRole } from './useAuth';
import type { CaseContext } from '@/types/database';
import type { DelegationScope } from './useDelegation';

interface RoleSemantics {
  // Whether this user can claim case ownership
  canClaimOwnership: boolean;
  // Whether this user can force a case active
  canForceActive: boolean;
  // Whether this user can confirm case matches
  canConfirmMatches: boolean;
  // Whether this user can create chamber cases
  canCreateChamberCases: boolean;
  // Label for "your case" - role-aware
  caseLabel: string;
  // Label for "your case is running" - role-aware
  caseRunningLabel: string;
  // Label for case approaching - role-aware
  caseApproachingLabel: (distance: number) => string;
  // Label for case skipped - role-aware
  caseSkippedLabel: string;
  // Whether this role is a lawyer role
  isLawyerRole: boolean;
  // Whether this role is a clerk
  isClerkRole: boolean;
  // CP-4: Get context-aware case label
  getCaseLabel: (caseContext: CaseContext) => string;
  // CP-4: Get context-aware running label
  getCaseRunningLabel: (caseContext: CaseContext) => string;
  // CP-5: Check if action is allowed based on role (not scope - that requires delegation hook)
  canPerformOwnershipAction: boolean;
}

export function useRoleSemantics(): RoleSemantics {
  const { role } = useAuth();
  
  const isLawyerRole = role === 'SENIOR' || role === 'JUNIOR' || role === 'ADMIN';
  const isClerkRole = role === 'CLERK';
  const isInternRole = role === 'INTERN';
  
  // Clerks and Interns cannot perform ownership actions
  const canClaimOwnership = isLawyerRole && !isInternRole;
  const canForceActive = (role === 'SENIOR' || role === 'ADMIN') && !isInternRole;
  const canConfirmMatches = isLawyerRole && !isInternRole;
  // CP-4: Only seniors/admins can create chamber cases (never interns)
  const canCreateChamberCases = (role === 'SENIOR' || role === 'ADMIN') && !isInternRole;
  
  // CP-5: Ownership actions are NEVER allowed for clerks or interns (hard rule)
  const canPerformOwnershipAction = isLawyerRole && !isInternRole;
  
  // Role-aware labels (legacy - for personal context)
  const caseLabel = isClerkRole ? 'Tracked case' : 'Your case';
  const caseRunningLabel = isClerkRole ? 'CASE MARKED RUNNING' : 'YOUR CASE IS NOW!';
  
  const caseApproachingLabel = (distance: number): string => {
    if (isClerkRole) {
      return distance === 0 
        ? 'Case is marked as current'
        : `Tracked case is ${distance} item${distance !== 1 ? 's' : ''} away`;
    }
    return distance === 0 
      ? 'Your case is NOW!'
      : `Your case is ${distance} item${distance !== 1 ? 's' : ''} away`;
  };
  
  const caseSkippedLabel = isClerkRole 
    ? 'Tracked case was passed over' 
    : 'Your case was passed over';

  // CP-4: Context-aware case label
  const getCaseLabel = (caseContext: CaseContext): string => {
    if (isClerkRole) return 'Tracked case';
    return caseContext === 'chamber' ? 'Chamber case' : 'Your case';
  };

  // CP-4: Context-aware running label
  const getCaseRunningLabel = (caseContext: CaseContext): string => {
    if (isClerkRole) return 'CASE MARKED RUNNING';
    return caseContext === 'chamber' ? 'CHAMBER CASE NOW!' : 'YOUR CASE IS NOW!';
  };

  return {
    canClaimOwnership,
    canForceActive,
    canConfirmMatches,
    canCreateChamberCases,
    canPerformOwnershipAction,
    caseLabel,
    caseRunningLabel,
    caseApproachingLabel,
    caseSkippedLabel,
    isLawyerRole,
    isClerkRole,
    getCaseLabel,
    getCaseRunningLabel,
  };
}

/**
 * Helper to check if a role is a lawyer role (can claim ownership)
 */
export function isLawyerAppRole(role: AppRole | null): boolean {
  return role === 'SENIOR' || role === 'JUNIOR' || role === 'ADMIN';
}

/**
 * Helper to get role-aware case label (legacy - personal context)
 */
export function getRoleCaseLabel(role: AppRole | null): string {
  return role === 'CLERK' ? 'Tracked case' : 'Your case';
}

/**
 * CP-4: Helper to get context-aware case label
 */
export function getContextAwareCaseLabel(
  role: AppRole | null, 
  caseContext: CaseContext
): string {
  if (role === 'CLERK') return 'Tracked case';
  return caseContext === 'chamber' ? 'Chamber case' : 'Your case';
}
