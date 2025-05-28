
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Search, User, Phone, CircleDot, Users2, CalendarOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays, parseISO, isValid as isValidDate } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

const MesGuichetieresPage = () => {
  const { nomAgence } = useOutletContext();
  const { toast } = useToast();
  const [guichetieres, setGuichetieres] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchGuichetieresAgence = async () => {
      if (!nomAgence) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from('guichetieres')
        .select('*')
        .eq('agenceAssigne', nomAgence)
        .order('nom', { ascending: true });

      if (error) {
        toast({ title: 'Erreur de chargement', description: "Impossible de charger les guichetières de l'agence.", variant: 'destructive' });
        setGuichetieres([]);
      } else {
        setGuichetieres(data);
      }
      setIsLoading(false);
    };

    fetchGuichetieresAgence();
  }, [nomAgence, toast]);

  const filteredGuichetieres = useMemo(() => {
    return guichetieres.filter(g => 
      (
        g.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.disponibilite && g.disponibilite.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
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
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-3xl font-bold text-primary flex items-center">
                <Users2 className="mr-3 h-8 w-8" /> Mes Guichetières ({nomAgence})
              </CardTitle>
              <CardDescription>
                Liste des guichetières assignées à votre agence.
              </CardDescription>
            </div>
          </div>
          <div className="mt-6 flex flex-col md:flex-row gap-4">
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
    </motion.div>
  );
};

export default MesGuichetieresPage;
