import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Scale, Users, FileText, Bell, Shield, 
  Keyboard, Eye, Monitor, Zap, Download, Github, Code, ExternalLink
} from 'lucide-react';

export default function Documentation() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Scale className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="font-display text-xl font-bold text-foreground">
                Vakalat-OS Documentation
              </h1>
            </div>
            <Button variant="gold" size="sm" onClick={handlePrint}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Save as PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <ScrollArea className="h-full">
          {/* Title Section */}
          <div className="text-center mb-12">
            <Scale className="h-16 w-16 text-primary mx-auto mb-4" aria-hidden="true" />
            <h1 className="font-display text-4xl font-bold text-foreground mb-2">
              Vakalat-OS
            </h1>
            <p className="text-xl text-muted-foreground">
              Rajasthan High Court Case Management System
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Complete User Guide & Documentation
            </p>
          </div>

          {/* Overview */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" aria-hidden="true" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p className="text-muted-foreground">
                Vakalat-OS is a real-time court case management dashboard designed for advocates 
                at the Rajasthan High Court. The system provides live case tracking, panic alerts 
                for upcoming cases, document management, and seamless communication between 
                senior advocates and their juniors.
              </p>
            </CardContent>
          </Card>

          {/* User Roles */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                User Roles & Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Senior Advocate (War Room View)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Access the War Room for comprehensive case preparation</li>
                  <li>View case documents with argument-linked page navigation</li>
                  <li>Receive real-time whisper notifications from juniors</li>
                  <li>Monitor live court board status and panic alerts</li>
                  <li>Review all arguments with direct PDF page links</li>
                </ul>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Junior Advocate (Control Deck View)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Upload evidence and case documents</li>
                  <li>Send whisper messages to seniors during hearings</li>
                  <li>Monitor case status and court progress</li>
                  <li>Manage document organization</li>
                </ul>
              </div>

              <Separator />
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Admin</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Manage daily court docket entries</li>
                  <li>Configure case arguments and page links</li>
                  <li>Control live board status for all courtrooms</li>
                  <li>Add, edit, and delete cases from the system</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. Live Court Board</h3>
                <p className="text-muted-foreground">
                  Real-time tracking of current item numbers across all courtrooms. The system 
                  automatically calculates distance from your case and triggers panic alerts 
                  when your case is within 5 items of being called.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">2. Panic Alert System</h3>
                <p className="text-muted-foreground">
                  Visual and audio alerts when your case approaches. Cases pulse red when 
                  within 5 items, and glow gold when currently running. Status badges 
                  update in real-time.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3. War Room</h3>
                <p className="text-muted-foreground">
                  Split-screen view with arguments panel on the left and PDF viewer on the right. 
                  Click any argument to instantly jump to the relevant page in your case documents.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4. Whisper System</h3>
                <p className="text-muted-foreground">
                  Real-time messaging between juniors in the control deck and seniors in the 
                  courtroom. Messages appear as toast notifications without disrupting the 
                  hearing flow. Features include:
                </p>
                <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1 ml-4">
                  <li><strong>Voice Memos:</strong> Record and send audio messages with hold-to-record gesture on mobile</li>
                  <li><strong>Notification Sounds:</strong> Audio alerts for incoming messages (can be muted)</li>
                  <li><strong>Unread Counter:</strong> Badge shows number of unread messages</li>
                  <li><strong>Message History:</strong> Scrollable chat with timestamps and sender names</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">5. Document Management</h3>
                <p className="text-muted-foreground">
                  Drag-and-drop file upload for case documents. Supports PDF and other file 
                  formats. Documents are securely stored and linked to specific cases.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">6. Admin Panel</h3>
                <p className="text-muted-foreground">
                  Complete case management interface for administrators. Manage docket entries, 
                  configure arguments, and control live board status for all courtrooms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Accessibility */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
                Accessibility Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Keyboard className="h-4 w-4 text-primary" aria-hidden="true" />
                    Keyboard Navigation
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Full keyboard support throughout the application. Use Tab to navigate, 
                    Enter or Space to activate buttons, and Escape to close dialogs.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
                    Screen Reader Support
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    ARIA labels on all interactive elements. Live regions announce 
                    status changes. Semantic HTML structure throughout.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Focus Indicators</h4>
                  <p className="text-sm text-muted-foreground">
                    Clear visible focus rings on all interactive elements. High contrast 
                    gold outline ensures visibility against dark backgrounds.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Reduced Motion</h4>
                  <p className="text-sm text-muted-foreground">
                    Respects prefers-reduced-motion setting. Animations are disabled 
                    for users who prefer minimal motion.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Skip Links</h4>
                  <p className="text-sm text-muted-foreground">
                    Skip to main content links allow keyboard users to bypass 
                    navigation and jump directly to page content.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Color Contrast</h4>
                  <p className="text-sm text-muted-foreground">
                    WCAG AA compliant color contrast ratios. Gold on dark backgrounds 
                    provides excellent readability.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Touch Targets</h4>
                  <p className="text-sm text-muted-foreground">
                    All interactive elements have minimum 44×44px touch targets for 
                    easy mobile interaction per WCAG guidelines.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Audio Controls</h4>
                  <p className="text-sm text-muted-foreground">
                    Notification sounds can be muted. Voice memos include visual 
                    progress indicators. Haptic feedback on supported devices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                Security Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Secure user authentication with email/password</li>
                <li>Role-based access control (RBAC) with secure role storage</li>
                <li>Row-Level Security (RLS) on all database tables</li>
                <li>Separate user_roles table to prevent privilege escalation</li>
                <li>Security definer functions for role verification</li>
                <li>Protected admin routes with server-side validation</li>
                <li>Secure file storage with access policies</li>
              </ul>
            </CardContent>
          </Card>

          {/* Workflows */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                Common Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Preparing for a Hearing</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Log in and view your cases on the dashboard</li>
                  <li>Check the live ticker for current court status</li>
                  <li>Click on your case to enter War Room (Senior) or Control Deck (Junior)</li>
                  <li>Review arguments and navigate to relevant document pages</li>
                  <li>Monitor panic alerts as your case approaches</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Uploading Documents</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Navigate to Control Deck for your case</li>
                  <li>Drag and drop files onto the upload area</li>
                  <li>Wait for upload confirmation</li>
                  <li>Documents appear in War Room PDF viewer</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Sending a Whisper</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Open Control Deck for the active case</li>
                  <li>Click the chat bubble (bottom-right) to open Whisper Chat</li>
                  <li>Type your message and click send, or press Enter</li>
                  <li>For voice memos: Hold the microphone button to record, release to send</li>
                  <li>Senior receives instant notification with sound alert in War Room</li>
                  <li>Use the speaker icon to mute/unmute notification sounds</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Managing Cases (Admin)</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Access Admin Panel from the header menu</li>
                  <li>Use Docket tab to add/edit cases</li>
                  <li>Use Arguments tab to link arguments to PDF pages</li>
                  <li>Use Courts tab to configure live board status</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Download Source Code */}
          <Card className="mb-8" id="download">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" aria-hidden="true" />
                Download Source Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                Vakalat-OS is an open-source project. You can download the complete source code 
                to customize, deploy on your own infrastructure, or contribute to development.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <a 
                  href="https://github.com/lovable-dev/vakalat-os/archive/refs/heads/main.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors group"
                >
                  <Download className="h-8 w-8 text-primary" aria-hidden="true" />
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      Download ZIP
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Get the complete source code as a ZIP file
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden="true" />
                </a>

                <a 
                  href="https://github.com/lovable-dev/vakalat-os"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors group"
                >
                  <Github className="h-8 w-8 text-foreground" aria-hidden="true" />
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      View on GitHub
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Browse code, fork, and contribute
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden="true" />
                </a>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2">Quick Start</h4>
                <div className="space-y-2 text-sm text-muted-foreground font-mono">
                  <p className="flex items-center gap-2">
                    <span className="text-primary">$</span>
                    git clone https://github.com/lovable-dev/vakalat-os.git
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-primary">$</span>
                    cd vakalat-os && npm install
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-primary">$</span>
                    npm run dev
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Tech Stack</h4>
                <div className="flex flex-wrap gap-2">
                  {['React', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Vite', 'shadcn/ui'].map((tech) => (
                    <span 
                      key={tech}
                      className="px-3 py-1 rounded-full text-sm bg-card border border-border text-muted-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>Vakalat-OS v1.0 | Rajasthan High Court Dashboard</p>
            <p className="mt-1">© {new Date().getFullYear()} All Rights Reserved</p>
          </div>
        </ScrollArea>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          * {
            color: black !important;
            background: white !important;
            border-color: #ccc !important;
          }
        }
      `}</style>
    </div>
  );
}
