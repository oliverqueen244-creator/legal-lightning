import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

// Critical Pages (Immediate Load)
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";

// Lazy Loaded Pages (Performance Optimization)
const WarRoom = lazy(() => import("./pages/WarRoom"));
const ControlDeck = lazy(() => import("./pages/ControlDeck"));
const Admin = lazy(() => import("./pages/Admin"));
const Documentation = lazy(() => import("./pages/Documentation"));
const ProductDossier = lazy(() => import("./pages/ProductDossier"));
const TechnicalDossier = lazy(() => import("./pages/TechnicalDossier"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CourtroomMode = lazy(() => import("./pages/CourtroomMode"));
const Install = lazy(() => import("./pages/Install"));
const Privacy = lazy(() => import("./pages/Privacy"));

import { GlobalOfflineBanner } from "./components/layout/GlobalOfflineBanner";
import { SyncConflictProvider } from "./contexts/SyncConflictContext";
import { FormDirtyProvider } from "./contexts/FormDirtyContext";
import { InstallDiscoveryBanner, PostInstallConfirmation, ForceUpdateBlockedDialog } from "./components/pwa";
import { CourtFocusOverlay } from "./components/court-focus";
import { SplashScreen } from "./components/layout/SplashScreen";
import { PWAUpdateManager } from "./components/pwa/PWAUpdateManager";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { IdleLogoutGuard } from "./components/layout/IdleLogoutGuard";
import { useForceUpdate } from "./hooks/useForceUpdate";
import { useBeforeUnloadGuard } from "./hooks/useBeforeUnloadGuard";
import { KineticProvider } from "./components/layout/KineticProvider";
import { SilkPreloader } from '@/components/layout/SilkPreloader';
import { SmartPrefetcher } from './components/layout/SmartPrefetcher';
import { GlobalCommandPalette } from './components/layout/GlobalCommandPalette';
import { motion, AnimatePresence } from 'framer-motion';
import { SovereignLayout } from "./components/layout/SovereignLayout";

import { DensityProvider } from "./contexts/DensityContext";





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
    <DensityProvider>
      <SilkPreloader />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* FormDirtyProvider MUST wrap everything for safety checks */}
          <FormDirtyProvider>
            {/* SyncConflictProvider must wrap ForceUpdateChecker since it uses useSyncConflict */}
            <SyncConflictProvider>
              {/* PWA Force Update Kill Switch - with safety checks and dialog */}
              <ForceUpdateChecker />
              {/* SAFE PWA AUTO-UPDATE: Beforeunload safety net */}
              <BeforeUnloadGuard />
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
              <IdleLogoutGuard />
              {/* PWA Install Discovery - safe, non-intrusive, respects dismissal */}
              <InstallDiscoveryBanner />
              {/* PWA Post-Install Confirmation - shows once after first install launch */}
              <PostInstallConfirmation />
              {/* SAFE PWA AUTO-UPDATE: Manages update lifecycle with safety checks */}
              <PWAUpdateManager />
              <SmartPrefetcher />
              <BrowserRouter>
                <GlobalCommandPalette />
                <KineticProvider>
                  {/* Court Focus Mode - Full screen overlay for critical court moments */}
                  <CourtFocusOverlay />
                  <Suspense fallback={
                    <div className="flex items-center justify-center min-h-screen bg-background">
                      <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  }>
                    <SovereignLayout>
                      <AnimatePresence mode="wait">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/docs" element={<Documentation />} />
                          <Route path="/dossier" element={<ProductDossier />} />
                          <Route path="/technical-dossier" element={<TechnicalDossier />} />
                          <Route path="/admin" element={<Admin />} />
                          <Route path="/war-room/:caseId" element={<WarRoom />} />
                          <Route path="/control-deck/:caseId" element={<ControlDeck />} />
                          <Route path="/courtroom" element={<CourtroomMode />} />
                          <Route path="/install" element={<Install />} />
                          <Route path="/privacy" element={<Privacy />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AnimatePresence>

                    </SovereignLayout>
                  </Suspense>

                </KineticProvider>
              </BrowserRouter>
            </SyncConflictProvider>
          </FormDirtyProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </DensityProvider>
  </ErrorBoundary>
);


export default App;
