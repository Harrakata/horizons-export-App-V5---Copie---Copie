
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePageState } from '@/hooks/usePageState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, User, Phone, CircleDot, Users2, CalendarOff, Loader2, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays, parseISO, isValid as isValidDate } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import SalaireGuichetiereTab from '@/pages/exploitation/SalaireGuichetiereTab';
import { isSupabaseAuthError } from '@/lib/guichetiereSpace';

const normalizeAgencyName = (value) => String(value || '').trim();
const normalizeSearchText = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const buildAgencyNameScope = async ({ nomAgence, codePDV }) => {
  const names = new Set([normalizeAgencyName(nomAgence)].filter(Boolean));
  const cleanCode = String(codePDV || '').trim();

  if (cleanCode) {
    const { data } = await supabase
      .from('agences')
      .select('nom')
      .eq('codePDV', cleanCode);

    (data || []).forEach((agence) => {
      const name = normalizeAgencyName(agence.nom);
      if (name) names.add(name);
    });
  }

  return Array.from(names);
};

const MesGuichetieresPage = () => {
  const { nomAgence, chefDetails } = useOutletContext();
  const { toast } = useToast();
  const [guichetieres, setGuichetieres] = useState([]);
  const [searchTerm, setSearchTerm] = usePageState('chef-mes-guichetieres', 'searchTerm', '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchGuichetieresAgence = async () => {
      if (!nomAgence) return;
      setIsLoading(true);

      const agencyNames = await buildAgencyNameScope({
        nomAgence,
        codePDV: chefDetails?.codePDV,
      });

      // Source de vérité = guichetiere_agence_history.
      // 1) On récupère les codes_prepose actuellement affectés à cette agence
      //    (entrée courante = valid_to IS NULL ou valid_to >= aujourd'hui).
      const today = new Date().toISOString().slice(0, 10);
      let historyQuery = supabase
        .from('guichetiere_agence_history')
        .select('code_prepose, agence_assignee, valid_from, valid_to')
        .or(`valid_to.is.null,valid_to.gte.${today}`);

      historyQuery = agencyNames.length > 1
        ? historyQuery.in('agence_assignee', agencyNames)
        : historyQuery.eq('agence_assignee', agencyNames[0] || nomAgence);

      const { data: histRows, error: histErr } = await historyQuery;

      if (histErr) {
        if (!isSupabaseAuthError(histErr)) {
          toast({ title: 'Erreur chargement guichetières', description: histErr.message, variant: 'destructive' });
        }
      }

      const safeHistRows = histErr ? [] : (histRows || []);

      // Dédupliquer par code_prepose et garder l'entrée courante la plus récente
      const codesMap = {};
      safeHistRows.forEach((h) => {
        const prev = codesMap[h.code_prepose];
        if (!prev) { codesMap[h.code_prepose] = h; return; }
        const isCurrent = (x) => x.valid_to == null;
        if (isCurrent(h) && !isCurrent(prev)) codesMap[h.code_prepose] = h;
        else if (isCurrent(h) === isCurrent(prev) && (h.valid_from || '') > (prev.valid_from || '')) {
          codesMap[h.code_prepose] = h;
        }
      });
      const codes = Object.keys(codesMap);

      // 2) Fetch les guichetières correspondantes (SCD history + fallback legacy agenceAssigne).
      // L'état de caisse s'appuie aussi sur agenceAssigne quand l'historique n'est pas renseigné :
      // on garde donc ce secours pour éviter une liste vide alors que des guichetières existent.
      const [historyGuichResponse, directGuichResponse] = await Promise.all([
        codes.length > 0
          ? supabase
              .from('guichetieres')
              .select('*')
              .in('codePrepose', codes)
              .eq('is_current', true)
              .order('nom', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('guichetieres')
          .select('*')
          .in('agenceAssigne', agencyNames.length ? agencyNames : [nomAgence])
          .eq('is_current', true)
          .order('nom', { ascending: true }),
      ]);

      const guichErr = historyGuichResponse.error || directGuichResponse.error;

      if (historyGuichResponse.error && directGuichResponse.error) {
        if (!isSupabaseAuthError(guichErr)) {
          toast({ title: 'Erreur chargement guichetières', description: guichErr.message, variant: 'destructive' });
        }
        setGuichetieres([]);
      } else {
        const rowsByKey = new Map();
        [
          ...(directGuichResponse.error ? [] : directGuichResponse.data || []),
          ...(historyGuichResponse.error ? [] : historyGuichResponse.data || []),
        ].forEach((g) => {
          const key = g.codePrepose || g.matricule || g.id;
          if (!key) return;
          rowsByKey.set(String(key), {
            ...g,
            agenceAssigne: codesMap[g.codePrepose]?.agence_assignee ?? g.agenceAssigne,
          });
        });

        const agencyScope = new Set(agencyNames.map(normalizeSearchText));
        const enriched = Array.from(rowsByKey.values())
          .filter((g) => agencyScope.size === 0 || agencyScope.has(normalizeSearchText(g.agenceAssigne)))
          .sort((first, second) =>
            `${first.nom || ''} ${first.prenom || ''}`.localeCompare(`${second.nom || ''} ${second.prenom || ''}`)
          );

        setGuichetieres(enriched);
      }
      setIsLoading(false);
    };

    fetchGuichetieresAgence();
  }, [chefDetails?.codePDV, nomAgence, toast]);

  const filteredGuichetieres = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm);
    return guichetieres.filter((g) => {
      if (!normalizedSearch) return true;
      return (
        normalizeSearchText(g.nom).includes(normalizedSearch) ||
        normalizeSearchText(g.prenom).includes(normalizedSearch) ||
        normalizeSearchText(g.matricule).includes(normalizedSearch) ||
        normalizeSearchText(g.codePrepose).includes(normalizedSearch) ||
        normalizeSearchText(g.disponibilite).includes(normalizedSearch)
      );
    });
  }, [guichetieres, searchTerm]);

  const getDisponibiliteInfo = (g) => {
    if (g.disponibilite === 'Disponible') return <span className="text-green-500">Disponible</span>;
    
    let infoText = g.disponibilite === 'Absent' ? <span className="text-yellow-500">Absent(e)</span> : <span className="text-red-500">Suspendu(e)</span>;
    
    if (g.dateDebutIndisponibilite && g.dateFinIndisponibilite) {
      const debut = parseISO(g.dateDebutIndisponibilite);
      const fin = parseISO(g.dateFinIndisponibilite);
      if (isValidDate(debut) && isValidDate(fin)) {
        const jours = differenceInDays(fin, debut) + 1;
        const formattedDebut = format(debut, 'dd/MMM/yy', { locale: fr });
        const formattedFin = format(fin, 'dd/MMM/yy', { locale: fr });
        return (
          <div className="flex flex-col text-xs">
            {infoText}
            <span className="text-muted-foreground">Du {formattedDebut} au {formattedFin} ({jours} jour{jours > 1 ? 's' : ''})</span>
          </div>
        );
      }
    }
    return infoText;
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Titre — toujours en haut */}
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <div>
            <CardTitle className="text-3xl font-bold text-primary flex items-center">
              <Users2 className="mr-3 h-8 w-8" /> Mes Guichetières ({nomAgence})
            </CardTitle>
            <CardDescription>Liste des guichetières assignées à votre agence.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="salaire" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="salaire" className="gap-1.5">
            <Wallet className="h-4 w-4" /> État de Caisse
          </TabsTrigger>
          <TabsTrigger value="liste" className="gap-1.5">
            <Users2 className="h-4 w-4" /> Mes Guichetières
          </TabsTrigger>
        </TabsList>

        <TabsContent value="liste">
          <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardHeader>
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Rechercher une guichetière..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                  disabled={isLoading}
                />
              </div>
            </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : filteredGuichetieres.length > 0 ? (
            <Table>
              <TableCaption>Liste de vos guichetières.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead><User className="inline-block mr-1 h-4 w-4" />Matricule</TableHead>
                  <TableHead><User className="inline-block mr-1 h-4 w-4" />Nom & Prénom</TableHead>
                  <TableHead><Phone className="inline-block mr-1 h-4 w-4" />Téléphone</TableHead>
                  <TableHead><CircleDot className="inline-block mr-1 h-4 w-4" />Disponibilité / Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuichetieres.map((g, index) => (
                  <motion.tr 
                    key={g.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-muted/50 dark:hover:bg-muted/20"
                  >
                    <TableCell className="font-medium">{g.matricule}</TableCell>
                    <TableCell>{g.nom} {g.prenom}</TableCell>
                    <TableCell>{g.telephone || 'N/A'}</TableCell>
                    <TableCell>{getDisponibiliteInfo(g)}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="text-center py-10 text-muted-foreground">
              <Users2 className="mx-auto h-12 w-12 mb-4" />
              <p className="text-lg">Aucune guichetière trouvée pour votre agence "{nomAgence}" ou correspondant à votre recherche.</p>
            </div>
          )}
          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salaire">
          <SalaireGuichetiereTab fixedAgence={nomAgence} canWrite={true} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default MesGuichetieresPage;
