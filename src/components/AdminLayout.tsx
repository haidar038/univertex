import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, Users, GraduationCap, LogOut, Vote, Menu, X } from "lucide-react";
import { useState } from "react";

const navigation = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Acara Pemilihan", href: "/admin/events", icon: Calendar },
    { name: "Manajemen Pengguna", href: "/admin/users", icon: Users },
    { name: "Manajemen Kelas", href: "/admin/classes", icon: GraduationCap },
];

export function AdminLayout() {
    const location = useLocation();
    const { profile, signOut } = useAuth();
    const { resolvedTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-background">
            {/* Mobile menu button */}
            <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
                <div className="flex items-center gap-2">
                    <img
                        src={resolvedTheme === 'dark' ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"}
                        alt="UniVertex Logo"
                        className="h-8"
                    />
                    <div>
                        <h1 className="text-sm font-bold text-foreground">UniVertex</h1>
                        <p className="text-xs text-muted-foreground">Admin Panel</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle menu"
                >
                    {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed lg:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:translate-x-0",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex h-16 items-center gap-3 border-b border-border px-6">
                    <img
                        src={resolvedTheme === 'dark' ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"}
                        alt="UniVertex Logo"
                        className="h-10"
                    />
                    <div>
                        <h1 className="font-bold text-foreground">UniVertex</h1>
                        <p className="text-xs text-muted-foreground">Admin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 p-4">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
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

                <div className="border-t border-border p-4">
                    <div className="mb-4 rounded-lg bg-muted p-3">
                        <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{profile?.student_id}</p>
                        <p className="mt-1 text-xs font-medium text-primary">Administrator</p>
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
            <div className="flex-1 pt-16 lg:pt-0">
                <Outlet />
            </div>
        </div>
    );
}
