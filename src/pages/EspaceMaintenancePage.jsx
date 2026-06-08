import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Wrench, Loader2, LogOut, CalendarDays, AtSign, UserCog, Menu, X } from 'lucide-react';
import EditProfileDialog from '@/components/EditProfileDialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import {
  APP_SPACE_TAB_SETTINGS_KEY,
  APP_SPACE_USER_PROFILES_SETTINGS_KEY,
  buildDefaultAppSpaceTabFunctionalities,
  buildDefaultAppSpaceUserProfiles,
  canAccessAppSpaceUserTab,
  getFirstEnabledAppSpaceTab,
  getEffectiveAppSpaceUserProfile,
  isAppSpaceTabEnabled,
  normalizeAppSpaceTabFunctionalities,
  normalizeAppSpaceUserProfiles,
} from '@/lib/exploitationProfiles';
import { smartSignIn, fetchAuthLinkedProfile, fetchOrLinkAuthProfile } from '@/lib/smartAuth';
import { useActivityTracker } from '@/hooks/useActivityTracker';

// Code-split : ces composants lourds (formulaire de maintenance + signature,
// onglets de réparation, date-fns…) ne sont téléchargés qu'une fois le
// technicien authentifié, et non au premier rendu de l'écran de connexion.
const MaintenanceTab = lazy(() => import('@/pages/maintenance/MaintenanceTab'));
const MonPlanningMaintenancePage = lazy(() => import('@/pages/technicien/MonPlanningMaintenancePage'));

const SectionLoader = () => (
  <div className="flex items-center justify-center py-24">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const loadSpaceUserProfilesSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', APP_SPACE_USER_PROFILES_SETTINGS_KEY)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return normalizeAppSpaceUserProfiles(data?.value);
};

const LoginPage = ({ onLogin }) => {
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    // 1) Auth Supabase (smart : accepte email ou matricule)
    const tAuth = performance.now();
    const { data: authData, error: authErr } = await smartSignIn({
      identifier, password, table: 'techniciens',
    });
    console.info(`[perf] signInWithPassword: ${Math.round(performance.now() - tAuth)} ms`);
    if (authErr || !authData?.user) {
      toast({
        title: 'Connexion échouée',
        description: authErr?.message?.includes('Invalid login credentials')
          ? 'Identifiant ou mot de passe incorrect.'
          : (authErr?.message ?? 'Identifiant ou mot de passe incorrect.'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // 2) Récupérer le profil technicien lié à ce compte auth
    const tProfile = performance.now();
    const { data: profile, error: profileErr } = await fetchOrLinkAuthProfile({
      table: 'techniciens',
      authUserId: authData.user.id,
      identifier,
      authEmail: authData.user.email,
    });
    console.info(`[perf] fetchAuthLinkedProfile: ${Math.round(performance.now() - tProfile)} ms`);
    if (profileErr || !profile) {
      await supabase.auth.signOut();
      toast({
        title: 'Aucun profil technicien associé',
        description: profileErr?.message || 'Votre compte n\'est lié à aucune fiche technicien. Contactez un administrateur.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
    const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, 'espace-technicien', profile.id);
    if (effectiveProfile.statut !== 'Actif') {
      await supabase.auth.signOut();
      toast({
        title: 'Compte désactivé',
        description: 'Votre profil Technicien est désactivé. Contactez un administrateur.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    onLogin(true, { ...profile, appSpaceProfile: effectiveProfile });
    toast({
      title: 'Connexion réussie',
      description: `Bienvenue ${profile.prenom} ${profile.nom}`,
      className: 'bg-green-500 text-white',
    });
    setIsLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-2xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary">
            <Wrench className="inline-block h-8 w-8 mr-2 text-primary" />Espace Technicien
          </CardTitle>
          <CardDescription className="text-center">Connectez-vous avec votre email ou votre matricule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="flex items-center gap-2">
                <AtSign className="h-4 w-4" />Identifiant
              </Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email ou matricule"
                disabled={isLoading}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                required
                autoComplete="current-password"
              />
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [activeSection, setActiveSection] = useState('maintenance');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(
        JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceTabFunctionalities();
    }
  });
  const [spaceUserProfiles, setSpaceUserProfiles] = useState(() => {
    try {
      return normalizeAppSpaceUserProfiles(
        JSON.parse(localStorage.getItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceUserProfiles();
    }
  });

  useActivityTracker({
    spaceKey: 'espace-technicien',
    isAuthenticated,
    identity: userData,
  });

  // Restauration de la session : si l'utilisateur a déjà un JWT Supabase valide,
  // on re-fetch son profil technicien sans demander de re-login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        const { data: profile } = await fetchAuthLinkedProfile({
          table: 'techniciens', authUserId: session.user.id,
        });
        if (!cancelled && profile) {
          const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
          const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, 'espace-technicien', profile.id);
          if (effectiveProfile.statut !== 'Actif') {
            await supabase.auth.signOut();
          } else if (!cancelled) {
            setSpaceUserProfiles(profileSettings);
            localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(profileSettings));
            setUserData({ ...profile, appSpaceProfile: effectiveProfile });
            setIsAuthenticated(true);
          }
        } else if (!cancelled) {
          await supabase.auth.signOut();
        }
      }
      if (!cancelled) setIsCheckingSession(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = (status, data) => {
    setIsAuthenticated(status);
    setUserData(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Nettoyage des anciens vestiges localStorage (migration douce)
    try { localStorage.removeItem('pmuTechnicienAuth'); } catch {}
    setIsAuthenticated(false);
    setUserData(null);
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

  useEffect(() => {
    const loadSettings = async () => {
      const normalizedSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
      setSpaceUserProfiles(normalizedSettings);
      localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const handleSpaceUserProfilesUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceUserProfiles(event.detail);
      setSpaceUserProfiles(normalizedSettings);
      localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-space-user-profiles-updated', handleSpaceUserProfilesUpdated);
    return () => window.removeEventListener('app-space-user-profiles-updated', handleSpaceUserProfilesUpdated);
  }, []);

  const baseMenuItems = [
    { key: 'maintenance', label: 'Maintenance', icon: <CalendarDays className="h-5 w-5" /> },
    { key: 'planning', label: 'Réparation', icon: <Wrench className="h-5 w-5" /> },
  ];

  const menuItems = useMemo(
    () =>
      baseMenuItems.filter((item) =>
        isAppSpaceTabEnabled(spaceTabFunctionalities, 'espace-technicien', item.key)
        && canAccessAppSpaceUserTab(spaceUserProfiles, 'espace-technicien', userData?.id, item.key)
      ),
    [spaceTabFunctionalities, spaceUserProfiles, userData?.id]
  );

  useEffect(() => {
    const fallbackTab = menuItems[0]?.key || getFirstEnabledAppSpaceTab(spaceTabFunctionalities, 'espace-technicien')?.key || null;

    if (!menuItems.length) {
      setActiveSection('');
      return;
    }

    if (!menuItems.some((item) => item.key === activeSection) && fallbackTab) {
      setActiveSection(fallbackTab);
    }
  }, [activeSection, menuItems, spaceTabFunctionalities]);

  // Ferme le tiroir mobile après sélection d'une section
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeSection]);

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-space-layout flex flex-col gap-4 md:flex-row lg:gap-8">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className="app-space-menu-toggle md:hidden"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
      >
        {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>
      {isMobileMenuOpen && (
        <div className="app-space-backdrop md:hidden" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
      )}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`app-space-sidebar md:w-72 md:shrink-0 ${isMobileMenuOpen ? 'is-open' : ''}`}
      >
        <div className="app-space-sidebar-scroll sticky top-20 space-y-3 max-h-[calc(100vh-5.5rem)] overflow-y-auto pb-4 pr-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="relative p-4">
              <div className="flex items-center gap-3">
                {userData?.photo_url ? (
                  <img
                    src={userData.photo_url}
                    alt="Photo de profil"
                    className="h-12 w-12 shrink-0 rounded-[1rem] object-cover ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]">
                    <span className="text-lg font-black">
                      {[userData?.prenom?.[0], userData?.nom?.[0]].filter(Boolean).join('') || 'TM'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">Espace Technicien</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-foreground">{userData?.prenom} {userData?.nom}</p>
                  <p className="text-[0.68rem] text-muted-foreground">Technicien de maintenance</p>
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
                  const isActive = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveSection(item.key)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                      }`}
                    >
                      {React.cloneElement(item.icon, { className: 'h-4 w-4 shrink-0' })}
                      {item.label}
                    </button>
                  );
                })}
              </nav>
              <div className="mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={() => setIsProfileDialogOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-all hover:bg-primary/10 hover:text-primary"
                >
                  <UserCog className="h-4 w-4 shrink-0" />
                  Modifier mon profil
                </button>
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

      <EditProfileDialog
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        table="techniciens"
        recordId={userData?.id}
        withPhoto
        photoPrefix="photos_techniciens"
        currentPhotoUrl={userData?.photo_url || null}
        initialData={{ nom: userData?.nom, prenom: userData?.prenom, telephone: userData?.telephone, email: userData?.email }}
        onSaved={(fields) => setUserData((prev) => ({ ...(prev || {}), ...fields }))}
      />

      <main className="app-space-main min-w-0 flex-1 overflow-visible">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Suspense fallback={<SectionLoader />}>
          {!menuItems.length ? (
            <Card className="shadow-xl glassmorphism">
              <CardContent className="p-6 text-center text-muted-foreground">
                Aucun onglet n’est actuellement activé pour l’Espace Technicien.
              </CardContent>
            </Card>
          ) : activeSection === 'planning' ? (
            <MonPlanningMaintenancePage technicien={userData} view="reparation" />
          ) : (
            <div className="space-y-6">
              <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                <CardHeader>
                  <CardTitle className="flex items-center text-3xl font-bold text-primary">
                    <CalendarDays className="mr-3 h-8 w-8" /> Maintenance
                  </CardTitle>
                  <CardDescription>Consultez votre planning et effectuez vos interventions de maintenance.</CardDescription>
                </CardHeader>
              </Card>
              <Tabs defaultValue="maintenance" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="maintenance" className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> Faire une Maintenance
                  </TabsTrigger>
                  <TabsTrigger value="planning" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Mon Planning
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="maintenance">
                  <MaintenanceTab technicien={userData} />
                </TabsContent>
                <TabsContent value="planning">
                  <MonPlanningMaintenancePage technicien={userData} view="planning" hideTitle />
                </TabsContent>
              </Tabs>
            </div>
          )}
          </Suspense>
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceMaintenancePage;
