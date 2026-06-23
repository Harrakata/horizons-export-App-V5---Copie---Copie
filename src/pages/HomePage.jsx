
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck, Users, BarChart3, Settings, LogIn, Wallet } from 'lucide-react';
import InstallAppButton from '@/components/InstallAppButton';
import { useClient } from '@/hooks/useFeatureFlags';
import {
  APP_SPACE_SETTINGS_KEY,
  buildDefaultAppSpaceFunctionalities,
  isAppSpaceFunctionalityEnabled,
  normalizeAppSpaceFunctionalities,
} from '@/lib/exploitationProfiles';

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="relative overflow-hidden rounded-xl border border-primary/20 bg-background shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur hover:shadow-[0_30px_70px_-20px_rgba(15,23,42,0.38)] transition-shadow duration-300 p-4 sm:p-6"
  >
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
    <div className="relative">
      <div className="flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 mb-3 sm:mb-4 rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)] text-primary">
        {React.cloneElement(icon, { size: 22 })}
      </div>
      <h3 className="mb-1.5 sm:mb-2 text-base sm:text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
    </div>
  </motion.div>
);

const HomePage = () => {
  const client = useClient();
  const [spaceFunctionalities, setSpaceFunctionalities] = React.useState(() => {
    try {
      return normalizeAppSpaceFunctionalities(
        JSON.parse(window.localStorage.getItem(APP_SPACE_SETTINGS_KEY) || '{}')
      );
    } catch {
      return buildDefaultAppSpaceFunctionalities();
    }
  });

  React.useEffect(() => {
    const handleFunctionalitiesUpdated = (event) => {
      setSpaceFunctionalities(normalizeAppSpaceFunctionalities(event.detail));
    };
    window.addEventListener('app-functionalities-updated', handleFunctionalitiesUpdated);
    return () => window.removeEventListener('app-functionalities-updated', handleFunctionalitiesUpdated);
  }, []);

  const isPointageEnabled = isAppSpaceFunctionalityEnabled(spaceFunctionalities, 'pointage');
  const isPaiementGrosGainEnabled = isAppSpaceFunctionalityEnabled(spaceFunctionalities, 'paiement-gros-gain');

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-background to-secondary/30 dark:from-background dark:to-secondary/10">

      <motion.header
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "backOut" }}
        className="mb-6 md:mb-14 w-full max-w-3xl"
      >
        <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardContent className="relative flex flex-col items-center text-center py-6 px-4 sm:py-8 sm:px-6 md:py-10 md:px-12">
            <img
              src={client.logoUrl || "/carrus-logo.png"}
              alt={client.displayName || "CARRUS Betting Solutions & Services"}
              className="mx-auto mb-3 h-16 sm:mb-5 sm:h-24 md:h-44 w-auto object-contain drop-shadow-md"
            />
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold mb-2 sm:mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">
                GestionPDV
              </span>
            </h1>
            {client.displayName && client.displayName !== 'PMU' && (
              <p className="text-sm sm:text-lg md:text-xl font-bold text-primary mb-1">
                {client.displayName}
              </p>
            )}
            <p className="text-base sm:text-2xl md:text-3xl font-semibold text-foreground mb-1 sm:mb-2">
              Gestion de Planning & Pointage
            </p>
            <p className="text-xs sm:text-base md:text-lg text-muted-foreground max-w-2xl">
              Optimisez la gestion de vos agences avec une solution moderne, intuitive et performante.
            </p>
            {(isPointageEnabled || isPaiementGrosGainEnabled) && (
              <div className="mt-4 sm:mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                {isPointageEnabled && (
                  <Button asChild size="lg" className="text-sm sm:text-lg px-6 py-4 sm:px-10 sm:py-7 rounded-full shadow-lg bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-primary-foreground transition-transform hover:scale-105">
                    <Link to="/pointage">
                      <LogIn className="mr-3 h-5 w-5" /> Commencer vos Pointages
                    </Link>
                  </Button>
                )}
                {isPaiementGrosGainEnabled && (
                  <Button asChild size="lg" className="text-sm sm:text-lg px-6 py-4 sm:px-10 sm:py-7 rounded-full shadow-lg bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-primary-foreground transition-transform hover:scale-105">
                    <Link to="/paiement-gros-gain">
                      <Wallet className="mr-3 h-5 w-5" /> Demande de Paiement
                    </Link>
                  </Button>
                )}
              </div>
            )}
            {/* Installation PWA (s'affiche seulement si installable et pas déjà installée) */}
            <div className="mt-4 flex justify-center">
              <InstallAppButton />
            </div>
          </CardContent>
        </Card>
      </motion.header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl w-full">
        <FeatureCard
          icon={<CalendarCheck />}
          title="Planning Intuitif"
          description="Créez et gérez les plannings de vos guichetières avec facilité."
          delay={0.5}
        />
        <FeatureCard
          icon={<Users />}
          title="Gestion des Employés"
          description="Centralisez les informations de vos chefs d'agence et guichetières."
          delay={0.6}
        />
        <FeatureCard
          icon={<BarChart3 />}
          title="Statistiques Détaillées"
          description="Suivez les performances et la ponctualité grâce à des rapports clairs."
          delay={0.7}
        />
        <FeatureCard
          icon={<Settings />}
          title="Paramétrage Flexible"
          description="Adaptez les règles de pointage selon les besoins de votre organisation."
          delay={0.8}
        />
        <FeatureCard
          icon={<LogIn />}
          title="Accès Sécurisés"
          description="Espaces dédiés et protégés pour l'exploitation et les chefs d'agence."
          delay={0.9}
        />
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="mt-14 text-center text-muted-foreground"
      >
        <p>&copy; {new Date().getFullYear()} GestionPDV by PMC. Tous droits réservés.</p>
      </motion.footer>
    </div>
  );
};

export default HomePage;
