import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { defaultSupabase } from '@/lib/supabaseClient';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Page de réinitialisation du mot de passe, atteinte via le lien reçu par e-mail.
 * Supabase établit une session « recovery » à partir du token présent dans l'URL.
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1) Écoute l'évènement PASSWORD_RECOVERY (déclenché par detectSessionInUrl)
    const { data: sub } = defaultSupabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
      }
    });

    // 2) Au cas où la session est déjà établie au montage
    defaultSupabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.session) {
        setStatus('ready');
      } else {
        // Laisse 2.5s à detectSessionInUrl pour traiter le hash, sinon lien invalide/expiré
        setTimeout(() => {
          if (cancelled) return;
          setStatus((current) => (current === 'checking' ? 'invalid' : current));
        }, 2500);
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({ title: 'Mot de passe trop court', description: `Au moins ${MIN_PASSWORD_LENGTH} caractères.`, variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Confirmation incorrecte', description: 'Les deux mots de passe ne correspondent pas.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await defaultSupabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: 'Échec', description: error.message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      // On déconnecte la session de récupération pour forcer une reconnexion propre.
      await defaultSupabase.auth.signOut().catch(() => {});
      setStatus('done');
      toast({ title: 'Mot de passe réinitialisé', description: 'Vous pouvez maintenant vous reconnecter.', className: 'bg-green-500 text-white' });
    } catch (err) {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite.", variant: 'destructive' });
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-center min-h-[calc(100vh-12rem)] p-4"
    >
      <Card className="relative w-full max-w-md overflow-hidden border border-primary/20 shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-primary">
            <ShieldCheck className="h-6 w-6" />
            Réinitialiser le mot de passe
          </CardTitle>
          <CardDescription>Choisissez un nouveau mot de passe pour votre compte.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'checking' && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Vérification du lien…
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Lien invalide ou expiré. Relancez une demande de réinitialisation depuis la page de connexion.
              </div>
              <Button asChild className="w-full"><Link to="/">Retour à l'accueil</Link></Button>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                Votre mot de passe a été réinitialisé. Reconnectez-vous avec votre nouveau mot de passe.
              </div>
              <Button asChild className="w-full"><Link to="/">Aller à la connexion</Link></Button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-new">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="reset-new"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirmer le mot de passe</Label>
                <Input
                  id="reset-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">Au moins {MIN_PASSWORD_LENGTH} caractères.</p>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Réinitialiser
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ResetPasswordPage;
