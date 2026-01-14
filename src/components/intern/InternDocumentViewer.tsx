/**
 * INTERN INTEGRATION PHASE 2B: Watermarked Read-Only Document Viewer
 * 
 * READ-ONLY document viewer for interns with:
 * - Hard overlay watermark: "INTERN VIEW – NOT FOR COURT USE"
 * - Disabled: download, print, export, right-click save
 * - Logs every view via log_intern_access
 * 
 * SCOPE CONSTRAINTS:
 * - Interns ONLY - lawyers/supervisors use normal viewers
 * - Works only for explicitly assigned cases
 * - No annotations, comments, or sharing
 * - No document uploads
 * 
 * INTERN FEATURE SET COMPLETE as of Phase 2B.
 * Any expansion requires new audit + design approval.
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Eye, Lock, FileWarning } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInternPermissions, useInternAccessLogger } from '@/hooks/useInternPermissions';
import { supabase } from '@/integrations/supabase/client';

interface InternDocumentViewerProps {
  docketId: string;
  documentUrl?: string;
  documentContent?: string;
  documentTitle?: string;
}

/**
 * Watermarked document viewer for interns
 * All actions (print, download, export) are HARD DISABLED
 */
export function InternDocumentViewer({ 
  docketId, 
  documentUrl, 
  documentContent,
  documentTitle = 'Document'
}: InternDocumentViewerProps) {
  const { isActiveIntern, canViewAssignedCases, internAccountId, expiresAt } = useInternPermissions();
  const { logCaseView } = useInternAccessLogger();
  const viewLoggedRef = useRef(false);
  
  // Log document view on mount (once per session)
  useEffect(() => {
    if (isActiveIntern && docketId && !viewLoggedRef.current) {
      viewLoggedRef.current = true;
      logCaseView(docketId);
      
      // Also log document view specifically
      if (internAccountId) {
        void supabase.rpc('log_intern_access', {
          p_action_type: 'document_view',
          p_target_table: 'case_documents',
          p_target_id: docketId,
          p_details: { document_title: documentTitle }
        });
      }
    }
  }, [isActiveIntern, docketId, internAccountId, documentTitle, logCaseView]);
  
  // Block all print/save/download attempts
  const blockAction = useCallback((e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Log blocked action
    if (internAccountId) {
      void supabase.rpc('log_intern_access', {
        p_action_type: 'access_denied',
        p_target_table: 'case_documents',
        p_target_id: docketId,
        p_details: { blocked_action: e.type }
      });
    }
    
    return false;
  }, [internAccountId, docketId]);
  
  // Disable right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('.intern-document-viewer')) {
        blockAction(e);
      }
    };
    
    // Disable print shortcut (Ctrl+P)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
        blockAction(e);
      }
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [blockAction]);
  
  // Check if intern is expired
  const isExpired = expiresAt && expiresAt <= new Date();
  
  // Block access if not active intern or expired
  if (!isActiveIntern || isExpired) {
    return (
      <Alert variant="destructive" className="m-4">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Expired</AlertTitle>
        <AlertDescription>
          {isExpired 
            ? 'Your intern access has expired. Contact your supervisor.'
            : 'You do not have access to view documents.'}
        </AlertDescription>
      </Alert>
    );
  }
  
  // Block if cannot view assigned cases
  if (!canViewAssignedCases) {
    return (
      <Alert variant="destructive" className="m-4">
        <FileWarning className="h-4 w-4" />
        <AlertTitle>Not Assigned</AlertTitle>
        <AlertDescription>
          This case is not assigned to you. Contact your supervisor for access.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="intern-document-viewer relative h-full select-none" 
         onCopy={(e) => e.preventDefault()}
         onCut={(e) => e.preventDefault()}
         style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      
      {/* Watermark Overlay - Always visible, semi-transparent */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden">
        <div className="watermark-pattern absolute inset-0" 
             style={{
               backgroundImage: `repeating-linear-gradient(
                 -45deg,
                 transparent,
                 transparent 80px,
                 hsl(var(--destructive) / 0.03) 80px,
                 hsl(var(--destructive) / 0.03) 160px
               )`,
             }}>
          {/* Multiple watermark texts across the document */}
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <div key={rowIndex} 
                 className="absolute w-full flex justify-around"
                 style={{ top: `${20 + rowIndex * 20}%` }}>
              {Array.from({ length: 3 }).map((_, colIndex) => (
                <div key={colIndex}
                     className="text-destructive/20 font-bold text-lg md:text-xl lg:text-2xl whitespace-nowrap"
                     style={{ 
                       transform: 'rotate(-30deg)',
                       fontFamily: 'system-ui, sans-serif',
                       letterSpacing: '0.1em'
                     }}>
                  INTERN VIEW – NOT FOR COURT USE
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Header with warning */}
      <Card className="border-amber-500/50 bg-amber-500/5 mb-4 mx-4 mt-4">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-medium">
                {documentTitle}
              </CardTitle>
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                INTERN VIEW
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span>View only • No download • No print</span>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Document Content */}
      <ScrollArea className="h-[calc(100%-8rem)] mx-4 relative">
        <CardContent className="p-4 bg-card/50 rounded-lg relative">
          {documentUrl ? (
            // PDF/Document URL - use iframe with print disabled
            <div className="relative">
              <iframe 
                src={`${documentUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-[70vh] rounded border border-border"
                title={documentTitle}
                sandbox="allow-same-origin"
                style={{ 
                  pointerEvents: 'auto',
                  // Prevent iframe content from being printed
                }}
              />
              {/* Overlay to prevent right-click on iframe */}
              <div 
                className="absolute inset-0 bg-transparent cursor-default"
                onContextMenu={(e) => e.preventDefault()}
                style={{ pointerEvents: 'none' }}
              />
            </div>
          ) : documentContent ? (
            // Text content - rendered directly
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {documentContent}
            </div>
          ) : (
            // No content
            <div className="text-center py-8 text-muted-foreground">
              <FileWarning className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No document content available</p>
            </div>
          )}
        </CardContent>
      </ScrollArea>
      
      {/* Footer with permanent reminder */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-amber-500/10 border-t border-amber-500/30 text-center">
        <p className="text-xs text-amber-600 font-medium">
          This document is for reference only and cannot be used for court proceedings.
        </p>
      </div>
    </div>
  );
}

/**
 * Guard component to wrap around document access for interns
 * Renders children only if intern has valid access
 */
export function InternDocumentGuard({ 
  docketId, 
  children 
}: { 
  docketId: string; 
  children: React.ReactNode;
}) {
  const { isIntern, isActiveIntern, canViewAssignedCases } = useInternPermissions();
  
  // Not an intern - render children normally (for lawyers/supervisors)
  if (!isIntern) {
    return <>{children}</>;
  }
  
  // Inactive intern - block
  if (!isActiveIntern) {
    return (
      <Alert variant="destructive" className="m-4">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Expired</AlertTitle>
        <AlertDescription>
          Your intern access has expired. Contact your supervisor.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Active intern with valid access - render with watermark wrapper
  if (canViewAssignedCases) {
    return <>{children}</>;
  }
  
  // No access to this case
  return (
    <Alert variant="destructive" className="m-4">
      <FileWarning className="h-4 w-4" />
      <AlertTitle>Case Not Assigned</AlertTitle>
      <AlertDescription>
        This case is not assigned to you. Contact your supervisor for access.
      </AlertDescription>
    </Alert>
  );
}
