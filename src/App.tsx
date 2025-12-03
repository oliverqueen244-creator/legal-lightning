import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WarRoom from "./pages/WarRoom";
import ControlDeck from "./pages/ControlDeck";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-background border-2 border-primary text-primary font-bold shadow-[0_0_20px_hsl(48_97%_54%/0.4)]',
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/war-room/:caseId" element={<WarRoom />} />
          <Route path="/control-deck/:caseId" element={<ControlDeck />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
