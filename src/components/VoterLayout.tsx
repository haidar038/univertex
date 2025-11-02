import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { LayoutDashboard, User, Vote, LogOut, Settings, Trophy } from "lucide-react";

export function VoterLayout() {
    const location = useLocation();
    const { profile, signOut, isCandidate } = useAuth();
    const { resolvedTheme } = useTheme();

    const navigation = [
        { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
        { name: "Profil", href: "/app/profile", icon: User },
    ];

    if (isCandidate) {
        navigation.splice(1, 0, {
            name: "Dashboard Kandidat",
            href: "/app/candidate-dashboard",
            icon: Trophy,
        });
        navigation.push({
            name: "Pengaturan Kandidat",
            href: "/app/candidate-settings",
            icon: Settings,
        });
    }

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <div className="flex w-64 flex-col border-r border-border bg-card">
                <div className="flex h-16 items-center justify-center gap-3 border-b border-border px-6">
                    <img
                        src={resolvedTheme === 'dark' ? "/UniVertexWhiteHorizontal.png" : "/UniVertex-Horizontal.png"}
                        alt="UniVertex Logo"
                        className="mx-auto h-10 w-auto"
                    />
                </div>

                <nav className="flex-1 space-y-1 p-4">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
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

                <div className="border-t border-border p-4">
                    <div className="mb-4 rounded-lg bg-muted p-3">
                        <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{profile?.student_id}</p>
                        <p className="mt-1 text-xs font-medium text-accent">{isCandidate ? "Kandidat" : "Pemilih"}</p>
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

            {/* Main content */}
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    );
}
