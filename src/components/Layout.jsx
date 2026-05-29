
import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import { Home, Briefcase, Users, Settings, BarChart3, LogIn, Sun, Moon, Menu, Wrench, ShieldCheck, Wallet, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import {
  APP_SPACE_SETTINGS_KEY,
  buildDefaultAppSpaceFunctionalities,
  getAppSpaceFeatureForPathname,
  normalizeAppSpaceFunctionalities,
} from '@/lib/exploitationProfiles';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    // Lire le mode sombre depuis le cache thème pour éviter un flash au rechargement
    try {
      const cached = localStorage.getItem('app_theme_cache');
      if (cached) return Boolean(JSON.parse(cached).darkMode);
    } catch { /* ignore */ }
    return document.documentElement.classList.contains('dark');
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [spaceFunctionalities, setSpaceFunctionalities] = React.useState(() => {
    try {
      return normalizeAppSpaceFunctionalities(
        JSON.parse(window.localStorage.getItem(APP_SPACE_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceFunctionalities();
    }
  });
  const [hasLoadedSpaceFunctionalities, setHasLoadedSpaceFunctionalities] = React.useState(false);

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

  React.useEffect(() => {
    const loadSpaceFunctionalities = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', APP_SPACE_SETTINGS_KEY)
        .single();

      if (!error && data?.value) {
        const normalizedSettings = normalizeAppSpaceFunctionalities(data.value);
        setSpaceFunctionalities(normalizedSettings);
        window.localStorage.setItem(APP_SPACE_SETTINGS_KEY, JSON.stringify(normalizedSettings));
        window.dispatchEvent(
          new CustomEvent('app-functionalities-updated', {
            detail: normalizedSettings,
          })
        );
      } else if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement fonctionnalités espaces :', error);
      } else {
        const normalizedSettings = buildDefaultAppSpaceFunctionalities();
        setSpaceFunctionalities(normalizedSettings);
        window.localStorage.setItem(APP_SPACE_SETTINGS_KEY, JSON.stringify(normalizedSettings));
      }

      setHasLoadedSpaceFunctionalities(true);
    };

    loadSpaceFunctionalities();
  }, []);

  React.useEffect(() => {
    const handleFunctionalitiesUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceFunctionalities(event.detail);
      setSpaceFunctionalities(normalizedSettings);
      window.localStorage.setItem(APP_SPACE_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-functionalities-updated', handleFunctionalitiesUpdated);
    return () => window.removeEventListener('app-functionalities-updated', handleFunctionalitiesUpdated);
  }, []);

  const navLinks = [
    { to: '/', label: "Page d'Accueil", icon: <Home className="mr-2 h-4 w-4" /> },
    { to: '/pointage', label: 'Pointage', icon: <LogIn className="mr-2 h-4 w-4" />, featureKey: 'pointage' },
    {
      to: '/paiement-gros-gain',
      label: 'Paiement Gros Gain',
      icon: <Wallet className="mr-2 h-4 w-4" />,
      featureKey: 'paiement-gros-gain',
    },
  ];

  const dropdownLinks = [
      { to: '/espace-exploitation', label: 'Espace Exploitation', icon: <Briefcase className="mr-2 h-4 w-4" /> },
      { to: '/espace-chef-agence', label: "Espace Chef d'agence", icon: <Users className="mr-2 h-4 w-4" />, featureKey: 'espace-chef-agence' },
      { to: '/espace-guichetiere', label: 'Espace Guichetière', icon: <User className="mr-2 h-4 w-4" />, featureKey: 'espace-guichetiere' },
      { to: '/espace-validation-paiement-gain', label: 'Espace Directeur régional', icon: <ShieldCheck className="mr-2 h-4 w-4" />, featureKey: 'espace-directeur-regional' },
      { to: '/espace-directeur-general', label: 'Espace Directeur général', icon: <ShieldCheck className="mr-2 h-4 w-4" />, featureKey: 'espace-directeur-general' },
      { to: '/espace-technicien', label: 'Espace Technicien', icon: <Wrench className="mr-2 h-4 w-4" />, featureKey: 'espace-technicien' },
  ];

  const availableDropdownLinks = dropdownLinks.filter(
    (link) => !link.featureKey || spaceFunctionalities[link.featureKey] !== false
  );
  const availableNavLinks = navLinks.filter(
    (link) => !link.featureKey || spaceFunctionalities[link.featureKey] !== false
  );

  React.useEffect(() => {
    if (!hasLoadedSpaceFunctionalities) return;

    const matchedFeature = getAppSpaceFeatureForPathname(location.pathname);
    if (!matchedFeature) return;

    if (spaceFunctionalities[matchedFeature.key] === false) {
      toast({
        title: 'Espace désactivé',
        description: `${matchedFeature.label} est actuellement désactivé depuis Profil et Fonctionnalité.`,
        variant: 'destructive',
      });
      navigate('/', { replace: true });
    }
  }, [hasLoadedSpaceFunctionalities, location.pathname, navigate, spaceFunctionalities, toast]);

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-900">
      <header className="sticky top-0 z-40 w-full relative overflow-hidden border-b border-primary/20 bg-background/95 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.14)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent" />
        <div className="relative flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link to="/" className="flex items-center group">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <img
                src="/carrus-logo.png"
                alt="CARRUS Betting Solutions & Services"
                className="h-20 w-auto object-contain drop-shadow-sm"
              />
            </motion.div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {availableNavLinks.map(link => {
              const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  onClick={() => navigate(link.to)}
                  className={`relative overflow-hidden inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm font-semibold shadow-sm transition-all ${
                    isActive
                      ? 'border-primary/40 bg-primary/12 text-primary shadow-md'
                      : 'border-primary/20 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.5rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white ring-1 ring-primary/20 text-primary shadow-sm">
                    {React.cloneElement(link.icon, { className: 'h-3.5 w-3.5' })}
                  </span>
                  {link.label}
                </button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative overflow-hidden inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white/80 px-2.5 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.5rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white ring-1 ring-primary/20 text-primary shadow-sm">
                    <Menu className="h-3.5 w-3.5" />
                  </span>
                  Espaces
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 overflow-hidden border border-primary/20 bg-primary/5 p-0 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.2)] backdrop-blur">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                  <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white ring-1 ring-primary/20 shadow-sm text-primary">
                      <Menu className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Navigation Principale</span>
                  </div>
                  <div className="mx-3 mb-2 h-px bg-primary/15" />
                  <div className="space-y-0.5 px-2 pb-2">
                    {availableDropdownLinks.map(link => {
                      const isActive = location.pathname.startsWith(link.to);
                      return (
                        <DropdownMenuItem
                          key={link.to}
                          onClick={() => navigate(link.to)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-foreground/80 hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {link.icon}
                          {link.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative overflow-hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20 shadow-sm transition-all hover:from-primary/30 hover:border-primary/35"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </nav>
          
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary transition-all hover:border-primary/35 hover:bg-primary/10"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary transition-all hover:border-primary/35 hover:bg-primary/10">
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 overflow-hidden border border-primary/20 bg-primary/5 p-0 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.2)] backdrop-blur">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                  <div className="flex items-center gap-2.5 px-3 pb-2 pt-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white ring-1 ring-primary/20 shadow-sm text-primary">
                      <Menu className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Menu</span>
                  </div>
                  <div className="mx-3 mb-1 h-px bg-primary/15" />
                  <div className="space-y-0.5 px-2 pb-1">
                    {availableNavLinks.map(link => {
                      const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
                      return (
                        <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-primary/10 hover:text-primary'}`}
                        >
                          {link.icon}{link.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                  <div className="mx-3 my-1 h-px bg-primary/15" />
                  <div className="px-3 pb-1 pt-0.5">
                    <p className="text-xs font-bold text-primary/60 uppercase tracking-wide">Espaces</p>
                  </div>
                  <div className="space-y-0.5 px-2 pb-2">
                    {availableDropdownLinks.map(link => {
                      const isActive = location.pathname.startsWith(link.to);
                      return (
                        <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-primary/10 hover:text-primary'}`}
                        >
                          {link.icon}{link.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </div>
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
            © {new Date().getFullYear()} Star3000+. Tous droits réservés.
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
