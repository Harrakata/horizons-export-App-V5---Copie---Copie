import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, LogOut, MapPin, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabaseClient';
import { GUICHETIERE_AUTH_KEY, buildGuichetiereDisplayName } from '@/lib/guichetiereSpace';
import {
  APP_SPACE_TAB_SETTINGS_KEY,
  buildDefaultAppSpaceTabFunctionalities,
  getFirstEnabledAppSpaceTab,
  isAppSpaceTabEnabled,
  normalizeAppSpaceTabFunctionalities,
} from '@/lib/exploitationProfiles';

const LoginPageGuichetiere = ({ onLogin }) => {
  const { toast } = useToast();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!matricule.trim() || !password.trim()) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez renseigner votre matricule et votre mot de passe.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from('guichetieres')
      .select('*')
      .eq('matricule', matricule.trim())
      .single();

    if (error && error.code !== 'PGRST116') {
      toast({
        title: 'Erreur de connexion',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    if (!data || String(data.mdpPrepose || '') !== password) {
      toast({
        title: 'Connexion refusée',
        description: 'Matricule ou mot de passe incorrect.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    onLogin(data);
    toast({
      title: 'Connexion réussie',
      description: `Bienvenue ${buildGuichetiereDisplayName(data)} dans votre espace Guichetière.`,
      className: 'bg-green-500 text-white',
    });
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[calc(100vh-200px)] items-center justify-center"
    >
      <Card className="w-full max-w-md shadow-2xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center justify-center text-3xl font-bold text-primary">
            <ShieldCheck className="mr-2 h-8 w-8" />
            Accès Espace Guichetière
          </CardTitle>
          <CardDescription className="text-center">
            Connectez-vous avec votre matricule et votre mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="guichetiere-matricule">Matricule</Label>
              <Input
                id="guichetiere-matricule"
                value={matricule}
                onChange={(event) => setMatricule(event.target.value)}
                placeholder="Votre matricule"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guichetiere-password">Mot de passe</Label>
              <Input
                id="guichetiere-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-green-600 text-white hover:from-primary/90 hover:to-green-600/90"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EspaceGuichetierePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(
    JSON.parse(localStorage.getItem(GUICHETIERE_AUTH_KEY))?.isAuthenticated || false
  );
  const [guichetiereInfo, setGuichetiereInfo] = useState(
    JSON.parse(localStorage.getItem(GUICHETIERE_AUTH_KEY))?.guichetiereInfo || null
  );
  const [guichetiereDetails, setGuichetiereDetails] = useState(
    JSON.parse(localStorage.getItem(GUICHETIERE_AUTH_KEY))?.guichetiereDetails || null
  );
  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(
        JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceTabFunctionalities();
    }
  });

  useEffect(() => {
    const authData = JSON.parse(localStorage.getItem(GUICHETIERE_AUTH_KEY) || 'null');
    if (authData?.isAuthenticated && authData?.guichetiereInfo) {
      setIsAuthenticated(true);
      setGuichetiereInfo(authData.guichetiereInfo);
      setGuichetiereDetails(authData.guichetiereDetails || null);
    }
  }, []);

  useEffect(() => {
    const prefix = '/espace-guichetiere/';
    if (location.pathname.startsWith(prefix)) {
      const subPath = location.pathname.slice(prefix.length).replace(/\/$/, '');
      if (subPath) try { localStorage.setItem('ps:guichetiere:lastPath', subPath); } catch {}
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleSpaceTabsUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceTabFunctionalities(event.detail);
      setSpaceTabFunctionalities(normalizedSettings);
      localStorage.setItem(APP_SPACE_TAB_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
    return () => window.removeEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
  }, []);

  const handleLogin = (guichetiereData) => {
    const nextAuthData = {
      isAuthenticated: true,
      guichetiereInfo: {
        id: guichetiereData.id,
        matricule: guichetiereData.matricule,
        nomComplet: buildGuichetiereDisplayName(guichetiereData),
        nomAgence: guichetiereData.agenceAssigne || 'Agence non renseignée',
        photo_url: guichetiereData.photo_url || null,
      },
      guichetiereDetails: guichetiereData,
    };

    setIsAuthenticated(true);
    setGuichetiereInfo(nextAuthData.guichetiereInfo);
    setGuichetiereDetails(guichetiereData);
    localStorage.setItem(GUICHETIERE_AUTH_KEY, JSON.stringify(nextAuthData));
    navigate('/espace-guichetiere/mon-planning', { replace: true });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setGuichetiereInfo(null);
    setGuichetiereDetails(null);
    localStorage.removeItem(GUICHETIERE_AUTH_KEY);
    toast({
      title: 'Déconnexion',
      description: 'Vous avez été déconnectée de votre espace.',
      className: 'bg-blue-500 text-white',
    });
    navigate('/');
  };

  const menuItems = [
    { path: 'mon-planning', label: 'Mon Planning', icon: <CalendarDays className="h-5 w-5" /> },
    { path: 'mes-pointages', label: 'Mes Pointages', icon: <FileText className="h-5 w-5" /> },
    { path: 'mes-points-vente-mobi', label: 'Mes Points de Vente Mobi', icon: <MapPin className="h-5 w-5" /> },
  ].filter((item) => isAppSpaceTabEnabled(spaceTabFunctionalities, 'espace-guichetiere', item.path));

  const normalizedPathname = location.pathname.replace(/\/+$/, '');
  const isMenuItemActive = (itemPath) => normalizedPathname === `/espace-guichetiere/${itemPath}`;

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!normalizedPathname.startsWith('/espace-guichetiere')) return;

    const fallbackPath = getFirstEnabledAppSpaceTab(spaceTabFunctionalities, 'espace-guichetiere')?.key || null;
    if (!fallbackPath) return;

    if (
      normalizedPathname === '/espace-guichetiere' ||
      normalizedPathname === '/espace-guichetiere/' ||
      !menuItems.some((item) => isMenuItemActive(item.path))
    ) {
      let savedPath;
      try { savedPath = localStorage.getItem('ps:guichetiere:lastPath'); } catch {}
      const target = (savedPath && menuItems.some((item) => item.path === savedPath))
        ? savedPath
        : fallbackPath;
      navigate(`/espace-guichetiere/${target}`, { replace: true });
    }
  }, [isAuthenticated, isMenuItemActive, menuItems, navigate, normalizedPathname, spaceTabFunctionalities]);

  if (!isAuthenticated) {
    return <LoginPageGuichetiere onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="md:w-72 md:shrink-0"
      >
        <div className="sticky top-20 space-y-3">
          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="relative p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]">
                  <span className="text-lg font-black">
                    {guichetiereInfo?.nomComplet?.split(' ').map((part) => part[0]).join('') || 'G'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">Guichetière</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-foreground">{guichetiereInfo?.nomComplet}</p>
                  <p className="text-[0.68rem] text-muted-foreground">Agence : {guichetiereInfo?.nomAgence}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="relative p-3">
              <nav className="space-y-0.5">
                {menuItems.map((item) => {
                  const isActive = isMenuItemActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                      }`}
                    >
                      {React.cloneElement(item.icon, { className: 'h-4 w-4 shrink-0' })}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Se déconnecter
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.aside>

      <main className="flex-1 min-w-0 overflow-hidden">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet
            context={{
              guichetiereInfo,
              guichetiereDetails,
              nomAgence: guichetiereInfo?.nomAgence,
            }}
          />
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceGuichetierePage;
