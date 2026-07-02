import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ListTree, Loader2, LogOut, AtSign, UserCog, Menu, X, Building, Smartphone,
  MapPin, Globe, ClipboardCheck, Wrench, Wallet, Home, FileDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { smartSignIn, fetchOrLinkAuthProfile } from '@/lib/smartAuth';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  APP_SPACE_TAB_SETTINGS_KEY,
  APP_SPACE_USER_PROFILES_SETTINGS_KEY,
  buildDefaultAppSpaceTabFunctionalities,
  buildDefaultAppSpaceUserProfiles,
  canAccessAppSpaceUserTab,
  getEffectiveAppSpaceUserProfile,
  getFirstEnabledAppSpaceTab,
  isAppSpaceTabEnabled,
  normalizeAppSpaceTabFunctionalities,
  normalizeAppSpaceUserProfiles,
} from '@/lib/exploitationProfiles';

const SPACE_KEY = 'espace-chef-secteur';

const loadSpaceUserProfilesSettings = async () => {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', APP_SPACE_USER_PROFILES_SETTINGS_KEY).single();
  if (error && error.code !== 'PGRST116') throw error;
  return normalizeAppSpaceUserProfiles(data?.value);
};

const loadSpaceTabSettings = async () => {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', APP_SPACE_TAB_SETTINGS_KEY).single();
  if (error && error.code !== 'PGRST116') throw error;
  return normalizeAppSpaceTabFunctionalities(data?.value);
};
import EditProfileDialog from '@/components/EditProfileDialog';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PointagesSecteurSection, MaintenanceSecteurSection, PaiementsSecteurSection } from '@/components/chef_secteur/SecteurSupervision';
import RapportsPage from '@/pages/exploitation/RapportsPage';
import { REPORT_SCOPES } from '@/lib/reportsService';
import MobileTabBar from '@/components/mobile/MobileTabBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import SwipeTabs from '@/components/mobile/SwipeTabs';
import NotificationBell from '@/components/NotificationBell';
import RemonteeDialog from '@/components/RemonteeDialog';
import EnablePushButton from '@/components/EnablePushButton';
import useSpaceNotifications, { clearNotifWatch } from '@/hooks/useSpaceNotifications';

const SECTEUR_TAB_LABELS = { agences: 'Agences', pointages: 'Pointages', maintenance: 'Maint.', paiements: 'Paiements' };

const AUTH_KEY = 'chefSecteurAuth';

const LoginPage = ({ onLogin }) => {
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { data: authData, error: authErr } = await smartSignIn({ identifier, password, table: 'chefs_secteur' });
    if (authErr || !authData?.user) {
      toast({ title: 'Connexion échouée', description: 'Identifiant ou mot de passe incorrect.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    const { data: profile, error: profileErr } = await fetchOrLinkAuthProfile({
      table: 'chefs_secteur', authUserId: authData.user.id, identifier, authEmail: authData.user.email,
    });
    if (profileErr || !profile) {
      await supabase.auth.signOut();
      toast({ title: 'Aucun profil chef de secteur', description: "Votre compte n'est lié à aucune fiche chef de secteur.", variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    // Statut du profil utilisateur d'espace (Actif/Inactif)
    const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
    const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, SPACE_KEY, profile.id);
    if (effectiveProfile.statut !== 'Actif') {
      await supabase.auth.signOut();
      toast({ title: 'Compte désactivé', description: 'Votre profil Chef de secteur est désactivé. Contactez un administrateur.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    onLogin(profile);
    toast({ title: 'Connexion réussie', description: `Bienvenue ${profile.prenom} ${profile.nom}`, className: 'bg-green-500 text-white' });
    setIsLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-2xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary">
            <ListTree className="inline-block h-8 w-8 mr-2 text-primary" />Espace Chef de Secteur
          </CardTitle>
          <CardDescription className="text-center">Connectez-vous avec votre email ou votre matricule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="flex items-center gap-2"><AtSign className="h-4 w-4" />Identifiant</Label>
              <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email ou matricule" disabled={isLoading} required autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={isLoading} required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion...</>) : 'Se connecter'}
            </Button>
            <div className="text-center">
              <button type="button" onClick={() => setIsForgotOpen(true)} className="text-sm font-medium text-primary hover:underline">Mot de passe oublié ?</button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ForgotPasswordDialog open={isForgotOpen} onOpenChange={setIsForgotOpen} defaultEmail={identifier.includes('@') ? identifier : ''} />
    </motion.div>
  );
};

const NAV_ITEMS = [
  { key: 'agences', label: 'Mes agences', icon: Building },
  { key: 'pointages', label: 'Pointages', icon: ClipboardCheck },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'paiements', label: 'Paiements de gain', icon: Wallet },
  { key: 'rapports', label: 'Rapports', icon: FileDown },
];

// Centre de rapports pour le Chef de secteur : périmètre = agences du secteur.
const RapportsSecteurSection = ({ chef }) => {
  const [agenceNames, setAgenceNames] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('agences')
        .select('nom')
        .eq('is_current', true)
        .eq('secteur', chef.secteurEnCharge)
        .order('nom', { ascending: true });
      if (!cancelled) setAgenceNames((data || []).map((a) => a.nom).filter(Boolean));
    })();
    return () => { cancelled = true; };
  }, [chef.secteurEnCharge]);

  return (
    <RapportsPage
      scope={REPORT_SCOPES.CHEF_SECTEUR}
      allowedAgenceNames={agenceNames}
      actor={{
        id: chef?.id || null,
        name: [chef?.prenom, chef?.nom].filter(Boolean).join(' ') || 'Chef de secteur',
        role: 'Chef de secteur',
      }}
    />
  );
};

const AgencesSecteurSection = ({ chef }) => {
  const { toast } = useToast();
  const [agences, setAgences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('agences').select('*').eq('is_current', true).eq('secteur', chef.secteurEnCharge).order('nom', { ascending: true });
      if (cancelled) return;
      if (error) toast({ title: 'Erreur de chargement', description: error.message, variant: 'destructive' });
      else setAgences(data || []);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chef.secteurEnCharge, toast]);

  const totalTerminaux = useMemo(() => agences.reduce((s, a) => s + Number(a.nbreTerminaux || 0), 0), [agences]);

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-primary"><Building className="h-6 w-6" /> Agences du secteur</CardTitle>
          <CardDescription>Secteur : <span className="font-semibold">{chef.secteurEnCharge || '—'}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
            <KpiStatCard icon={Building} label="Agences" value={agences.length} tone="primary" />
            <KpiStatCard icon={Smartphone} label="Terminaux déclarés" value={totalTerminaux} tone="violet" />
            <KpiStatCard icon={Globe} label="Région" value={agences[0]?.region || chef.region || '—'} tone="blue" />
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Chargement…</p>
          ) : (
            <Table className="responsive-cards">
              <TableCaption>{agences.length === 0 ? 'Aucune agence rattachée à ce secteur.' : `${agences.length} agence(s).`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Code PDV</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Terminaux</TableHead>
                  <TableHead>Adresse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agences.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell data-label="Agence" className="font-medium">{a.nom}</TableCell>
                    <TableCell data-label="Code PDV">{a.codePDV || 'N/A'}</TableCell>
                    <TableCell data-label="Région">{a.region || 'N/A'}</TableCell>
                    <TableCell data-label="Terminaux">{a.nbreTerminaux ?? 0}</TableCell>
                    <TableCell data-label="Adresse">{a.adresse || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const EspaceChefSecteurPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chef, setChef] = useState(null);
  const [activeSection, setActiveSection] = useState('agences');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const handlePullRefresh = async () => { setRefreshKey((k) => k + 1); await new Promise((r) => setTimeout(r, 500)); };
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => buildDefaultAppSpaceTabFunctionalities());
  const [spaceUserProfiles, setSpaceUserProfiles] = useState(() => buildDefaultAppSpaceUserProfiles());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (saved?.isAuthenticated && saved?.chef) {
        setChef(saved.chef);
        setIsAuthenticated(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Réglages d'activation des onglets + profils utilisateurs d'espace
  useEffect(() => {
    if (!isAuthenticated) return;
    loadSpaceTabSettings().then(setSpaceTabFunctionalities).catch(() => {});
    loadSpaceUserProfilesSettings().then(setSpaceUserProfiles).catch(() => {});
  }, [isAuthenticated]);

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) =>
      isAppSpaceTabEnabled(spaceTabFunctionalities, SPACE_KEY, item.key)
      && canAccessAppSpaceUserTab(spaceUserProfiles, SPACE_KEY, chef?.id, item.key)
    ),
    [spaceTabFunctionalities, spaceUserProfiles, chef?.id]
  );

  // L'onglet actif doit rester accessible
  useEffect(() => {
    if (!chef) return;
    if (!visibleNavItems.some((i) => i.key === activeSection)) {
      const first = visibleNavItems[0]?.key || getFirstEnabledAppSpaceTab(spaceTabFunctionalities, SPACE_KEY)?.key || 'agences';
      setActiveSection(first);
    }
  }, [visibleNavItems, activeSection, spaceTabFunctionalities, chef]);

  useEffect(() => { setIsMobileMenuOpen(false); }, [activeSection]);

  useActivityTracker({ spaceKey: 'espace-chef-secteur', isAuthenticated, identity: chef });

  const handleLogin = useCallback((profile) => {
    setChef(profile);
    setIsAuthenticated(true);
    try { localStorage.setItem(AUTH_KEY, JSON.stringify({ isAuthenticated: true, chef: profile })); } catch { /* ignore */ }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    clearNotifWatch(SPACE_KEY);
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setChef(null);
    navigate('/');
  }, [navigate]);

  // ⚠ Tous les hooks doivent être appelés inconditionnellement, AVANT tout return
  // conditionnel (sinon « Rendered more hooks than during the previous render »).
  const { notifications: chefNotifications, totalCount: chefNotifCount, refresh: refreshChefNotifs } = useSpaceNotifications({
    spaceKey: SPACE_KEY,
    enabled: isAuthenticated && !!chef,
    context: { secteurNom: chef?.secteurEnCharge },
  });

  if (!isAuthenticated || !chef) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const initials = `${chef.prenom?.charAt(0) || ''}${chef.nom?.charAt(0) || ''}`.toUpperCase() || 'CS';

  return (
    <div className="app-space-layout has-mobile-header flex flex-col gap-4 md:flex-row lg:gap-8">

      {/* En-tête mobile : profil + bouton menu */}
      <div className="app-space-mobile-header md:hidden">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-white px-4 py-4 shadow-[0_6px_28px_-8px_rgba(15,23,42,0.30)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-transparent" />
          {chef.photo_url ? (
            <img src={chef.photo_url} alt="Profil" className="h-10 w-10 shrink-0 rounded-[0.75rem] object-cover ring-1 ring-primary/20" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20">
              <span className="text-sm font-black">{initials}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Espace Chef de Secteur</p>
            <p className="truncate text-sm font-bold text-foreground leading-tight">{chef.prenom} {chef.nom}</p>
          </div>
          <NotificationBell notifications={chefNotifications} totalCount={chefNotifCount} onRefresh={refreshChefNotifs} reader={{ id: chef?.id, role: 'chef_secteur', nom: [chef?.prenom, chef?.nom].filter(Boolean).join(' '), agence: null }} />
          <RemonteeDialog sender={{ id: chef?.id, role: 'chef_secteur', nom: [chef?.prenom, chef?.nom].filter(Boolean).join(' ') }} iconOnly className="ml-1" />
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            className="app-space-header-toggle flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-colors hover:bg-primary/10"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && <div className="app-space-backdrop md:hidden" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />}

      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`app-space-sidebar md:w-72 md:shrink-0 ${isMobileMenuOpen ? 'is-open' : ''}`}
      >
        <div className="app-space-sidebar-scroll sticky top-20 space-y-3 max-h-[calc(100vh-5.5rem)] overflow-y-auto pb-4 pr-1">
          <div className="hidden md:block">
          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <CardContent className="relative p-4">
              <div className="flex items-center gap-3">
                {chef.photo_url ? (
                  <img src={chef.photo_url} alt="Profil" className="h-12 w-12 shrink-0 rounded-[1rem] object-cover ring-1 ring-primary/20" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20">
                    <span className="text-lg font-black">{initials}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">Chef de Secteur</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-foreground">{chef.prenom} {chef.nom}</p>
                  <p className="flex items-center gap-1 text-[0.68rem] text-muted-foreground"><MapPin className="h-3 w-3" /> {chef.secteurEnCharge || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <CardContent className="relative p-3">
              <nav className="space-y-0.5">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveSection(item.key)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-semibold transition-all ${
                        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-border/40 bg-white/92 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur">
            <CardContent className="p-2">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}
                  className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 text-muted-foreground/70 transition-colors hover:bg-primary/8 hover:text-primary"
                >
                  <Home className="h-5 w-5" />
                  <span className="text-[0.6rem] font-semibold">Accueil</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsProfileDialogOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 text-muted-foreground/70 transition-colors hover:bg-primary/8 hover:text-primary"
                >
                  <UserCog className="h-5 w-5" />
                  <span className="text-[0.6rem] font-semibold">Profil</span>
                </button>
                <EnablePushButton reader={{ id: chef?.id, role: 'chef_secteur', nom: [chef?.prenom, chef?.nom].filter(Boolean).join(' '), agence: null }} asNavButton />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-[0.6rem] font-semibold">Déconn.</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.aside>

      <main className="app-space-main has-tabbar min-w-0 flex-1 overflow-visible">
        <SwipeTabs items={visibleNavItems.map((item) => ({ key: item.key, active: activeSection === item.key, onClick: () => setActiveSection(item.key) }))}>
        <PullToRefresh onRefresh={handlePullRefresh}>
        <motion.div
          key={`${activeSection}:${refreshKey}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {activeSection === 'agences' && <AgencesSecteurSection chef={chef} />}
          {activeSection === 'pointages' && <PointagesSecteurSection chef={chef} />}
          {activeSection === 'maintenance' && <MaintenanceSecteurSection chef={chef} />}
          {activeSection === 'paiements' && <PaiementsSecteurSection chef={chef} />}
          {activeSection === 'rapports' && <RapportsSecteurSection chef={chef} />}
        </motion.div>
        </PullToRefresh>
        </SwipeTabs>
      </main>

      <MobileTabBar
        items={visibleNavItems.map((item) => ({
          key: item.key,
          label: SECTEUR_TAB_LABELS[item.key] || item.label,
          icon: React.createElement(item.icon),
          active: activeSection === item.key,
          onClick: () => setActiveSection(item.key),
        }))}
        onMore={() => setIsMobileMenuOpen(true)}
        moreActive={isMobileMenuOpen}
      />

      <EditProfileDialog
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        table="chefs_secteur"
        recordId={chef?.id}
        withPhoto
        photoPrefix="photos_chefs_secteur"
        currentPhotoUrl={chef?.photo_url || null}
        initialData={{ nom: chef?.nom, prenom: chef?.prenom, telephone: chef?.telephone, email: chef?.email }}
        onSaved={(fields) => {
          const updated = { ...chef, ...fields };
          setChef(updated);
          try { localStorage.setItem(AUTH_KEY, JSON.stringify({ isAuthenticated: true, chef: updated })); } catch { /* ignore */ }
        }}
      />
    </div>
  );
};

export default EspaceChefSecteurPage;
