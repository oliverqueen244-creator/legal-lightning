import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale, Calendar, FileText, Settings, Activity, FileCheck, Database, Gavel, Brain, ClipboardCheck, AlertTriangle, Gauge, Layers, Smartphone } from 'lucide-react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { DocketManager } from '@/components/admin/DocketManager';
import { ArgumentsManager } from '@/components/admin/ArgumentsManager';
import { CourtConfig } from '@/components/admin/CourtConfig';
import { SyncMonitorPanel } from '@/components/admin/SyncMonitorPanel';
import { DataValidationPanel } from '@/components/admin/DataValidationPanel';
import { CauseListScraper } from '@/components/admin/CauseListScraper';
import { JudgmentReferencesManager } from '@/components/admin/JudgmentReferencesManager';
import { AiJobsMonitor } from '@/components/admin/AiJobsMonitor';
import { AuditConsole } from '@/components/admin/audit/AuditConsole';
import { AdminErrorConsole } from '@/components/admin/errors';
import { ConfidenceDashboard } from '@/components/admin/ConfidenceDashboard';
import { FallbackDashboard } from '@/components/admin/FallbackDashboard';
import { ForceUpdateControl } from '@/components/admin/ForceUpdateControl';

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('errors');

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
            <TabsList className="grid w-full max-w-7xl grid-cols-13">
              <TabsTrigger value="errors" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Errors</span>
              </TabsTrigger>
              <TabsTrigger value="confidence" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                <span className="hidden sm:inline">Confidence</span>
              </TabsTrigger>
              <TabsTrigger value="fallback" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Fallback</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Audit</span>
              </TabsTrigger>
              <TabsTrigger value="scraper" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Scraper</span>
              </TabsTrigger>
              <TabsTrigger value="ai-jobs" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">AI Jobs</span>
              </TabsTrigger>
              <TabsTrigger value="docket" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Docket</span>
              </TabsTrigger>
              <TabsTrigger value="arguments" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Arguments</span>
              </TabsTrigger>
              <TabsTrigger value="judgments" className="flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                <span className="hidden sm:inline">Judgments</span>
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
              <TabsTrigger value="pwa" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">PWA</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="errors" className="space-y-4">
              <AdminErrorConsole />
            </TabsContent>

            <TabsContent value="confidence" className="space-y-4">
              <ConfidenceDashboard />
            </TabsContent>

            <TabsContent value="fallback" className="space-y-4">
              <FallbackDashboard />
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <AuditConsole />
            </TabsContent>

            <TabsContent value="scraper" className="space-y-4">
              <CauseListScraper />
            </TabsContent>

            <TabsContent value="ai-jobs" className="space-y-4">
              <AiJobsMonitor />
            </TabsContent>

            <TabsContent value="docket" className="space-y-4">
              <DocketManager />
            </TabsContent>

            <TabsContent value="arguments" className="space-y-4">
              <ArgumentsManager />
            </TabsContent>

            <TabsContent value="judgments" className="space-y-4">
              <JudgmentReferencesManager />
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

            <TabsContent value="pwa" className="space-y-4">
              <ForceUpdateControl />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGuard>
  );
}