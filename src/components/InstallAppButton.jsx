import React, { useEffect, useState } from 'react';
import { Download, Share, Plus, Check, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const isStandalone = () =>
  (typeof window !== 'undefined') &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true);

const isIOS = () =>
  (typeof navigator !== 'undefined') && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

/**
 * Bouton « Installer l'application » :
 * - Android/Chrome/Edge : capte beforeinstallprompt → invite native d'installation.
 * - iOS Safari (pas d'API) : ouvre des instructions (Partager → Sur l'écran d'accueil).
 * Masqué si l'app est déjà installée (mode standalone).
 *
 * @param {string} [className]
 * @param {boolean} [full]  bouton pleine largeur
 */
const InstallAppButton = ({ className = '', full = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Déjà installée → rien à afficher.
  if (installed) return null;

  const ios = isIOS();
  // On n'affiche le bouton que si l'installation est réellement possible
  // (invite captée) ou sur iOS (instructions manuelles).
  if (!deferredPrompt && !ios) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* ignore */ }
      setDeferredPrompt(null);
    } else {
      setShowHelp(true);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={handleClick}
        variant="outline"
        className={`gap-2 border-primary/30 text-primary hover:bg-primary/5 ${full ? 'w-full' : ''} ${className}`}
      >
        <Download className="h-4 w-4" />
        Installer l'application
      </Button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-t-lg bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Download className="h-5 w-5" /> Installer l'application
            </DialogTitle>
            <DialogDescription>
              Ajoutez Star3000+ à votre écran d'accueil pour un usage comme une vraie application (et hors ligne).
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 py-2 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <span>Touchez l'icône <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Partager</strong> dans la barre de Safari.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <span>Choisissez <Plus className="inline h-4 w-4 align-text-bottom" /> <strong>« Sur l'écran d'accueil »</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <span>Validez avec <Check className="inline h-4 w-4 align-text-bottom" /> <strong>« Ajouter »</strong>.</span>
            </li>
          </ol>
          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
            <WifiOff className="h-4 w-4 shrink-0 text-primary" />
            Une fois installée, l'application s'ouvre en plein écran et fonctionne même avec une connexion limitée.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;
