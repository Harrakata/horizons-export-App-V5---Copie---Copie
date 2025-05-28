
import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toaster } from '@/components/ui/toaster';
import { Home, Briefcase, Users, Settings, BarChart3, LogIn, Sun, Moon, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

const Layout = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const navLinks = [
    { to: '/', label: "Page d'Accueil", icon: <Home className="mr-2 h-4 w-4" /> },
    { to: '/pointage', label: 'Pointage', icon: <LogIn className="mr-2 h-4 w-4" /> },
  ];

  const dropdownLinks = [
      { to: '/espace-exploitation', label: 'Espace Exploitation', icon: <Briefcase className="mr-2 h-4 w-4" /> },
      { to: '/espace-chef-agence', label: "Espace Chef d'agence", icon: <Users className="mr-2 h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <motion.div whileHover={{ rotate: [0, 10, -10, 0], scale: 1.1 }}>
              <img  alt="PMU Mali Logo" class="h-10 w-auto" src="https://pzmapmxjkkqhuiamdvjd.supabase.co/storage/v1/object/public/pmu-mali-storage//326291198_1368954473860231_6856823940381691525_n.jpg" />
            </motion.div>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-500 dark:to-pink-400">
              PMU Mali Gestion
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navLinks.map(link => (
              <Button key={link.to} variant="ghost" onClick={() => navigate(link.to)}>
                {link.icon} {link.label}
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  Espaces <Menu className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Navigation Principale</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {dropdownLinks.map(link => (
                   <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}>
                    {link.icon}
                    {link.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </nav>
          
          <div className="md:hidden flex items-center">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="mr-2">
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Menu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navLinks.map(link => (
                  <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}>
                    {link.icon} {link.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Espaces</DropdownMenuLabel>
                 {dropdownLinks.map(link => (
                   <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}>
                    {link.icon}
                    {link.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <Outlet />
      </main>

      <footer className="py-6 md:px-8 md:py-0 border-t border-border/40">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} PMU Mali. Tous droits réservés.
          </p>
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5, delay: 0.5 }}
             className="text-xs text-muted-foreground"
           >
            
           </motion.div>
        </div>
      </footer>
      <Toaster />
    </div>
  );
};

export default Layout;
