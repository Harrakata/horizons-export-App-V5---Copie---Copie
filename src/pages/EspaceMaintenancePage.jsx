import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wrench, Loader2, LogOut, Mail, Phone, BadgeCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import ConfigurationTab from '@/pages/maintenance/ConfigurationTab';
import MaintenanceTab from '@/pages/maintenance/MaintenanceTab';
import MaintenancePlanningSection from '@/components/maintenance/MaintenancePlanningSection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
            <Wrench className="inline-block h-8 w-8 mr-2 text-primary" />Maintenance Terminaux
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

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Card className="flex-1 shadow-xl glassmorphism">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                {userData?.photo_url ? <AvatarImage src={userData.photo_url} alt={`${userData.prenom} ${userData.nom}`} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {[userData?.prenom?.[0], userData?.nom?.[0]].filter(Boolean).join('') || 'TM'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-primary flex items-center">
                  <Wrench className="h-6 w-6 mr-2" />
                  Maintenance Terminaux
                </h1>
                <p className="text-base font-medium text-foreground">
                  {userData?.prenom} {userData?.nom}
                </p>
                <p className="text-sm text-muted-foreground">
                  {userData?.matricule ? `Matricule ${userData.matricule}` : 'Technicien connecté'}
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground md:min-w-[260px]">
              {userData?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>{userData.email}</span>
                </div>
              )}
              {userData?.telephone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{userData.telephone}</span>
                </div>
              )}
              {userData?.matricule && (
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <span>{userData.matricule}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={handleLogout} className="flex items-center self-start">
          <LogOut className="h-4 w-4 mr-2" />Déconnexion
        </Button>
      </div>
      <Tabs defaultValue="config">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="planning">Mon planning de Maintenance</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <ConfigurationTab />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenanceTab technicien={userData} />
        </TabsContent>
        <TabsContent value="planning">
          <MaintenancePlanningSection
            title="Mon planning de Maintenance"
            description="Consultez les maintenances qui vous sont assignées, leur créneau et le suivi automatique des interventions enregistrées."
            lockedTechnicienId={userData?.id}
            canManage={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EspaceMaintenancePage;
