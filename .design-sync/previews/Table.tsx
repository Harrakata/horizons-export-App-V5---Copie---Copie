import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from 'pmu-mali-gestion';

const rows = [
  { code: '0427', nom: 'Bamako Centre', ca: '1 240 500', statut: 'Actif' },
  { code: '0512', nom: 'Kati Marché', ca: '845 000', statut: 'Actif' },
  { code: '0733', nom: 'Ségou Gare', ca: '0', statut: 'Hors service' },
];

export function PointsDeVente() {
  return (
    <Table>
      <TableCaption>Chiffre d'affaires du jour par point de vente</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Point de vente</TableHead>
          <TableHead className="text-right">CA (FCFA)</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.code}>
            <TableCell className="font-medium">{r.code}</TableCell>
            <TableCell>{r.nom}</TableCell>
            <TableCell className="text-right">{r.ca}</TableCell>
            <TableCell>
              <Badge variant={r.statut === 'Actif' ? 'default' : 'destructive'}>{r.statut}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
