import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFileUpload(docketId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${docketId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get signed URL (1 hour expiration) instead of public URL
      // The bucket is now private for security
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('case-documents')
        .createSignedUrl(fileName, 3600); // 1 hour expiration

      if (signedUrlError) throw signedUrlError;

      // Insert record into case_documents table
      // Store the path, not the signed URL (signed URLs expire)
      const { error: insertError } = await supabase
        .from('case_documents')
        .insert({
          docket_id: docketId,
          file_url: fileName, // Store path, generate signed URL when needed
          doc_type: file.type,
        });

      if (insertError) throw insertError;

      setProgress(100);
      toast.success(`${file.name} uploaded successfully`);
      return { url: signedUrlData.signedUrl, path: fileName, error: null };
    } catch (error: any) {
      toast.error(`Failed to upload: ${error.message}`);
      return { url: null, path: null, error };
    } finally {
      setUploading(false);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const results = [];
    for (const file of Array.from(files)) {
      const result = await uploadFile(file);
      results.push(result);
    }
    return results;
  };

  // Helper function to get a fresh signed URL for a stored file path
  const getSignedUrl = async (filePath: string, expiresIn: number = 3600) => {
    const { data, error } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Failed to get signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  return {
    uploadFile,
    uploadFiles,
    uploading,
    progress,
    getSignedUrl,
  };
}
