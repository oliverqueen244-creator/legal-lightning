import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { reportHighError } from "./lib/errorReporting";
import { initSentry } from "./lib/sentryStub";

initSentry();

// Capture uncaught errors and unhandled promise rejections so they land in
// admin_error_events instead of vanishing into the console.
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    void reportHighError(
      "UNKNOWN",
      "FRONTEND_UNCAUGHT_ERROR",
      `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error
      ? `${event.reason.name}: ${event.reason.message}`
      : String(event.reason);
    void reportHighError("UNKNOWN", "FRONTEND_UNHANDLED_REJECTION", reason);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
