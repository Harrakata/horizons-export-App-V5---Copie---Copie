import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, LogOut, MapPin, FileText, ShieldCheck, Wallet, AtSign, Loader2, UserCog, Menu, X } from 'lucide-react';
import EditProfileDialog from '@/components/EditProfileDialog';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import NotificationBell from '@/components/NotificationBell';
import { useSpaceNotifications } from '@/hooks/useSpaceNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabaseClient';
import { GUICHETIERE_AUTH_KEY, buildGuichetiereDisplayName } from '@/lib/guichetiereSpace';
import { smartSignIn, fetchAuthLinkedProfile, fetchOrLinkAuthProfile } from '@/lib/smartAuth';
import { useActivityTracker } from '@/hooks/useActivityTracker';
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

const loadSpaceUserProfilesSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', APP_SPACE_USER_PROFILES_SETTINGS_KEY)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return normalizeAppSpaceUserProfiles(data?.value);
};

const resolveCurrentAgenceName = async ({ agenceName, codePDV } = {}) => {
  const cleanCode = String(codePDV || '').trim();
  const cleanName = String(agenceName || '').trim();

  if (cleanCode) {
    const { data } = await supabase
      .from('agences')
      .select('nom, codePDV')
      .eq('codePDV', cleanCode)
      .eq('is_current', true)
      .maybeSingle();
    if (data?.nom) return data.nom;
  }

  if (!cleanName) return cleanName;

  const { data: currentByName } = await supabase
    .from('agences')
    .select('nom, codePDV')
    .eq('nom', cleanName)
    .eq('is_current', true)
    .maybeSingle();
  if (currentByName?.nom) return currentByName.nom;

  const { data: historicalRows } = await supabase
    .from('agences')
    .select('nom, codePDV, is_current')
    .eq('nom', cleanName)
    .limit(1);
  const historicalCode = historicalRows?.[0]?.codePDV;
  if (!historicalCode) return cleanName;

  const { data: currentByCode } = await supabase
    .from('agences')
    .select('nom')
    .eq('codePDV', historicalCode)
    .eq('is_current', true)
    .maybeSingle();

  return currentByCode?.nom || cleanName;
};

const LoginPageGuichetiere = ({ onLogin }) => {
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!identifier.trim() || !password) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez renseigner votre identifiant et votre mot de passe.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    // 1) Auth Supabase (smart : accepte email ou matricule)
    const { data: authData, error: authErr } = await smartSignIn({
      identifier, password, table: 'guichetieres',
    });
    if (authErr || !authData?.user) {
      toast({
        title: 'Connexion refusée',
        description: authErr?.message?.includes('Invalid login credentials')
          ? 'Identifiant ou mot de passe incorrect.'
          : (authErr?.message ?? 'Identifiant ou mot de passe incorrect.'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // 2) Récupérer la fiche guichetière liée à ce compte auth (filtre is_current = true)
    const { data: profile, error: profileErr } = await fetchOrLinkAuthProfile({
      table: 'guichetieres',
      authUserId: authData.user.id,
      identifier,
      authEmail: authData.user.email,
      statusCol: 'is_current',
      activeValue: true,
    });
    if (profileErr || !profile) {
      await supabase.auth.signOut();
      toast({
        title: 'Aucune fiche guichetière associée',
        description: profileErr?.message || 'Votre compte n\'est lié à aucune fiche guichetière active. Contactez un administrateur.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
    const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, 'espace-guichetiere', profile.id);
    if (effectiveProfile.statut !== 'Actif') {
      await supabase.auth.signOut();
      toast({
        title: 'Compte désactivé',
        description: 'Votre profil Guichetière est désactivé. Contactez un administrateur.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    onLogin({ ...profile, appSpaceProfile: effectiveProfile });
    toast({
      title: 'Connexion réussie',
      description: `Bienvenue ${buildGuichetiereDisplayName(profile)} dans votre espace Guichetière.`,
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
            Connectez-vous avec votre email ou votre matricule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="guichetiere-identifier" className="flex items-center gap-2">
                <AtSign className="h-4 w-4" /> Identifiant
              </Label>
              <Input
                id="guichetiere-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Email ou matricule"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guichetiere-password">Mot de passe</Label>
              <Input
                id="guichetiere-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-green-600 text-white hover:from-primary/90 hover:to-green-600/90"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
            <div className="text-center">
              <button type="button" onClick={() => setIsForgotOpen(true)} className="text-sm font-medium text-primary hover:underline">
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ForgotPasswordDialog open={isForgotOpen} onOpenChange={setIsForgotOpen} defaultEmail={identifier.includes('@') ? identifier : ''} />
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
    spaceKey: 'espace-guichetiere',
    isAuthenticated,
    identity: guichetiereInfo,
  });

  const { notifications: guichetiereNotifications, totalCount: guichetiereNotifCount } = useSpaceNotifications({
    spaceKey: 'espace-guichetiere',
    enabled: isAuthenticated,
    context: { matricule: guichetiereInfo?.matricule },
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

  const handleLogin = async (guichetiereData) => {
    // SCD Type 2 : on lit l'affectation courante depuis guichetiere_agence_history
    // (source de vérité) pour ne pas se retrouver avec une agence stale au login.
    let resolvedAgence = guichetiereData.agenceAssigne;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: histRows } = await supabase
        .from('guichetiere_agence_history')
        .select('agence_assignee, valid_from, valid_to')
        .eq('code_prepose', guichetiereData.codePrepose)
        .or(`valid_to.is.null,valid_to.gte.${today}`)
        .order('valid_from', { ascending: false });
      const current = (histRows || []).find((h) => h.valid_to == null) ?? histRows?.[0];
      if (current?.agence_assignee) resolvedAgence = current.agence_assignee;
    } catch {
      // En cas d'échec on retombe sur la valeur dénormalisée — comportement legacy.
    }

    try {
      resolvedAgence = await resolveCurrentAgenceName({ agenceName: resolvedAgence });
    } catch {
      // On conserve l'agence résolue depuis l'historique si la table agences est indisponible.
    }

    const enrichedData = { ...guichetiereData, agenceAssigne: resolvedAgence };
    const nextAuthData = {
      isAuthenticated: true,
      guichetiereInfo: {
        id: enrichedData.id,
        matricule: enrichedData.matricule,
        nomComplet: buildGuichetiereDisplayName(enrichedData),
        nomAgence: resolvedAgence || 'Agence non renseignée',
        photo_url: enrichedData.photo_url || null,
      },
      guichetiereDetails: enrichedData,
    };

    setIsAuthenticated(true);
    setGuichetiereInfo(nextAuthData.guichetiereInfo);
    setGuichetiereDetails(enrichedData);
    localStorage.setItem(GUICHETIERE_AUTH_KEY, JSON.stringify(nextAuthData));
    navigate('/espace-guichetiere/mon-planning', { replace: true });
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
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

  // Restauration auto : session Supabase Auth valide → on re-fetch la fiche
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAuthenticated) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const { data: profile } = await fetchAuthLinkedProfile({
        table: 'guichetieres',
        authUserId: session.user.id,
        statusCol: 'is_current',
        activeValue: true,
      });
      if (cancelled) return;
      if (profile) {
        const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
        const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, 'espace-guichetiere', profile.id);
        if (effectiveProfile.statut !== 'Actif') {
          await supabase.auth.signOut();
        } else {
          setSpaceUserProfiles(profileSettings);
          localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(profileSettings));
          handleLogin({ ...profile, appSpaceProfile: effectiveProfile });
        }
      } else {
        await supabase.auth.signOut();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshCurrentAgency = async () => {
      if (!isAuthenticated || !guichetiereDetails?.id) return;

      const { data: profile } = await supabase
        .from('guichetieres')
        .select('*')
        .eq('id', guichetiereDetails.id)
        .maybeSingle();

      if (cancelled || !profile) return;

      let resolvedAgence = profile.agenceAssigne || guichetiereInfo?.nomAgence;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: histRows } = await supabase
          .from('guichetiere_agence_history')
          .select('agence_assignee, valid_from, valid_to')
          .eq('code_prepose', profile.codePrepose)
          .or(`valid_to.is.null,valid_to.gte.${today}`)
          .order('valid_from', { ascending: false });
        const current = (histRows || []).find((h) => h.valid_to == null) ?? histRows?.[0];
        if (current?.agence_assignee) resolvedAgence = current.agence_assignee;
        resolvedAgence = await resolveCurrentAgenceName({ agenceName: resolvedAgence });
      } catch {}

      if (cancelled) return;
      const enrichedDetails = { ...profile, agenceAssigne: resolvedAgence };
      const enrichedInfo = {
        id: enrichedDetails.id,
        matricule: enrichedDetails.matricule,
        nomComplet: buildGuichetiereDisplayName(enrichedDetails),
        nomAgence: resolvedAgence || 'Agence non renseignée',
        photo_url: enrichedDetails.photo_url || null,
      };
      const nextAuthData = {
        isAuthenticated: true,
        guichetiereInfo: enrichedInfo,
        guichetiereDetails: enrichedDetails,
      };
      setGuichetiereInfo(enrichedInfo);
      setGuichetiereDetails(enrichedDetails);
      localStorage.setItem(GUICHETIERE_AUTH_KEY, JSON.stringify(nextAuthData));
    };

    refreshCurrentAgency();
    return () => { cancelled = true; };
  }, [isAuthenticated, guichetiereDetails?.id]);

  const menuItems = [
    { path: 'mon-planning', label: 'Mon Planning', icon: <CalendarDays className="h-5 w-5" /> },
    { path: 'mes-pointages', label: 'Mes Pointages', icon: <FileText className="h-5 w-5" /> },
    { path: 'mes-points-vente-mobi', label: 'Mes Points de Vente Mobi', icon: <MapPin className="h-5 w-5" /> },
    { path: 'etat-caisse', label: 'État de Caisse', icon: <Wallet className="h-5 w-5" /> },
  ].filter((item) =>
    isAppSpaceTabEnabled(spaceTabFunctionalities, 'espace-guichetiere', item.path)
    && canAccessAppSpaceUserTab(spaceUserProfiles, 'espace-guichetiere', guichetiereDetails?.id, item.path)
  );

  const normalizedPathname = location.pathname.replace(/\/+$/, '');
  const isMenuItemActive = (itemPath) => normalizedPathname === `/espace-guichetiere/${itemPath}`;

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!normalizedPathname.startsWith('/espace-guichetiere')) return;
    if (!menuItems.length) return;

    const fallbackPath = menuItems[0]?.path || getFirstEnabledAppSpaceTab(spaceTabFunctionalities, 'espace-guichetiere')?.key || null;
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <LoginPageGuichetiere onLogin={handleLogin} />;
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
                {(guichetiereInfo?.photo_url || guichetiereDetails?.photo_url) ? (
                  <img
                    src={guichetiereInfo?.photo_url || guichetiereDetails?.photo_url}
                    alt="Photo de profil"
                    className="h-12 w-12 shrink-0 rounded-[1rem] object-cover ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]">
                    <span className="text-lg font-black">
                      {guichetiereInfo?.nomComplet?.split(' ').map((part) => part[0]).join('') || 'G'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">Guichetière</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-foreground">{guichetiereInfo?.nomComplet}</p>
                  <p className="text-[0.68rem] text-muted-foreground">Agence : {guichetiereInfo?.nomAgence}</p>
                </div>
                <NotificationBell
                  notifications={guichetiereNotifications}
                  totalCount={guichetiereNotifCount}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                />
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
                  onClick={() => { setIsProfileDialogOpen(true); setIsMobileMenuOpen(false); }}
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
          <EditProfileDialog
            open={isProfileDialogOpen}
            onOpenChange={setIsProfileDialogOpen}
            table="guichetieres"
            recordId={guichetiereDetails?.id || guichetiereInfo?.id}
            withPhoto
            photoPrefix="photos_guichetieres"
            currentPhotoUrl={guichetiereDetails?.photo_url || guichetiereInfo?.photo_url || null}
            initialData={{ nom: guichetiereDetails?.nom, prenom: guichetiereDetails?.prenom, telephone: guichetiereDetails?.telephone, email: guichetiereDetails?.email }}
            onSaved={(fields) => {
              setGuichetiereDetails((prev) => ({ ...(prev || {}), ...fields }));
              const nomComplet = `${fields.prenom} ${fields.nom}`.trim();
              setGuichetiereInfo((prev) => (prev ? { ...prev, nomComplet, photo_url: fields.photo_url ?? prev.photo_url } : prev));
              try {
                const stored = JSON.parse(localStorage.getItem(GUICHETIERE_AUTH_KEY) || 'null');
                if (stored?.guichetiereInfo) {
                  stored.guichetiereInfo.nomComplet = nomComplet;
                  if ('photo_url' in fields) stored.guichetiereInfo.photo_url = fields.photo_url;
                  stored.guichetiereDetails = { ...(stored.guichetiereDetails || {}), ...fields };
                  localStorage.setItem(GUICHETIERE_AUTH_KEY, JSON.stringify(stored));
                }
              } catch {}
            }}
          />
        </div>
      </motion.aside>

      <main className="app-space-main flex-1 min-w-0 overflow-visible md:overflow-hidden">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {!menuItems.length ? (
            <Card className="shadow-xl glassmorphism">
              <CardContent className="p-6 text-center text-muted-foreground">
                Aucun onglet n’est actuellement autorisé pour votre profil Guichetière.
              </CardContent>
            </Card>
          ) : (
            <Outlet
              context={{
                guichetiereInfo,
                guichetiereDetails,
                nomAgence: guichetiereInfo?.nomAgence,
              }}
            />
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceGuichetierePage;
