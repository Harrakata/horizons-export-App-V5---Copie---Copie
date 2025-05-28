
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck, Users, BarChart3, Settings, LogIn } from 'lucide-react';

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="bg-card p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 glassmorphism"
  >
    <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-primary/10 text-primary">
      {React.cloneElement(icon, { size: 32 })}
    </div>
    <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </motion.div>
);

const HomePage = () => {
  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-background to-secondary/30 dark:from-background dark:to-secondary/10">
      <motion.header
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "backOut" }}
        className="text-center mb-12 md:mb-16"
      >
        <img   class="w-32 h-32 mx-auto mb-6 rounded-full shadow-lg border-4 border-primary" alt="Logo PMU Mali" src="https://pzmapmxjkkqhuiamdvjd.supabase.co/storage/v1/object/public/pmu-mali-storage//326291198_1368954473860231_6856823940381691525_n.jpg" />
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">
            PMU Mali
          </span>
        </h1>
        <p className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          Gestion de Planning & Pointage
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Optimisez la gestion de vos agences avec une solution moderne, intuitive et performante.
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-12"
      >
        <Button asChild size="lg" className="text-xl px-10 py-8 rounded-full shadow-lg bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-primary-foreground transition-transform hover:scale-105">
          <Link to="/pointage">
            <LogIn className="mr-3 h-6 w-6" /> Commencer vos Pointages
          </Link>
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl w-full">
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
        className="mt-16 text-center text-muted-foreground"
      >
        <p>&copy; {new Date().getFullYear()} PMU Mali. Tous droits réservés.</p>
      </motion.footer>
    </div>
  );
};

export default HomePage;
