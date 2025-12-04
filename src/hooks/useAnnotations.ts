import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export interface Annotation {
  id: string;
  document_id: string;
  user_id: string;
  page_number: number;
  annotation_type: 'highlight' | 'pen' | 'text';
  annotation_json: {
    color?: string;
    text?: string;
    coordinates?: { x: number; y: number }[];
    boundingRect?: { x: number; y: number; width: number; height: number };
  };
  created_at: string;
}

export function useAnnotations(documentId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch annotations for a document
  const { data: annotations = [], isLoading, error } = useQuery({
    queryKey: ['annotations', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const { data, error } = await supabase
        .from('document_annotations')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Annotation[];
    },
    enabled: !!documentId,
  });

  // Subscribe to realtime changes
  useEffect(() => {
    if (!documentId) return;

    const channel = supabase
      .channel(`annotations-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_annotations',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ['annotations', documentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, queryClient]);

  // Add annotation
  const addAnnotation = useMutation({
    mutationFn: async (annotation: Omit<Annotation, 'id' | 'created_at' | 'user_id'>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('document_annotations')
        .insert({
          ...annotation,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', documentId] });
    },
  });

  // Update annotation
  const updateAnnotation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Annotation> & { id: string }) => {
      const { data, error } = await supabase
        .from('document_annotations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', documentId] });
    },
  });

  // Delete annotation
  const deleteAnnotation = useMutation({
    mutationFn: async (annotationId: string) => {
      const { error } = await supabase
        .from('document_annotations')
        .delete()
        .eq('id', annotationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', documentId] });
    },
  });

  return {
    annotations,
    isLoading,
    error,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  };
}