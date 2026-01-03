import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

/**
 * SAFE PWA AUTO-UPDATE — PHASE 2: GLOBAL FORM DIRTY TRACKING
 * 
 * COURT-CRITICAL: Tracks unsaved user input globally.
 * Reload MUST be blocked if hasDirtyForms === true.
 * 
 * Forms are marked clean only on:
 * - Successful save
 * - Explicit discard
 * - Confirmed submission
 */

interface FormDirtyContextValue {
  /** Mark a form as having unsaved changes */
  markDirty: (formId: string) => void;
  /** Mark a form as clean (saved/discarded) */
  markClean: (formId: string) => void;
  /** Check if a specific form is dirty */
  isFormDirty: (formId: string) => boolean;
  /** True if ANY form has unsaved changes */
  hasDirtyForms: boolean;
  /** List of all dirty form IDs (for debugging) */
  dirtyFormIds: string[];
}

const FormDirtyContext = createContext<FormDirtyContextValue | null>(null);

interface FormDirtyProviderProps {
  children: ReactNode;
}

export function FormDirtyProvider({ children }: FormDirtyProviderProps) {
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(new Set());

  const markDirty = useCallback((formId: string) => {
    setDirtyForms(prev => {
      if (prev.has(formId)) return prev;
      const next = new Set(prev);
      next.add(formId);
      return next;
    });
  }, []);

  const markClean = useCallback((formId: string) => {
    setDirtyForms(prev => {
      if (!prev.has(formId)) return prev;
      const next = new Set(prev);
      next.delete(formId);
      return next;
    });
  }, []);

  const isFormDirty = useCallback((formId: string) => {
    return dirtyForms.has(formId);
  }, [dirtyForms]);

  const value = useMemo<FormDirtyContextValue>(() => ({
    markDirty,
    markClean,
    isFormDirty,
    hasDirtyForms: dirtyForms.size > 0,
    dirtyFormIds: Array.from(dirtyForms),
  }), [markDirty, markClean, isFormDirty, dirtyForms]);

  return (
    <FormDirtyContext.Provider value={value}>
      {children}
    </FormDirtyContext.Provider>
  );
}

/**
 * Hook to access form dirty state tracking.
 * Use this in any form component to track unsaved changes.
 */
export function useFormDirty() {
  const context = useContext(FormDirtyContext);
  if (!context) {
    throw new Error('useFormDirty must be used within a FormDirtyProvider');
  }
  return context;
}

/**
 * Convenience hook for a single form.
 * Automatically tracks dirty state for a specific form ID.
 * 
 * @example
 * const { isDirty, setDirty, setClean } = useFormDirtyState('post-court-capture');
 * 
 * // In onChange handlers:
 * onChange={(e) => {
 *   setValue(e.target.value);
 *   setDirty();
 * }}
 * 
 * // After successful save:
 * setClean();
 */
export function useFormDirtyState(formId: string) {
  const { markDirty, markClean, isFormDirty } = useFormDirty();

  const setDirty = useCallback(() => {
    markDirty(formId);
  }, [markDirty, formId]);

  const setClean = useCallback(() => {
    markClean(formId);
  }, [markClean, formId]);

  return {
    isDirty: isFormDirty(formId),
    setDirty,
    setClean,
  };
}
