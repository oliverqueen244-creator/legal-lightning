/**
 * CORRECTNESS PLAN 3: Role-Aware Semantics Hook
 * 
 * Provides role-specific labels and checks for the UI.
 * Clerks see "Tracked case" instead of "Your case".
 * Only lawyers (SENIOR/JUNIOR) can claim ownership.
 */

import { useAuth, AppRole } from './useAuth';

interface RoleSemantics {
  // Whether this user can claim case ownership
  canClaimOwnership: boolean;
  // Whether this user can force a case active
  canForceActive: boolean;
  // Whether this user can confirm case matches
  canConfirmMatches: boolean;
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
}

export function useRoleSemantics(): RoleSemantics {
  const { role } = useAuth();
  
  const isLawyerRole = role === 'SENIOR' || role === 'JUNIOR' || role === 'ADMIN';
  const isClerkRole = role === 'CLERK';
  
  // Clerks cannot perform ownership actions
  const canClaimOwnership = isLawyerRole;
  const canForceActive = role === 'SENIOR' || role === 'ADMIN';
  const canConfirmMatches = isLawyerRole;
  
  // Role-aware labels
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

  return {
    canClaimOwnership,
    canForceActive,
    canConfirmMatches,
    caseLabel,
    caseRunningLabel,
    caseApproachingLabel,
    caseSkippedLabel,
    isLawyerRole,
    isClerkRole,
  };
}

/**
 * Helper to check if a role is a lawyer role (can claim ownership)
 */
export function isLawyerAppRole(role: AppRole | null): boolean {
  return role === 'SENIOR' || role === 'JUNIOR' || role === 'ADMIN';
}

/**
 * Helper to get role-aware case label
 */
export function getRoleCaseLabel(role: AppRole | null): string {
  return role === 'CLERK' ? 'Tracked case' : 'Your case';
}
