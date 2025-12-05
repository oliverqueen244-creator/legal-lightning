import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAliases } from '@/hooks/useAliases';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, CheckCircle2, Scale, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { MatchedCase } from '@/types/database';

interface CourtScanProps {
  bench: 'JAIPUR' | 'JODHPUR';
}

export default function CourtScan({ bench }: CourtScanProps) {
  const { user } = useAuth();
  const { aliases } = useAliases();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCases, setScannedCases] = useState<MatchedCase[]>([]);
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const handleScan = async () => {
    if (aliases.length === 0) {
      toast.error('Please add at least one name variation first');
      return;
    }

    setIsScanning(true);
    setScannedCases([]);
    setScanComplete(false);

    try {
      // Get alias names
      const aliasNames = aliases.map((a) => a.alias_name);

      // Query docket for matching cases
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .or(
          aliasNames
            .map((name) => `petitioner_lawyer.ilike.%${name}%,respondent_lawyer.ilike.%${name}%`)
            .join(',')
        )
        .is('matched_profile_id', null)
        .order('date', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform to MatchedCase format
      const matched: MatchedCase[] = (data || []).map((item) => {
        const matchedAlias = aliasNames.find(
          (name) =>
            item.petitioner_lawyer?.toLowerCase().includes(name.toLowerCase()) ||
            item.respondent_lawyer?.toLowerCase().includes(name.toLowerCase())
        );
        const matchedAs = item.petitioner_lawyer?.toLowerCase().includes(matchedAlias?.toLowerCase() || '')
          ? 'petitioner'
          : 'respondent';

        return {
          id: item.id,
          case_number: item.case_number || 'Unknown',
          court_location: item.court_location || bench,
          court_room_no: item.court_room_no || 'N/A',
          item_no: item.item_no || 0,
          date: item.date,
          matched_as: matchedAs,
          alias_matched: matchedAlias || '',
        };
      });

      setScannedCases(matched);
      // Auto-select all cases
      setSelectedCases(new Set(matched.map((c) => c.id)));
      setScanComplete(true);

      if (matched.length === 0) {
        toast.info('No matching cases found in current records');
      } else {
        toast.success(`Found ${matched.length} potential cases`);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan court records');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedCases.size === 0) {
      toast.error('Please select at least one case to confirm');
      return;
    }

    setIsConfirming(true);

    try {
      const { error } = await supabase
        .from('daily_court_docket')
        .update({ matched_profile_id: user?.id })
        .in('id', Array.from(selectedCases));

      if (error) throw error;

      toast.success(`${selectedCases.size} cases linked to your profile`);
      setScannedCases((prev) => prev.filter((c) => !selectedCases.has(c.id)));
      setSelectedCases(new Set());
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error('Failed to link cases');
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleCase = (caseId: string) => {
    const newSelected = new Set(selectedCases);
    if (newSelected.has(caseId)) {
      newSelected.delete(caseId);
    } else {
      newSelected.add(caseId);
    }
    setSelectedCases(newSelected);
  };

  const toggleAll = () => {
    if (selectedCases.size === scannedCases.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(scannedCases.map((c) => c.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Search className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">Sync with High Court Records</h3>
          <p className="text-sm text-muted-foreground">
            We'll search the {bench} Bench records for cases matching your name variations.
          </p>
        </div>

        {!scanComplete && (
          <Button
            size="lg"
            onClick={handleScan}
            disabled={isScanning || aliases.length === 0}
            className="w-full max-w-xs"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning Records...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Start Scan
              </>
            )}
          </Button>
        )}
      </div>

      {/* Results */}
      {scanComplete && scannedCases.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Found {scannedCases.length} cases
            </p>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selectedCases.size === scannedCases.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {scannedCases.map((caseItem) => (
              <Card
                key={caseItem.id}
                className={`p-3 cursor-pointer transition-all ${
                  selectedCases.has(caseItem.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleCase(caseItem.id)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedCases.has(caseItem.id)}
                    onCheckedChange={() => toggleCase(caseItem.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">
                        {caseItem.case_number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {caseItem.matched_as}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {caseItem.court_room_no}
                      </span>
                      <span className="flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        Item {caseItem.item_no}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(caseItem.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-primary mt-1">
                      Matched: "{caseItem.alias_matched}"
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button
            onClick={handleConfirm}
            disabled={selectedCases.size === 0 || isConfirming}
            className="w-full"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Linking Cases...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm {selectedCases.size} Case{selectedCases.size !== 1 ? 's' : ''} as Mine
              </>
            )}
          </Button>
        </div>
      )}

      {scanComplete && scannedCases.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto text-primary/50 mb-2" />
          <p>No unlinked cases found matching your aliases.</p>
          <p className="text-xs mt-1">You can always rescan from the dashboard later.</p>
        </div>
      )}
    </div>
  );
}
