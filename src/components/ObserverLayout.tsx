import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { LayoutDashboard, LogOut, Menu, X, Eye } from "lucide-react";
import { useState } from "react";

/**
 * Sidebar for /observer/* routes. Visually identical to CommitteeLayout but
 * labeled differently so observers know their role. They have the SAME
 * underlying shell to keep the visual language consistent for "election
 * staff" (committee + observer).
 */
export function ObserverLayout() {
    const location = useLocation();
    const { profile, signOut } = useAuth();
    const { resolvedTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navigation = [
        { name: "Pemilihan yang Saya Amati", href: "/observer", icon: LayoutDashboard },
    ];

    return (
        <div className="flex min-h-screen bg-background">
            <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
                <img
                    src={resolvedTheme === 'dark' ? "/UniVertexWhiteHorizontal.png" : "/UniVertex-Horizontal.png"}
                    alt="UniVertex Logo"
                    className="h-8 w-auto"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle menu"
                >
                    {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
            </div>

            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className={cn(
                "fixed lg:sticky inset lg:top-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:translate-x-0 lg:h-screen",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex h-16 items-center justify-center gap-3 border-b border-border px-6 shrink-0">
                    <img
                        src={resolvedTheme === 'dark' ? "/UniVertexWhiteHorizontal.png" : "/UniVertex-Horizontal.png"}
                        alt="UniVertex Logo"
                        className="mx-auto h-10 w-auto"
                    />
                </div>

                <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-border p-4 shrink-0">
                    <div className="mb-4 rounded-lg bg-muted p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Eye className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{profile?.student_id}</p>
                        <p className="mt-1 text-xs font-medium text-accent">Observer</p>
                    </div>
                    <div className="flex gap-2 mb-2">
                        <ThemeToggle />
                        <Button variant="outline" className="flex-1" onClick={signOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Keluar
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 pt-16 lg:pt-0 min-w-0">
                <Outlet />
            </div>
        </div>
    );
}
