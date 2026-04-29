import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Wrench, Loader2, LogOut, CalendarClock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import MaintenanceTab from '@/pages/maintenance/MaintenanceTab';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MonPlanningMaintenancePage from '@/pages/technicien/MonPlanningMaintenancePage';
import {
  APP_SPACE_TAB_SETTINGS_KEY,
  buildDefaultAppSpaceTabFunctionalities,
  getFirstEnabledAppSpaceTab,
  isAppSpaceTabEnabled,
  normalizeAppSpaceTabFunctionalities,
} from '@/lib/exploitationProfiles';

const LoginPage = ({ onLogin }) => {
  const { toast } = useToast();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!matricule || !password) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('techniciens')
      .select('*')
      .eq('matricule', matricule)
      .eq('motDePasse', password)
      .single();
    if (error || !data) {
      toast({ title: 'Connexion échouée', description: 'Matricule ou mot de passe invalide', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    onLogin(true, data);
    localStorage.setItem('pmuTechnicienAuth', JSON.stringify({ isAuthenticated: true, userData: data }));
    toast({ title: 'Connexion réussie', description: `Bienvenue ${data.prenom} ${data.nom}`, className: 'bg-green-500 text-white' });
    setIsLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-2xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary">
            <Wrench className="inline-block h-8 w-8 mr-2 text-primary" />Espace Technicien
          </CardTitle>
          <CardDescription className="text-center">Connectez-vous avec votre matricule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="matricule">Matricule</Label>
              <Input id="matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} disabled={isLoading} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion...</>) : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EspaceMaintenancePage = () => {
  const navigate = useNavigate();
  const storedAuth = JSON.parse(localStorage.getItem('pmuTechnicienAuth') || '{}');
  const [isAuthenticated, setIsAuthenticated] = useState(storedAuth.isAuthenticated || false);
  const [userData, setUserData] = useState(storedAuth.userData || null);
  const [activeSection, setActiveSection] = useState('maintenance');
  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(
        JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceTabFunctionalities();
    }
  });

  const handleLogin = (status, data) => {
    setIsAuthenticated(status);
    setUserData(data);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserData(null);
    localStorage.removeItem('pmuTechnicienAuth');
    navigate('/');
  };

  useEffect(() => {
    const handleSpaceTabsUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceTabFunctionalities(event.detail);
      setSpaceTabFunctionalities(normalizedSettings);
      localStorage.setItem(APP_SPACE_TAB_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
    return () => window.removeEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
  }, []);

  const baseMenuItems = [
    { key: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-5 w-5" /> },
    { key: 'planning', label: 'Mon planning de Maintenance', icon: <CalendarClock className="h-5 w-5" /> },
  ];

  const menuItems = useMemo(
    () =>
      baseMenuItems.filter((item) =>
        isAppSpaceTabEnabled(spaceTabFunctionalities, 'espace-technicien', item.key)
      ),
    [spaceTabFunctionalities]
  );

  useEffect(() => {
    const fallbackTab = getFirstEnabledAppSpaceTab(spaceTabFunctionalities, 'espace-technicien')?.key || null;

    if (!menuItems.length) {
      setActiveSection('');
      return;
    }

    if (!menuItems.some((item) => item.key === activeSection) && fallbackTab) {
      setActiveSection(fallbackTab);
    }
  }, [activeSection, menuItems, spaceTabFunctionalities]);

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
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
                {userData?.photo_url ? <AvatarImage src={userData.photo_url} alt={`${userData.prenom} ${userData.nom}`} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {[userData?.prenom?.[0], userData?.nom?.[0]].filter(Boolean).join('') || 'TM'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl text-primary">Espace Technicien</CardTitle>
                <CardDescription className="text-sm">
                  {userData?.prenom} {userData?.nom} <br />
                  Technicien de maintenance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            <nav className="flex flex-grow flex-col space-y-2">
              {menuItems.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={activeSection === item.key ? 'default' : 'ghost'}
                  className={`justify-start py-3 text-base ${
                    activeSection === item.key
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setActiveSection(item.key)}
                >
                  {React.cloneElement(item.icon, { className: 'mr-3 h-5 w-5' })}
                  {item.label}
                </Button>
              ))}
            </nav>

            <div className="mt-auto pt-4">
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full justify-start py-3 text-base hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="mr-3 h-5 w-5 text-red-500" />
                Déconnexion
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.aside>

      <main className="flex-1">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {!menuItems.length ? (
            <Card className="shadow-xl glassmorphism">
              <CardContent className="p-6 text-center text-muted-foreground">
                Aucun onglet n’est actuellement activé pour l’Espace Technicien.
              </CardContent>
            </Card>
          ) : activeSection === 'planning' ? (
            <MonPlanningMaintenancePage technicien={userData} />
          ) : (
            <MaintenanceTab technicien={userData} />
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceMaintenancePage;
