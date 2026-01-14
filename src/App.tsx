import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WarRoom from "./pages/WarRoom";
import ControlDeck from "./pages/ControlDeck";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Documentation from "./pages/Documentation";
import ProductDossier from "./pages/ProductDossier";
import TechnicalDossier from "./pages/TechnicalDossier";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import CourtroomMode from "./pages/CourtroomMode";
import Install from "./pages/Install";
import { GlobalOfflineBanner } from "./components/layout/GlobalOfflineBanner";
import { SyncConflictProvider } from "./contexts/SyncConflictContext";
import { FormDirtyProvider } from "./contexts/FormDirtyContext";
import { InstallDiscoveryBanner, PostInstallConfirmation, ForceUpdateBlockedDialog } from "./components/pwa";
import { CourtFocusOverlay } from "./components/court-focus";
import { SplashScreen } from "./components/layout/SplashScreen";
import { PWAUpdateManager } from "./components/pwa/PWAUpdateManager";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { useForceUpdate } from "./hooks/useForceUpdate";
import { useBeforeUnloadGuard } from "./hooks/useBeforeUnloadGuard";

const queryClient = new QueryClient();

/**
 * SAFE PWA AUTO-UPDATE — Force Update Checker with Dialog
 * 
 * Runs the force update check and shows blocking dialog if update cannot proceed.
 */
function ForceUpdateChecker() {
  const { isBlocked, blockedConfig, setIsBlocked } = useForceUpdate();
  
  return (
    <ForceUpdateBlockedDialog
      open={isBlocked}
      onOpenChange={setIsBlocked}
      updateReason={blockedConfig?.reason}
    />
  );
}

/**
 * SAFE PWA AUTO-UPDATE — Beforeunload Safety Net
 * 
 * Must be inside FormDirtyProvider to access dirty form state.
 */
function BeforeUnloadGuard() {
  useBeforeUnloadGuard();
  return null;
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* FormDirtyProvider MUST wrap everything for safety checks */}
      <FormDirtyProvider>
        {/* PWA Force Update Kill Switch - with safety checks and dialog */}
        <ForceUpdateChecker />
        {/* SAFE PWA AUTO-UPDATE: Beforeunload safety net */}
        <BeforeUnloadGuard />
        <SyncConflictProvider>
          {/* Branded Splash Screen - shows once per session */}
          <SplashScreen />
          <Toaster 
            position="top-center"
            toastOptions={{
              className: 'bg-background border-2 border-primary text-primary font-bold shadow-[0_0_20px_hsl(48_97%_54%/0.4)]',
            }}
          />
          {/* HARDENING FIX: Global offline banner - single source of truth */}
          <GlobalOfflineBanner />
          {/* PWA Install Discovery - safe, non-intrusive, respects dismissal */}
          <InstallDiscoveryBanner />
          {/* PWA Post-Install Confirmation - shows once after first install launch */}
          <PostInstallConfirmation />
          {/* SAFE PWA AUTO-UPDATE: Manages update lifecycle with safety checks */}
          <PWAUpdateManager />
          <BrowserRouter>
            {/* Court Focus Mode - Full screen overlay for critical court moments */}
            <CourtFocusOverlay />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/dossier" element={<ProductDossier />} />
              <Route path="/technical-dossier" element={<TechnicalDossier />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/war-room/:caseId" element={<WarRoom />} />
              <Route path="/control-deck/:caseId" element={<ControlDeck />} />
              <Route path="/courtroom" element={<CourtroomMode />} />
              <Route path="/install" element={<Install />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SyncConflictProvider>
      </FormDirtyProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
