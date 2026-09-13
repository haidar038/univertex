/**
 * Structured logger used across the client.
 *
 * - Forwards every record to the browser console with a single-line JSON
 *   payload so that log aggregators (Vercel, Sentry, etc.) can parse it.
 * - Also pushes error/warn to Sentry if it is loaded on the page.
 * - Never includes raw exception objects in the Sentry breadcrumb - the
 *   exception itself is captured via the global handler in main.tsx.
 */

import * as Sentry from "@sentry/react";

type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
    userId?: string;
    electionId?: string;
    route?: string;
    action?: string;
    component?: string;
    [key: string]: unknown;
}

const PII_KEYS = new Set([
    "email",
    "password",
    "token",
    "student_id",
    "full_name",
    "refresh_token",
    "access_token",
    "authorization",
]);

function stripPii(ctx: LogContext | undefined): LogContext | undefined {
    if (!ctx) return undefined;
    const safe: LogContext = {};
    for (const [k, v] of Object.entries(ctx)) {
        if (PII_KEYS.has(k)) continue;
        safe[k] = v;
    }
    return safe;
}

function emit(level: LogLevel, msg: string, ctx?: LogContext) {
    const safe = stripPii(ctx);
    const record = {
        level,
        msg,
        ts: new Date().toISOString(),
        env: import.meta.env.VITE_APP_ENV,
        ...safe,
    };
    const line = JSON.stringify(record);
    switch (level) {
        case "debug":
            console.debug(line);
            break;
        case "info":
            console.info(line);
            break;
        case "warn":
            console.warn(line);
            if (Sentry && (Sentry as unknown as { addBreadcrumb?: Function }).addBreadcrumb) {
                Sentry.addBreadcrumb({ category: "log", level: "warning", message: msg, data: safe });
            }
            break;
        case "error":
            console.error(line);
            if (Sentry && (Sentry as unknown as { addBreadcrumb?: Function }).addBreadcrumb) {
                Sentry.addBreadcrumb({ category: "log", level: "error", message: msg, data: safe });
            }
            break;
    }
}

export const logger = {
    debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
    info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
    warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
    /**
     * Log an error and forward the underlying exception to Sentry when
     * available. Use this from try/catch blocks instead of console.error.
     */
    error: (msg: string, err?: unknown, ctx?: LogContext) => {
        emit("error", msg, ctx);
        if (err !== undefined && err !== null && Sentry && (Sentry as unknown as { captureException?: Function }).captureException) {
            Sentry.captureException(err, { extra: stripPii(ctx) });
        }
    },
};
