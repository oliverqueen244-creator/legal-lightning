/**
 * INTERN INTEGRATION: Intern-Facing Components
 * 
 * Components for intern users (not supervisors).
 * 
 * PHASE 2B COMPONENTS:
 * - InternDocumentViewer: Watermarked read-only document viewer
 * - InternDocumentGuard: Guard for document access
 * - InternExpiryBanner: Expiry countdown/block banner
 * - InternFeatureBlocker: Block features for expired interns
 * - InternFeatureHidden: Hide features from all interns
 * 
 * INTERN FEATURE SET COMPLETE as of Phase 2B.
 * Any expansion requires new audit + design approval.
 * 
 * SECURITY REVIEW: 2026-01-14
 */

export { 
  InternDocumentViewer, 
  InternDocumentGuard 
} from './InternDocumentViewer';

export { 
  InternExpiryBanner, 
  InternFeatureBlocker, 
  InternFeatureHidden 
} from './InternExpiryBanner';
