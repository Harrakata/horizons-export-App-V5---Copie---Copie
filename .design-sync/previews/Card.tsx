import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from 'pmu-mali-gestion';

export function PointDeVente() {
  return (
    <Card className="w-[340px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Bamako Centre</CardTitle>
          <Badge>Actif</Badge>
        </div>
        <CardDescription>Agence régionale · Code PDV 0427</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Chiffre du jour</span>
          <span className="font-medium">1 240 500 FCFA</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Guichetières présentes</span>
          <span className="font-medium">4 / 5</span>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">Détails</Button>
        <Button size="sm">Pointer</Button>
      </CardFooter>
    </Card>
  );
}

export function StatKpi() {
  return (
    <Card className="w-[240px]">
      <CardHeader>
        <CardDescription>Encaissements (mois)</CardDescription>
        <CardTitle className="text-3xl">38,2 M</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">+12,4 % vs mois précédent</p>
      </CardContent>
    </Card>
  );
}
