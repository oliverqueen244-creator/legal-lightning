import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to detect when the app loses focus/visibility.
 * Used to protect sensitive content from casual screen capture.
 * 
 * IMPORTANT: This does NOT block screenshots. It only provides deterrence
 * by detecting visibility changes and allowing the UI to react.
 */
export function useSensitiveView() {
  const [isHidden, setIsHidden] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);

  // Combined state: content should be obscured if hidden OR blurred
  const shouldObscure = isHidden || isBlurred;

  useEffect(() => {
    // Handle page visibility changes (tab switch, minimize)
    const handleVisibilityChange = () => {
      setIsHidden(document.hidden);
    };

    // Handle window blur (switching to another app, DevTools opened)
    const handleBlur = () => {
      setIsBlurred(true);
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    // Initial state
    setIsHidden(document.hidden);
    setIsBlurred(!document.hasFocus());

    // Add listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return {
    isHidden,
    isBlurred,
    shouldObscure,
  };
}

/**
 * Returns CSS classes for text selection prevention
 */
export function getSensitiveTextClasses(): string {
  return 'select-none';
}

/**
 * Handler to prevent context menu on sensitive content
 */
export function preventContextMenu(e: React.MouseEvent): void {
  e.preventDefault();
}

/**
 * Handler to prevent copy on sensitive content
 */
export function preventCopy(e: React.ClipboardEvent): void {
  e.preventDefault();
}
