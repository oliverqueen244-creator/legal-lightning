import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileCheck, 
  Calendar, 
  MapPin, 
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface RawCauselist {
  id: string;
  bench: string;
  list_type: string;
  list_date: string;
  status: string;
  file_name: string | null;
  created_at: string;
  telegram_message_id: number | null;
}

export function RecentCauselistsPanel() {
  const { data: causelists, isLoading } = useQuery({
    queryKey: ['recent-causelists-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_causelists')
        .select('id, bench, list_type, list_date, status, file_name, created_at, telegram_message_id')
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (error) throw error;
      return data as RawCauselist[];
    },
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'parsed_complete':
        return <Badge className="bg-court-success/20 text-court-success border-court-success/30">Parsed</Badge>;
      case 'text_extracted':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Extracted</Badge>;
      case 'notes_extracted':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Notes Done</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'error':
        return <Badge variant="danger">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceIcon = (telegramId: number | null) => {
    if (telegramId) {
      return <Badge variant="outline" className="text-xs">Telegram</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Upload</Badge>;
  };

  // Group by date for quick duplicate check
  const dateGroups = causelists?.reduce((acc, cl) => {
    const key = `${cl.list_date}-${cl.bench}-${cl.list_type}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cl);
    return acc;
  }, {} as Record<string, RawCauselist[]>) || {};

  const hasDuplicates = Object.values(dateGroups).some(group => group.length > 1);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Recent Causelist Uploads
          {hasDuplicates && (
            <Badge variant="danger" className="ml-2">
              <AlertCircle className="h-3 w-3 mr-1" />
              Duplicates Found
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Check before uploading to avoid duplicates. Shows last 15 uploads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : causelists && causelists.length > 0 ? (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">List Date</TableHead>
                  <TableHead className="w-[90px]">Bench</TableHead>
                  <TableHead className="w-[80px]">Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]">Source</TableHead>
                  <TableHead className="w-[120px]">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {causelists.map((cl) => {
                  const key = `${cl.list_date}-${cl.bench}-${cl.list_type}`;
                  const isDuplicate = dateGroups[key]?.length > 1;
                  
                  return (
                    <TableRow 
                      key={cl.id}
                      className={isDuplicate ? 'bg-court-warning/10' : ''}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(parseISO(cl.list_date), 'dd MMM')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {cl.bench}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cl.list_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {cl.file_name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(cl.status)}</TableCell>
                      <TableCell>{getSourceIcon(cl.telegram_message_id)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(parseISO(cl.created_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No causelists uploaded yet</p>
          </div>
        )}

        {/* Quick Summary */}
        {causelists && causelists.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-court-success" />
                <span className="text-muted-foreground">Latest:</span>
                <span className="font-medium">
                  {causelists[0].bench} {causelists[0].list_type} - {format(parseISO(causelists[0].list_date), 'dd MMM yyyy')}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
