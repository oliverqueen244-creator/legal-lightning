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
import type { DocketItem } from '@/types/database';

interface DocketFormData {
  date: string;
  court_location: 'JODHPUR' | 'JAIPUR';
  list_type: 'DAILY' | 'SUPPLEMENTARY';
  court_room_no: string;
  item_no: number;
  case_number: string;
  petitioner_lawyer: string;
  respondent_lawyer: string;
}

const initialFormData: DocketFormData = {
  date: new Date().toISOString().split('T')[0],
  court_location: 'JODHPUR',
  list_type: 'DAILY',
  court_room_no: '',
  item_no: 1,
  case_number: '',
  petitioner_lawyer: '',
  respondent_lawyer: '',
};

export function DocketManager() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DocketFormData>(initialFormData);

  const { data: docketItems, isLoading } = useQuery({
    queryKey: ['admin-docket'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .order('date', { ascending: false })
        .order('item_no', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as DocketItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DocketFormData) => {
      const { error } = await supabase.from('daily_court_docket').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-docket'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });
      toast.success('Case added successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to add case: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocketFormData> }) => {
      const { error } = await supabase.from('daily_court_docket').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-docket'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });
      toast.success('Case updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update case: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_court_docket').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-docket'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });
      toast.success('Case deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete case: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setIsOpen(false);
  };

  const handleEdit = (item: DocketItem) => {
    setFormData({
      date: item.date,
      court_location: item.court_location,
      list_type: item.list_type as 'DAILY' | 'SUPPLEMENTARY',
      court_room_no: item.court_room_no,
      item_no: item.item_no,
      case_number: item.case_number,
      petitioner_lawyer: item.petitioner_lawyer || '',
      respondent_lawyer: item.respondent_lawyer || '',
    });
    setEditingId(item.id);
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Docket Management</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="gold" size="sm" onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Case' : 'Add New Case'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item_no">Item No</Label>
                  <Input
                    id="item_no"
                    type="number"
                    min={1}
                    value={formData.item_no}
                    onChange={(e) => setFormData({ ...formData, item_no: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="case_number">Case Number</Label>
                <Input
                  id="case_number"
                  value={formData.case_number}
                  onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                  placeholder="WP(C) 12345/2024"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Court Location</Label>
                  <Select
                    value={formData.court_location}
                    onValueChange={(val) => setFormData({ ...formData, court_location: val as 'JODHPUR' | 'JAIPUR' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JODHPUR">Jodhpur</SelectItem>
                      <SelectItem value="JAIPUR">Jaipur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>List Type</Label>
                  <Select
                    value={formData.list_type}
                    onValueChange={(val) => setFormData({ ...formData, list_type: val as 'DAILY' | 'SUPPLEMENTARY' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="SUPPLEMENTARY">Supplementary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="court_room_no">Court Room No</Label>
                <Input
                  id="court_room_no"
                  value={formData.court_room_no}
                  onChange={(e) => setFormData({ ...formData, court_room_no: e.target.value })}
                  placeholder="1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="petitioner_lawyer">Petitioner Lawyer</Label>
                <Input
                  id="petitioner_lawyer"
                  value={formData.petitioner_lawyer}
                  onChange={(e) => setFormData({ ...formData, petitioner_lawyer: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="respondent_lawyer">Respondent Lawyer</Label>
                <Input
                  id="respondent_lawyer"
                  value={formData.respondent_lawyer}
                  onChange={(e) => setFormData({ ...formData, respondent_lawyer: e.target.value })}
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Case Number</TableHead>
                  <TableHead>Court</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docketItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.item_no}</TableCell>
                    <TableCell className="font-medium">{item.case_number}</TableCell>
                    <TableCell>{item.court_location} #{item.court_room_no}</TableCell>
                    <TableCell>{item.list_type}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} aria-label="Edit case">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteMutation.mutate(item.id)}
                        aria-label="Delete case"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
