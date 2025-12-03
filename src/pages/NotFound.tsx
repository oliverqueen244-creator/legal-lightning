import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Scale, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Scale className="h-16 w-16 text-primary mb-6" />
      <h1 className="mb-2 font-display text-5xl font-bold text-foreground">404</h1>
      <p className="mb-6 text-xl text-muted-foreground">Page not found</p>
      <Button variant="gold" asChild>
        <a href="/" className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          Return to Dashboard
        </a>
      </Button>
    </div>
  );
};

export default NotFound;
