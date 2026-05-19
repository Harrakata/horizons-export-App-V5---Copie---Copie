
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck, Users, BarChart3, Settings, LogIn } from 'lucide-react';

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="relative overflow-hidden rounded-xl border border-primary/20 bg-background shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur hover:shadow-[0_30px_70px_-20px_rgba(15,23,42,0.38)] transition-shadow duration-300 p-6"
  >
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
    <div className="relative">
      <div className="flex items-center justify-center w-14 h-14 mb-4 rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)] text-primary">
        {React.cloneElement(icon, { size: 26 })}
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </motion.div>
);

const HomePage = () => {
  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-background to-secondary/30 dark:from-background dark:to-secondary/10">

      <motion.header
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "backOut" }}
        className="mb-10 md:mb-14 w-full max-w-3xl"
      >
        <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardContent className="relative flex flex-col items-center text-center py-10 px-6 md:px-12">
            <img
              src="/carrus-logo.png"
              alt="CARRUS Betting Solutions & Services"
              className="mx-auto mb-6 h-32 md:h-44 w-auto object-contain drop-shadow-md"
            />
            <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">
                Star3000+
              </span>
            </h1>
            <p className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
              Gestion de Planning & Pointage
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Optimisez la gestion de vos agences avec une solution moderne, intuitive et performante.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="text-lg px-10 py-7 rounded-full shadow-lg bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-primary-foreground transition-transform hover:scale-105">
                <Link to="/pointage">
                  <LogIn className="mr-3 h-5 w-5" /> Commencer vos Pointages
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
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
        <p>&copy; {new Date().getFullYear()} Star3000+ by PMC. Tous droits réservés.</p>
      </motion.footer>
    </div>
  );
};

export default HomePage;
