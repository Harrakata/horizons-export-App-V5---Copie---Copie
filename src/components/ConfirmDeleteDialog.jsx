import { AlertTriangle, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Modal de confirmation de suppression réutilisable, stylé identique à celui
 * de ProfilsExploitationPage. Idéal pour les actions destructives qui
 * suppriment à la fois un profil métier et un compte Supabase Auth associé.
 *
 * @example
 *   <ConfirmDeleteDialog
 *     open={!!profilToDelete}
 *     onCancel={() => setProfilToDelete(null)}
 *     onConfirm={confirmDelete}
 *     isLoading={isLoading}
 *     itemLabel="ce technicien"
 *     itemName={`${technicien.prenom} ${technicien.nom}`}
 *     itemEmail={technicien.email}
 *     hasAuthAccount={!!technicien.auth_user_id}
 *   />
 */
const ConfirmDeleteDialog = ({
  open,
  onCancel,
  onConfirm,
  isLoading       = false,
  title           = 'Suppression définitive',
  subtitle        = 'Cette action est irréversible.',
  itemLabel       = 'cet élément',
  itemName        = '',
  itemEmail       = null,
  hasAuthAccount  = false,
  extraConsequences = [],
  tip             = "Pour empêcher temporairement la connexion sans perdre le profil, utilisez plutôt le bouton Désactiver.",
}) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <DialogContent className="sm:max-w-md p-0 overflow-hidden">
      {/* Bandeau d'alerte */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 py-5 text-white">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
            <AlertTriangle className="h-7 w-7 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-white">{title}</DialogTitle>
            <DialogDescription className="text-red-50/90 text-sm mt-0.5">
              {subtitle}
            </DialogDescription>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-foreground">
          Vous êtes sur le point de supprimer {itemLabel} :
        </p>

        {(itemName || itemEmail) && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            {itemName && (
              <p className="text-base font-semibold text-foreground">{itemName}</p>
            )}
            {itemEmail && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3 w-3" /> {itemEmail}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Conséquences</p>
          <ul className="space-y-1.5 text-xs text-red-700">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>L'élément sera <strong>supprimé définitivement</strong> de la base.</span>
            </li>
            {hasAuthAccount && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>Le <strong>compte d'accès Supabase Auth</strong> associé sera également supprimé.</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>L'utilisateur ne pourra <strong>plus se connecter</strong> à l'application.</span>
            </li>
            {extraConsequences.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {tip && (
          <p className="text-xs text-muted-foreground italic">
            💡 {tip}
          </p>
        )}
      </div>

      {/* Actions */}
      <DialogFooter className="border-t bg-muted/20 px-6 py-3 gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={isLoading}
          className="gap-2 bg-red-600 hover:bg-red-700 text-white"
        >
          <Trash2 className="h-4 w-4" />
          {isLoading ? 'Suppression…' : 'Supprimer définitivement'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ConfirmDeleteDialog;
