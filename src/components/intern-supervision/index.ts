/**
 * INTERN INTEGRATION PHASE 2A + 2B: Supervisor Components
 * 
 * PHASE 2A (feature_intern_supervision_enabled):
 * - InternSupervisionPanel: View interns, assign cases, review drafts
 * 
 * PHASE 2B (feature_intern_supervision_phase2b_enabled):
 * - SupervisorSignalBadge/Strip: Passive pending work indicators
 * - InternExpiryNudge: Banner for expiring interns
 * - InternActivityDigestPanel: Read-only activity summary
 * 
 * All components are feature-flagged and fully removable.
 * 
 * SECURITY REVIEW: 2026-01-14
 */

// Phase 2A
export { InternSupervisionPanel } from './InternSupervisionPanel';

// Phase 2B
export { SupervisorSignalBadge, SupervisorSignalStrip } from './SupervisorSignals';
export { InternExpiryNudge } from './InternExpiryNudge';
export { InternActivityDigestPanel } from './InternActivityDigest';
