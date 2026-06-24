import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'pmu-mali-gestion';

export function Confirmation() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer ce point de vente ?</DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Le PDV « Bamako Centre » et tout son
            historique de pointage seront définitivement retirés.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Annuler</Button>
          <Button variant="destructive">Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
