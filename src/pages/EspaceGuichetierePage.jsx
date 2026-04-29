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
      navigate(`/espace-guichetiere/${fallbackPath}`, { replace: true });
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
        className="md:w-72"
      >
        <Card className="sticky top-20 shadow-lg glassmorphism">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20">
                {guichetiereInfo?.photo_url ? (
                  <AvatarImage src={guichetiereInfo.photo_url} alt={guichetiereInfo.nomComplet} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {guichetiereInfo?.nomComplet?.split(' ').map((part) => part[0]).join('') || 'G'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl text-primary">Guichetière</CardTitle>
                <CardDescription className="text-sm">
                  {guichetiereInfo?.nomComplet}
                  <br />
                  Agence: {guichetiereInfo?.nomAgence}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col h-full">
            <nav className="flex flex-col flex-grow space-y-2">
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  asChild
                  variant={isMenuItemActive(item.path) ? 'default' : 'ghost'}
                  className={`justify-start py-3 text-base ${
                    isMenuItemActive(item.path)
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <Link to={item.path}>
                    {React.cloneElement(item.icon, { className: 'mr-3 h-5 w-5' })}
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
            <div className="mt-auto pt-4">
              <Button
                variant="outline"
                className="w-full justify-start py-3 text-base hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5 text-red-500" />
                Se déconnecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.aside>

      <main className="flex-1">
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
