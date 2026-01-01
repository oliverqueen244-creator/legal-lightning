import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

const SHOWN_KEY = 'vakalat_post_install_shown';

/**
 * Post-Install Confirmation
 * 
 * Shows exactly ONCE after first launch in standalone mode.
 * Exact copy (from spec):
 * "VAKALAT-OS is installed. Connection-aware features help prevent misleading court information."
 * 
 * No tutorial. No walkthrough.
 */
export function PostInstallConfirmation() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if we're running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!isStandalone) return;

    // Check if we've already shown this
    const hasShown = localStorage.getItem(SHOWN_KEY);
    if (hasShown) return;

    // Show the confirmation
    setIsVisible(true);
    
    // Mark as shown
    localStorage.setItem(SHOWN_KEY, 'true');
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="max-w-md w-full border-court-success/30 bg-background shadow-xl animate-in zoom-in-95 duration-300">
        <div className="p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-court-success/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-court-success" />
          </div>
          
          <h2 className="font-display text-xl font-semibold text-foreground mb-3">
            VAKALAT-OS is installed
          </h2>
          
          <p className="text-muted-foreground text-sm">
            Connection-aware features help prevent misleading court information.
          </p>

          <Button 
            onClick={handleDismiss}
            className="mt-6 w-full"
            size="lg"
          >
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
