import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Users, FileText, Bell, Shield,
  Keyboard, Eye, Monitor, Zap, Download, Github, Code, ExternalLink,
  Layers, Globe, Palette, Settings
} from 'lucide-react';
import { documentationContent } from '@/data/docsData';
import { appendix } from '@/data/appendix';
import { userGuideData } from '@/data/userGuideData';
import logoImage from '@/assets/logo.png';

import { Magnetic } from '@/components/animations/Magnetic';
import { BreathingType } from '@/components/animations/BreathingType';
import { KineticProgress } from '@/components/animations/KineticProgress';

export default function Documentation() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <KineticProgress />

      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={logoImage} alt="Nyay-Hub" className="h-6 w-6" />
              <h1 className="font-display text-xl font-bold text-foreground">
                Nyay-Hub Documentation
              </h1>
            </div>
            <Magnetic>
              <Button variant="gold" size="sm" onClick={handlePrint}>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Save as PDF
              </Button>
            </Magnetic>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <ScrollArea className="h-full">
          {/* Title Section */}
          <div className="text-center mb-12">
            <img src={logoImage} alt="Nyay-Hub" className="h-16 w-16 mx-auto mb-4" />
            <BreathingType>
              <h1 className="font-display text-4xl font-bold text-foreground mb-2">
                Nyay-Hub
              </h1>
            </BreathingType>
            <p className="text-xl text-muted-foreground">Rajasthan High Court Case Management</p>
          </div>

          {/* System Flowcharts */}
          <Card className="mb-8 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Architectural Flowcharts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {documentationContent.flowcharts.map((chart, i) => (
                <div key={i} className="space-y-3">
                  <h3 className="font-semibold text-foreground">{chart.title}</h3>
                  <div className="p-4 rounded bg-muted/30 border border-border font-mono text-[10px] overflow-x-auto leading-tight">
                    <pre className="text-muted-foreground whitespace-pre">{chart.chart}</pre>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* User Roles */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Roles & permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {userGuideData.roles.map((role, i) => (
                <div key={i} className="space-y-3">
                  <h3 className="font-bold text-foreground border-l-4 border-primary pl-3">{role.title}</h3>
                  <ul className="space-y-2">
                    {role.features.map((feat, j) => (
                      <li key={j} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary">•</span> {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {documentationContent.features.map((f, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    {f.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Accessibility & Security */}
          <div className="grid gap-6 md:grid-cols-2 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Accessibility
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {userGuideData.accessibility.map((a, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="mt-1"><Palette className="h-3 w-3 text-primary" /></div>
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {userGuideData.security.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /> {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center py-8 text-muted-foreground text-sm border-t border-border/50">
            <p>Nyay-Hub Sovereign | Advanced Legal Workflow</p>
            <p className="mt-1 opacity-50">v1.2.0 • Data Managed Electronically</p>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
