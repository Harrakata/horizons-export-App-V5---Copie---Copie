import { Tabs, TabsList, TabsTrigger, TabsContent } from 'pmu-mali-gestion';

export function Espaces() {
  return (
    <Tabs defaultValue="planning" className="w-[440px]">
      <TabsList>
        <TabsTrigger value="planning">Planning</TabsTrigger>
        <TabsTrigger value="pointage">Pointage</TabsTrigger>
        <TabsTrigger value="caisse">Caisse</TabsTrigger>
      </TabsList>
      <TabsContent value="planning" className="text-sm text-muted-foreground">
        Planning hebdomadaire des guichetières par point de vente.
      </TabsContent>
      <TabsContent value="pointage" className="text-sm text-muted-foreground">
        Pointages d'arrivée et de départ du jour.
      </TabsContent>
      <TabsContent value="caisse" className="text-sm text-muted-foreground">
        État de caisse et encaissements.
      </TabsContent>
    </Tabs>
  );
}
