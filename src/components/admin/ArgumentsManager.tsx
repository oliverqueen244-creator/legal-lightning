import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DocketItem, CaseArgument } from '@/types/database';

interface ArgumentFormData {
  docket_id: string;
  title: string;
  linked_page_number: number;
}

const initialFormData: ArgumentFormData = {
  docket_id: '',
  title: '',
  linked_page_number: 1,
};

export function ArgumentsManager() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ArgumentFormData>(initialFormData);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const { data: docketItems } = useQuery({
    queryKey: ['admin-docket-for-args'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DocketItem[];
    },
  });

  const { data: caseArgs, isLoading } = useQuery({
    queryKey: ['admin-arguments', selectedCaseId],
    queryFn: async () => {
      if (!selectedCaseId) return [];
      const { data, error } = await supabase
        .from('case_arguments')
        .select('*')
        .eq('docket_id', selectedCaseId)
        .order('linked_page_number', { ascending: true });
      if (error) throw error;
      return data as CaseArgument[];
    },
    enabled: !!selectedCaseId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ArgumentFormData) => {
      const { error } = await supabase.from('case_arguments').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-arguments'] });
      queryClient.invalidateQueries({ queryKey: ['arguments'] });
      toast.success('Argument added successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to add argument: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ArgumentFormData> }) => {
      const { error } = await supabase.from('case_arguments').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-arguments'] });
      queryClient.invalidateQueries({ queryKey: ['arguments'] });
      toast.success('Argument updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update argument: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('case_arguments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-arguments'] });
      queryClient.invalidateQueries({ queryKey: ['arguments'] });
      toast.success('Argument deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete argument: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ ...initialFormData, docket_id: selectedCaseId });
    setEditingId(null);
    setIsOpen(false);
  };

  const handleEdit = (arg: CaseArgument) => {
    setFormData({
      docket_id: arg.docket_id,
      title: arg.title,
      linked_page_number: arg.linked_page_number,
    });
    setEditingId(arg.id);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleNewArgument = () => {
    setFormData({ ...initialFormData, docket_id: selectedCaseId });
    setEditingId(null);
    setIsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Arguments Manager</CardTitle>
        <div className="flex items-center gap-4">
          <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
            <SelectTrigger className="w-[250px]" aria-label="Select case">
              <SelectValue placeholder="Select a case" />
            </SelectTrigger>
            <SelectContent>
              {docketItems?.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.case_number} ({item.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedCaseId && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="gold" size="sm" onClick={handleNewArgument}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Argument
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Argument' : 'Add New Argument'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Argument Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Jurisdictional Challenge"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="page">Linked Page Number</Label>
                    <Input
                      id="page"
                      type="number"
                      min={1}
                      value={formData.linked_page_number}
                      onChange={(e) => setFormData({ ...formData, linked_page_number: parseInt(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button type="submit" variant="gold">
                      {editingId ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!selectedCaseId ? (
          <p className="text-muted-foreground text-center py-8">Select a case to manage its arguments</p>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : caseArgs?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No arguments for this case yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caseArgs?.map((arg, index) => (
                <TableRow key={arg.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{arg.title}</TableCell>
                  <TableCell>{arg.linked_page_number}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(arg)} aria-label="Edit argument">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => deleteMutation.mutate(arg.id)}
                      aria-label="Delete argument"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
