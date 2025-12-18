import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CaseDocumentExtended, DocumentUploadMetadata, DocumentType } from '@/types/documents';

// Fetch documents with extended fields
export function useExtendedDocuments(docketId: string) {
  return useQuery({
    queryKey: ['extended-documents', docketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('docket_id', docketId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      
      // Map to extended type with defaults for backward compatibility
      return (data || []).map((doc): CaseDocumentExtended => ({
        id: doc.id,
        docket_id: doc.docket_id || '',
        file_url: doc.file_url || '',
        doc_type: doc.doc_type,
        uploaded_at: doc.uploaded_at || new Date().toISOString(),
        document_type: (doc as any).document_type || null,
        version: (doc as any).version || 1,
        is_primary: (doc as any).is_primary || false,
        pending_review: (doc as any).pending_review ?? true,
        language: (doc as any).language || 'UNKNOWN',
        format: (doc as any).format || 'TYPED',
        legibility: (doc as any).legibility || 'CLEAR',
        uploaded_by: (doc as any).uploaded_by || null,
        review_status: (doc as any).review_status || 'pending',
        reviewed_by: (doc as any).reviewed_by || null,
        reviewed_at: (doc as any).reviewed_at || null,
      }));
    },
    enabled: !!docketId,
  });
}

// Upload document with metadata
export function useDocumentUpload(docketId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const uploadDocument = async (file: File, metadata: DocumentUploadMetadata) => {
    setUploading(true);
    setProgress(0);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate next version number
      const { data: existingDocs } = await supabase
        .from('case_documents')
        .select('version')
        .eq('docket_id', docketId)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existingDocs?.[0] as any)?.version ? (existingDocs[0] as any).version + 1 : 1;

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${docketId}/${metadata.document_type}_v${nextVersion}_${Date.now()}.${fileExt}`;

      setProgress(25);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(50);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('case-documents')
        .getPublicUrl(fileName);

      setProgress(75);

      // Insert record with metadata
      const { error: insertError } = await supabase
        .from('case_documents')
        .insert({
          docket_id: docketId,
          file_url: publicUrl,
          doc_type: file.type,
          document_type: metadata.document_type,
          language: metadata.language,
          format: metadata.format,
          legibility: metadata.legibility,
          uploaded_by: user.id,
          version: nextVersion,
          is_primary: false,
          pending_review: true,
          review_status: 'pending',
        } as any);

      if (insertError) throw insertError;

      setProgress(100);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['extended-documents', docketId] });
      queryClient.invalidateQueries({ queryKey: ['case-documents', docketId] });

      return { success: true };
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadDocument,
    uploading,
    progress,
  };
}

// Document review actions (for seniors)
export function useDocumentReview(docketId: string) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('case_documents')
        .update({
          review_status: 'approved',
          pending_review: false,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extended-documents', docketId] });
      queryClient.invalidateQueries({ queryKey: ['case-documents', docketId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('case_documents')
        .update({
          review_status: 'rejected',
          pending_review: false,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extended-documents', docketId] });
      queryClient.invalidateQueries({ queryKey: ['case-documents', docketId] });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async ({ docId, docType }: { docId: string; docType: DocumentType }) => {
      // First, unset any existing primary of the same type
      const { error: unsetError } = await supabase
        .from('case_documents')
        .update({ is_primary: false } as any)
        .eq('docket_id', docketId)
        .eq('document_type', docType);

      if (unsetError) throw unsetError;

      // Then set the new primary
      const { error } = await supabase
        .from('case_documents')
        .update({ is_primary: true } as any)
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extended-documents', docketId] });
      queryClient.invalidateQueries({ queryKey: ['case-documents', docketId] });
    },
  });

  return {
    approveDocument: approveMutation.mutateAsync,
    rejectDocument: rejectMutation.mutateAsync,
    setPrimaryDocument: (docId: string, docType: DocumentType) =>
      setPrimaryMutation.mutateAsync({ docId, docType }),
  };
}
