import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import * as Sentry from "@sentry/react";

const isProd = import.meta.env.PROD;
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

// Sentry is opt-in via VITE_SENTRY_DSN. Only initialise in production builds so
// dev-time errors don't pollute the dashboard.
if (isProd && sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.VITE_APP_ENV || "production",
        tracesSampleRate: 0.1,
        // Strip PII (email, student_id, full_name) before sending.
        beforeSend(event) {
            if (event.user) {
                delete event.user.email;
                delete event.user.username;
            }
            if (event.request) {
                delete event.request.cookies;
            }
            // Drop any extra data that looks like PII
            if (event.extra && typeof event.extra === "object") {
                const safe = { ...event.extra } as Record<string, unknown>;
                for (const k of ["email", "student_id", "full_name", "password", "token"]) {
                    if (k in safe) delete safe[k];
                }
                event.extra = safe;
            }
            return event;
        },
    });
}

createRoot(document.getElementById("root")!).render(<App />);
