import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Users,
  Receipt,
  History,
  Menu,
  Settings,
  ChefHat,
  UtensilsCrossed,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';

export function Layout({ children }: { children: React.ReactNode }) {
  // Fix: was called twice before — once for location, once for setLocation.
  // A single call gives both values and avoids two separate router subscriptions.
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, signOut } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Users, label: 'Members', href: '/members' },
    { icon: UtensilsCrossed, label: 'Meals', href: '/meals' },
    { icon: Receipt, label: 'Expenses', href: '/expenses' },
    { icon: History, label: 'History', href: '/history' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
      setLocation('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-50">
        <Link href="/">
          <div className="flex cursor-pointer items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="font-heading font-bold text-lg text-primary">MealTrack</span>
          </div>
        </Link>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 p-0">
              <Menu className="h-7 w-7" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80%] max-w-[300px] p-0">
            <div className="h-full flex flex-col bg-card">
              <div className="p-6 border-b">
                <Link href="/">
                  <div className="flex cursor-pointer items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                    <ChefHat className="h-6 w-6 text-primary" />
                    <span className="font-heading font-bold text-xl">MealTrack</span>
                  </div>
                </Link>
              </div>
              <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                        location === item.href
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </div>
                  </Link>
                ))}
              </nav>
              <div className="border-t p-4 space-y-3">
                <div className="px-2 text-sm text-muted-foreground truncate">
                  {user?.email ?? 'Signed in'}
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={isLoggingOut}
                  onClick={() => { setIsMobileMenuOpen(false); void handleLogout(); }}
                >
                  {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card h-screen sticky top-0">
        <div className="p-6 border-b">
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-2">
              <ChefHat className="h-8 w-8 text-primary" />
              <span className="font-heading font-bold text-xl text-primary">MealTrack</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                  location === item.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="border-t p-4 space-y-3">
          <div className="px-2 text-sm text-muted-foreground truncate">
            {user?.email ?? 'Signed in'}
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 md:p-8 max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}
