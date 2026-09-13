import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logger } from "@/lib/logger";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    eventId?: string;
}

/**
 * Top-level error boundary. Captures any uncaught React render error, reports
 * it to Sentry, and shows a minimal recovery UI so the app never goes fully
 * blank (which is especially important on election day).
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        logger.error("Uncaught render error", error, { component: "ErrorBoundary", action: "render" });
        const eventId = Sentry?.captureException?.(error, {
            extra: { componentStack: info.componentStack },
        });
        if (eventId) this.setState({ eventId });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleHome = () => {
        window.location.href = "/";
    };

    render() {
        if (!this.state.hasError) return this.props.children;
        if (this.props.fallback) return this.props.fallback;
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle>Terjadi Kesalahan Tak Terduga</CardTitle>
                        <CardDescription>
                            Maaf, aplikasi mengalami error. Tim teknis sudah otomatis
                            menerima laporan untuk ditindaklanjuti.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {this.state.eventId && (
                            <p className="text-xs text-muted-foreground">
                                Kode referensi: <code className="font-mono">{this.state.eventId}</code>
                            </p>
                        )}
                        <div className="flex gap-2">
                            <Button onClick={this.handleReload}>Muat Ulang</Button>
                            <Button variant="outline" onClick={this.handleHome}>Ke Beranda</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
}
