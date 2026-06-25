import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Save, Loader2, UploadCloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { CLIENT_ID, STORAGE_BUCKET } from '@/lib/clientConfig';
import { supabase } from '@/lib/supabaseClient';

// ════════════════════════════════════════════════════════════════════════════
//  Carte « Identité client » (multi-tenant)
//  Affiche l'identifiant technique du client (figé par le déploiement) et permet
//  d'éditer le branding (nom affiché + logo), stocké en base par-client.
// ════════════════════════════════════════════════════════════════════════════
const ClientIdentityCard = ({ canWrite = true }) => {
  const { toast } = useToast();
  const { client, setBranding } = useFeatureFlags();
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Synchronise les champs quand le branding est chargé/mis à jour.
  useEffect(() => {
    setDisplayName(client.displayName || '');
    setLogoUrl(client.logoUrl || '');
  }, [client.displayName, client.logoUrl]);

  // Import d'un logo local : upload vers le stockage puis renseigne l'URL publique.
  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Format invalide', description: 'Choisissez une image (PNG, JPG, SVG…).', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const ext = (file.name?.split('.').pop() || 'png').toLowerCase();
      const fileName = `branding/${CLIENT_ID}_logo_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (error) {
        toast({ title: "Erreur d'import", description: error.message, variant: 'destructive' });
      } else {
        const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
        setLogoUrl(pub.publicUrl);
        toast({ title: 'Logo importé', description: "Cliquez sur « Sauvegarder l'identité » pour l'appliquer.", className: 'bg-green-500 text-white' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: "Échec de l'import du logo.", variant: 'destructive' });
    }
    setIsUploading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setBranding({ displayName, logoUrl });
      toast({ title: 'Identité client sauvegardée', className: 'bg-green-500 text-white' });
    } catch (error) {
      toast({ title: 'Erreur de sauvegarde', description: error.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  return (
    <Card className="shadow-xl glassmorphism">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2 text-2xl text-primary">
            <Building2 className="h-6 w-6" /> Identité client
          </CardTitle>
          <CardDescription>
            Branding propre à ce client (chaque client dispose de son propre déploiement et de sa propre base).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Identifiant technique — figé par le déploiement (variable d'env) */}
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-sm text-muted-foreground">Identifiant client (déploiement) :</Label>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 font-mono text-primary">
            {CLIENT_ID}
          </Badge>
          <span className="text-xs text-muted-foreground">défini par VITE_CLIENT_ID — non modifiable ici</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client-display-name">Nom affiché</Label>
            <Input
              id="client-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex. PMU Mali"
              disabled={!canWrite || isSaving}
            />
            <p className="text-xs text-muted-foreground">Nom du client affiché dans l'interface.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-logo-url">Logo</Label>
            <Input
              id="client-logo-url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              disabled={!canWrite || isSaving || isUploading}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="client-logo-file"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={!canWrite || isSaving || isUploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('client-logo-file')?.click()}
                disabled={!canWrite || isSaving || isUploading}
              >
                {isUploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
                Importer un logo
              </Button>
              <p className="text-xs text-muted-foreground">…ou collez un lien direct (PNG/SVG).</p>
            </div>
          </div>
        </div>

        {logoUrl ? (
          <div className="flex items-center gap-3 rounded-xl border bg-background/70 p-3">
            <span className="text-xs font-medium text-muted-foreground">Aperçu :</span>
            <img
              src={logoUrl}
              alt="Aperçu du logo"
              className="h-10 max-w-[160px] object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        ) : null}

        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} disabled={!canWrite || isSaving || isUploading} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder l'identité
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientIdentityCard;
