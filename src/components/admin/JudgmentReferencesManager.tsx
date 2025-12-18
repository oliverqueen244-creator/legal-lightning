import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Trash2, ExternalLink, Scale, X } from 'lucide-react';
import { format } from 'date-fns';

interface JudgmentReference {
  id: string;
  judge_name: string;
  court: string;
  case_type: string;
  judgment_date: string;
  indian_kanoon_url: string;
  lawyer_names: string[];
  added_at: string;
}

const CASE_TYPES = [
  'Civil Appeal',
  'Criminal Appeal',
  'Writ Petition (Civil)',
  'Writ Petition (Criminal)',
  'Special Leave Petition',
  'Transfer Petition',
  'Review Petition',
  'Contempt Petition',
  'Arbitration Petition',
  'Company Petition',
  'Tax Appeal',
  'Service Matter',
  'Land Acquisition',
  'Family Matter',
  'Other'
];

const COURTS = [
  'Supreme Court of India',
  'Rajasthan High Court - Jaipur',
  'Rajasthan High Court - Jodhpur',
  'Delhi High Court',
  'Bombay High Court',
  'Madras High Court',
  'Calcutta High Court',
  'Other'
];

export function JudgmentReferencesManager() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    judge_name: '',
    court: '',
    case_type: '',
    judgment_date: '',
    indian_kanoon_url: '',
    lawyer_names: [] as string[],
    newLawyer: ''
  });

  // Fetch existing references
  const { data: references, isLoading } = useQuery({
    queryKey: ['judgment-references'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_judgment_references')
        .select('*')
        .order('judgment_date', { ascending: false });
      
      if (error) throw error;
      return data as JudgmentReference[];
    }
  });

  // Add reference mutation
  const addMutation = useMutation({
    mutationFn: async (data: Omit<JudgmentReference, 'id' | 'added_at'>) => {
      const { error } = await supabase
        .from('judge_judgment_references')
        .insert(data);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judgment-references'] });
      toast.success('Judgment reference added');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to add reference: ' + error.message);
    }
  });

  // Delete reference mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('judge_judgment_references')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judgment-references'] });
      toast.success('Reference deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      judge_name: '',
      court: '',
      case_type: '',
      judgment_date: '',
      indian_kanoon_url: '',
      lawyer_names: [],
      newLawyer: ''
    });
  };

  const addLawyer = () => {
    if (formData.newLawyer.trim()) {
      setFormData(prev => ({
        ...prev,
        lawyer_names: [...prev.lawyer_names, prev.newLawyer.trim()],
        newLawyer: ''
      }));
    }
  };

  const removeLawyer = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lawyer_names: prev.lawyer_names.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.judge_name || !formData.court || !formData.case_type || 
        !formData.judgment_date || !formData.indian_kanoon_url) {
      toast.error('Please fill all required fields');
      return;
    }

    // Validate Indian Kanoon URL
    if (!formData.indian_kanoon_url.includes('indiankanoon.org')) {
      toast.error('URL must be from indiankanoon.org');
      return;
    }

    addMutation.mutate({
      judge_name: formData.judge_name,
      court: formData.court,
      case_type: formData.case_type,
      judgment_date: formData.judgment_date,
      indian_kanoon_url: formData.indian_kanoon_url,
      lawyer_names: formData.lawyer_names
    });
  };

  return (
    <div className="space-y-6">
      {/* Add New Reference Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Add Judgment Reference
          </CardTitle>
          <CardDescription>
            Add Indian Kanoon judgment links for reference. Only metadata and links are stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="judge_name">Judge Name *</Label>
                <Input
                  id="judge_name"
                  placeholder="Hon'ble Justice..."
                  value={formData.judge_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, judge_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="court">Court *</Label>
                <Select 
                  value={formData.court} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, court: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURTS.map(court => (
                      <SelectItem key={court} value={court}>{court}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="case_type">Case Type *</Label>
                <Select 
                  value={formData.case_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, case_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="judgment_date">Judgment Date *</Label>
                <Input
                  id="judgment_date"
                  type="date"
                  value={formData.judgment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, judgment_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="indian_kanoon_url">Indian Kanoon URL *</Label>
              <Input
                id="indian_kanoon_url"
                type="url"
                placeholder="https://indiankanoon.org/doc/..."
                value={formData.indian_kanoon_url}
                onChange={(e) => setFormData(prev => ({ ...prev, indian_kanoon_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Lawyer Names (as per judgment header)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add lawyer name"
                  value={formData.newLawyer}
                  onChange={(e) => setFormData(prev => ({ ...prev, newLawyer: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLawyer())}
                />
                <Button type="button" variant="outline" onClick={addLawyer}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.lawyer_names.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.lawyer_names.map((lawyer, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {lawyer}
                      <button 
                        type="button"
                        onClick={() => removeLawyer(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" variant="gold" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Adding...' : 'Add Reference'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing References */}
      <Card>
        <CardHeader>
          <CardTitle>Existing References</CardTitle>
          <CardDescription>
            {references?.length || 0} judgment references in database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Scale className="h-8 w-8 text-primary animate-pulse" />
            </div>
          ) : references?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No judgment references added yet.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {references?.map((ref) => (
                  <div 
                    key={ref.id} 
                    className="p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {ref.judge_name}
                          </span>
                          <Badge variant="outline">{ref.case_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ref.court} • {format(new Date(ref.judgment_date), 'dd MMM yyyy')}
                        </p>
                        {ref.lawyer_names.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ref.lawyer_names.map((lawyer, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {lawyer}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(ref.indian_kanoon_url, '_blank')}
                          aria-label="Open on Indian Kanoon"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(ref.id)}
                          className="text-destructive hover:text-destructive"
                          aria-label="Delete reference"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}