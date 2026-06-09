import React, { useState } from 'react';
import { Mail, Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

/**
 * Boîte de dialogue « Mot de passe oublié » : envoie un lien de réinitialisation
 * par e-mail (Supabase Auth) qui redirige vers /reset-password.
 *
 * @param {boolean}  open
 * @param {Function} onOpenChange
 * @param {string}   [defaultEmail]  e-mail pré-rempli (depuis le champ de login)
 */
const ForgotPasswordDialog = ({ open, onOpenChange, defaultEmail = '' }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail(defaultEmail || '');
      setSent(false);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({ title: 'E-mail requis', description: 'Saisissez votre adresse e-mail.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // On affiche un message neutre dans tous les cas (ne pas révéler si l'e-mail existe).
      if (error && !/rate limit|too many/i.test(error.message || '')) {
        // Erreur technique réelle (config, réseau) — on informe.
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      setSent(true);
    } catch (err) {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite.", variant: 'destructive' });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-t-lg bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            Mot de passe oublié
          </DialogTitle>
          <DialogDescription>
            Saisissez votre e-mail : si un compte existe, vous recevrez un lien pour réinitialiser votre mot de passe.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Si un compte est associé à <span className="font-semibold">{email.trim().toLowerCase()}</span>, un e-mail de réinitialisation vient d'être envoyé. Vérifiez votre boîte de réception (et vos spams).
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@groupecarrus.com"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Annuler</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Envoyer le lien
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordDialog;
