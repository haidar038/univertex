import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  User,
  Vote,
  LogOut,
  Settings,
} from 'lucide-react';

export function VoterLayout() {
  const location = useLocation();
  const { profile, signOut, isCandidate } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { name: 'Profil', href: '/app/profile', icon: User },
  ];

  if (isCandidate) {
    navigation.push({
      name: 'Pengaturan Kandidat',
      href: '/app/candidate-settings',
      icon: Settings,
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
            <Vote className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">UniVertex</h1>
            <p className="text-xs text-muted-foreground">Platform Pemilih</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
            <p className="mt-1 text-xs font-medium text-accent">
              {isCandidate ? 'Kandidat' : 'Pemilih'}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
