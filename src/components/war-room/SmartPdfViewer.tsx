import { useEffect, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react';
import { AnnotationToolbar, AnnotationTool } from './AnnotationToolbar';
import { useAnnotations, Annotation } from '@/hooks/useAnnotations';
import { ScrollArea } from '@/components/ui/scroll-area';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SmartPdfViewerProps {
  pdfUrl: string;
  targetPage?: number;
  documentId?: string;
}

export function SmartPdfViewer({ 
  pdfUrl, 
  targetPage = 1,
  documentId 
}: SmartPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(targetPage);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null);
  const [error, setError] = useState<string | null>(null);

  const { annotations, addAnnotation } = useAnnotations(documentId || null);

  // Navigate to target page when it changes
  useEffect(() => {
    if (targetPage && targetPage !== currentPage && targetPage <= numPages) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF. Please try again.');
    setIsLoading(false);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setScale(1.0);

  const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(numPages, prev + 1));

  // Touch gesture handling for pinch-to-zoom
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setTouchStartDistance(getTouchDistance(e.touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance) {
      const currentDistance = getTouchDistance(e.touches);
      if (currentDistance) {
        const delta = currentDistance / touchStartDistance;
        setScale(prev => Math.min(3, Math.max(0.5, prev * delta)));
        setTouchStartDistance(currentDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDistance(null);
  };

  // Handle text selection for highlighting
  const handleTextSelection = useCallback(() => {
    if (activeTool !== 'highlighter' || !documentId) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Get selection coordinates
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    addAnnotation.mutate({
      document_id: documentId,
      page_number: currentPage,
      annotation_type: 'highlight',
      annotation_json: {
        text: selectedText,
        color: '#fbbf24',
        boundingRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      },
    });

    selection.removeAllRanges();
  }, [activeTool, documentId, currentPage, addAnnotation]);

  // Render annotation overlays
  const pageAnnotations = annotations.filter(a => a.page_number === currentPage);

  return (
    <div 
      className="h-full flex flex-col bg-background"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toolbar */}
      <div 
        className="flex items-center justify-between p-3 border-b border-border glass-card rounded-none"
        role="toolbar"
        aria-label="PDF viewer controls"
      >
        {/* Page navigation */}
        <div className="flex items-center gap-2" role="group" aria-label="Page navigation">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="min-h-touch min-w-touch"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <span className="text-sm text-foreground px-3 min-w-[100px] text-center font-medium" aria-live="polite">
            Page {currentPage} of {numPages || '...'}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            aria-label="Next page"
            className="min-h-touch min-w-touch"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-1" role="group" aria-label="Zoom controls">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            aria-label="Zoom out"
            className="min-h-touch min-w-touch"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomIn}
            disabled={scale >= 3}
            aria-label="Zoom in"
            className="min-h-touch min-w-touch"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleResetZoom}
            aria-label="Reset zoom"
            className="min-h-touch min-w-touch"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* PDF Content */}
      <ScrollArea className="flex-1">
        <div 
          className="min-h-full flex items-start justify-center p-4 bg-court-slate-900/50"
          onMouseUp={handleTextSelection}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p className="text-lg mb-4">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
              className="relative"
            >
              <div className="relative">
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="shadow-2xl"
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
                
                {/* Annotation overlays */}
                {pageAnnotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    className={`
                      absolute pointer-events-none
                      ${annotation.annotation_type === 'highlight' ? 'annotation-highlight' : ''}
                    `}
                    style={{
                      left: annotation.annotation_json.boundingRect?.x,
                      top: annotation.annotation_json.boundingRect?.y,
                      width: annotation.annotation_json.boundingRect?.width,
                      height: annotation.annotation_json.boundingRect?.height,
                    }}
                    aria-label={`${annotation.annotation_type} annotation`}
                  />
                ))}
              </div>
            </Document>
          )}
        </div>
      </ScrollArea>

      {/* Floating Annotation Toolbar */}
      {documentId && (
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />
      )}
    </div>
  );
}