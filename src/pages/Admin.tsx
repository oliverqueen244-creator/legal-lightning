import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale, Calendar, FileText, Settings, Activity, FileCheck } from 'lucide-react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { DocketManager } from '@/components/admin/DocketManager';
import { ArgumentsManager } from '@/components/admin/ArgumentsManager';
import { CourtConfig } from '@/components/admin/CourtConfig';
import { SyncMonitorPanel } from '@/components/admin/SyncMonitorPanel';
import { DataValidationPanel } from '@/components/admin/DataValidationPanel';

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('docket');

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Scale className="h-12 w-12 text-primary animate-pulse" />
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <Scale className="h-16 w-16 text-destructive" />
          <h1 className="font-display text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
          <Button variant="gold" onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  aria-label="Go back to dashboard"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div>
                  <h1 className="font-display text-xl font-bold text-primary">
                    Admin Panel
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage cases, arguments, and court configuration
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-3xl grid-cols-5">
              <TabsTrigger value="docket" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Docket</span>
              </TabsTrigger>
              <TabsTrigger value="arguments" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Arguments</span>
              </TabsTrigger>
              <TabsTrigger value="courts" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Courts</span>
              </TabsTrigger>
              <TabsTrigger value="sync" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Sync</span>
              </TabsTrigger>
              <TabsTrigger value="validation" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Validate</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="docket" className="space-y-4">
              <DocketManager />
            </TabsContent>

            <TabsContent value="arguments" className="space-y-4">
              <ArgumentsManager />
            </TabsContent>

            <TabsContent value="courts" className="space-y-4">
              <CourtConfig />
            </TabsContent>

            <TabsContent value="sync" className="space-y-4">
              <SyncMonitorPanel />
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <DataValidationPanel />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGuard>
  );
}