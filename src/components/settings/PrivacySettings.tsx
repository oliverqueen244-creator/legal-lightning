import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Trash2, Loader2 } from 'lucide-react';

/**
 * DPDP Act 2023 self-service:
 *   - Export everything we hold about you (right to access / portability)
 *   - Delete account and anonymise data (right to erasure)
 */
export function PrivacySettings() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('request_data_export');
      if (error) throw new Error(error.message);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nyayhub-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded.');
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('account-deletion', { body: {} });
      if (error) throw new Error(error.message);
      toast.success('Account deleted. Goodbye.');
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e) {
      toast.error(`Deletion failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-semibold">Export your data</h3>
        <p className="text-sm text-muted-foreground">
          Download everything we hold about you — your profile, tracked cases, aliases, consent
          history, and case-access audit trail — as a JSON file.
        </p>
        <Button onClick={handleExport} disabled={exporting} variant="outline">
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Download my data
        </Button>
      </section>

      <section className="space-y-2 pt-4 border-t border-destructive/30">
        <h3 className="font-semibold text-destructive">Delete account</h3>
        <p className="text-sm text-muted-foreground">
          Anonymises your profile, revokes aliases, and deletes your login. Case data already
          shared with chamber colleagues stays with them (anonymised authorship).
          <br />
          <strong>This action is permanent.</strong>
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently sign you out and anonymise your data. You won't be able to
                sign back in with this email. Export your data first if you need a copy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Yes, delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
