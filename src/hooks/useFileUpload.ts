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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('case-documents')
        .getPublicUrl(fileName);

      // Insert record into case_documents table
      const { error: insertError } = await supabase
        .from('case_documents')
        .insert({
          docket_id: docketId,
          file_url: publicUrl,
          doc_type: file.type,
        });

      if (insertError) throw insertError;

      setProgress(100);
      toast.success(`${file.name} uploaded successfully`);
      return { url: publicUrl, error: null };
    } catch (error: any) {
      toast.error(`Failed to upload: ${error.message}`);
      return { url: null, error };
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

  return {
    uploadFile,
    uploadFiles,
    uploading,
    progress,
  };
}
