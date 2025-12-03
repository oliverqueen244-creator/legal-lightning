import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { LiveBoardCache } from '@/types/database';

interface CourtFormData {
  court_location: string;
  court_no: string;
  current_item: number;
  is_supplementary_running: boolean;
}

const initialFormData: CourtFormData = {
  court_location: 'JODHPUR',
  court_no: '',
  current_item: 1,
  is_supplementary_running: false,
};

export function CourtConfig() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CourtFormData>(initialFormData);

  const { data: liveBoards, isLoading } = useQuery({
    queryKey: ['admin-live-boards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_board_cache')
        .select('*')
        .order('court_location')
        .order('court_no');
      if (error) throw error;
      return data as LiveBoardCache[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: CourtFormData) => {
      const { error } = await supabase.from('live_board_cache').upsert(data, {
        onConflict: 'court_location,court_no',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-live-boards'] });
      queryClient.invalidateQueries({ queryKey: ['live-board'] });
      toast.success('Court configuration saved');
      setIsOpen(false);
      setFormData(initialFormData);
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  const resetItemMutation = useMutation({
    mutationFn: async ({ location, courtNo }: { location: string; courtNo: string }) => {
      const { error } = await supabase
        .from('live_board_cache')
        .update({ current_item: 1, is_supplementary_running: false })
        .eq('court_location', location)
        .eq('court_no', courtNo);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-live-boards'] });
      queryClient.invalidateQueries({ queryKey: ['live-board'] });
      toast.success('Court reset to item 1');
    },
    onError: (error) => {
      toast.error('Failed to reset: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(formData);
  };

  const handleEdit = (board: LiveBoardCache) => {
    setFormData({
      court_location: board.court_location,
      court_no: board.court_no,
      current_item: board.current_item,
      is_supplementary_running: board.is_supplementary_running,
    });
    setIsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Court Configuration</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="gold" size="sm" onClick={() => setFormData(initialFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Court
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Court</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Court Location</Label>
                  <Select
                    value={formData.court_location}
                    onValueChange={(val) => setFormData({ ...formData, court_location: val })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JODHPUR">Jodhpur</SelectItem>
                      <SelectItem value="JAIPUR">Jaipur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="court_no">Court No</Label>
                  <Input
                    id="court_no"
                    value={formData.court_no}
                    onChange={(e) => setFormData({ ...formData, court_no: e.target.value })}
                    placeholder="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="current_item">Current Item</Label>
                <Input
                  id="current_item"
                  type="number"
                  min={1}
                  value={formData.current_item}
                  onChange={(e) => setFormData({ ...formData, current_item: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_supplementary">Supplementary Running</Label>
                <Switch
                  id="is_supplementary"
                  checked={formData.is_supplementary_running}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_supplementary_running: checked })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" variant="gold">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : liveBoards?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No courts configured yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Court No</TableHead>
                <TableHead>Current Item</TableHead>
                <TableHead>Supplementary</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveBoards?.map((board) => (
                <TableRow key={`${board.court_location}-${board.court_no}`}>
                  <TableCell>{board.court_location}</TableCell>
                  <TableCell>{board.court_no}</TableCell>
                  <TableCell className="font-medium">{board.current_item}</TableCell>
                  <TableCell>{board.is_supplementary_running ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(board.last_updated).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(board)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => resetItemMutation.mutate({ location: board.court_location, courtNo: board.court_no })}
                      aria-label="Reset court to item 1"
                    >
                      <RefreshCw className="h-4 w-4" />
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
