import React, { useState } from 'react';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
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

const MIN_PASSWORD_LENGTH = 6;

/**
 * Boîte de dialogue de changement de mot de passe de l'utilisateur connecté.
 * S'appuie sur Supabase Auth (supabase.auth.updateUser) — le client scopé de
 * l'espace courant est automatiquement sélectionné par le proxy supabase.
 *
 * @param {boolean}  open
 * @param {Function} onOpenChange
 */
const ChangePasswordDialog = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const reset = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setIsLoading(false);
  };

  const handleOpenChange = (value) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Mot de passe trop court',
        description: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Confirmation incorrecte',
        description: 'Les deux mots de passe ne correspondent pas.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        toast({
          title: 'Session requise',
          description: "Le changement de mot de passe n'est disponible que pour les comptes connectés via authentification sécurisée.",
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: 'Échec du changement', description: error.message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Mot de passe mis à jour',
        description: 'Votre mot de passe a été modifié avec succès.',
        className: 'bg-green-500 text-white',
      });
      handleOpenChange(false);
    } catch (err) {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite.", variant: 'destructive' });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <KeyRound className="h-5 w-5" />
            Changer mon mot de passe
          </DialogTitle>
          <DialogDescription>
            Saisissez un nouveau mot de passe ({MIN_PASSWORD_LENGTH} caractères minimum) pour votre compte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-password"
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
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Mettre à jour
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
