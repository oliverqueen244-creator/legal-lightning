import { usePWAUpdate } from '@/hooks/usePWAUpdate';

/**
 * SAFE PWA AUTO-UPDATE — PWA Update Manager Component
 * 
 * This component initializes the PWA update lifecycle at app root.
 * It handles:
 * - Periodic update checks
 * - Visibility-based checks
 * - Safe reload decisions
 * 
 * This is a headless component - it renders nothing but manages the update lifecycle.
 */
export function PWAUpdateManager() {
  // Initialize the PWA update hook - it handles everything internally
  usePWAUpdate();
  
  return null;
}
