import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wrench, Loader2, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import ConfigurationTab from '@/pages/maintenance/ConfigurationTab';
import MaintenanceTab from '@/pages/maintenance/MaintenanceTab';

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary flex items-center">
          <Wrench className="h-6 w-6 mr-2" />Maintenance Terminaux
        </h1>
        <Button variant="outline" onClick={handleLogout} className="flex items-center">
          <LogOut className="h-4 w-4 mr-2" />Déconnexion
        </Button>
      </div>
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <ConfigurationTab />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenanceTab technicien={userData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EspaceMaintenancePage;
