import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { UserCog, Loader2, Camera, UploadCloud, X, Mail, Phone, KeyRound, ShieldCheck, Eye, EyeOff, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { STORAGE_BUCKET } from '@/lib/clientConfig';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Fenêtre unifiée « Mon profil » : édition des informations personnelles
 * (onglet Profil) et changement de mot de passe (onglet Sécurité).
 *
 * @param {boolean}  open
 * @param {Function} onOpenChange
 * @param {string}   table            ex. 'chefs_agence' (requis si allowProfileEdit)
 * @param {string|number} recordId
 * @param {object}   initialData      { nom, prenom, telephone, email }
 * @param {boolean}  withPhoto
 * @param {string}   photoPrefix
 * @param {string}   currentPhotoUrl
 * @param {Function} onSaved          (updatedFields) => void
 * @param {boolean}  allowProfileEdit défaut true ; false = onglet Sécurité seul (super-admin sans profil)
 */
const EditProfileDialog = ({
  open,
  onOpenChange,
  table,
  recordId,
  initialData = {},
  withPhoto = false,
  photoPrefix = 'photos_profils',
  currentPhotoUrl = null,
  onSaved,
  allowProfileEdit = true,
}) => {
  const { toast } = useToast();

  // ── Onglet Profil ──
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '' });
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // ── Capture caméra ──
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ── Onglet Sécurité ──
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nom: initialData.nom || '',
        prenom: initialData.prenom || '',
        telephone: initialData.telephone || '',
      });
      setPhotoUrl(currentPhotoUrl || null);
      setPhotoFile(null);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setIsSavingProfile(false);
      setIsSavingPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const displayName = useMemo(
    () => `${form.prenom} ${form.nom}`.trim() || initialData.email || 'Mon compte',
    [form.prenom, form.nom, initialData.email]
  );
  const initials = useMemo(
    () => (`${form.prenom?.[0] || ''}${form.nom?.[0] || ''}`.toUpperCase() || (initialData.email?.[0] || 'U').toUpperCase()),
    [form.prenom, form.nom, initialData.email]
  );

  const busy = isSavingProfile || isSavingPassword;

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = null;
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoUrl(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Caméra : ouvrir / fermer / capturer ──
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: 'Caméra indisponible', description: "Votre appareil ou navigateur ne permet pas l'accès à la caméra.", variant: 'destructive' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      toast({ title: 'Accès caméra refusé', description: "Autorisez l'accès à la caméra pour prendre une photo.", variant: 'destructive' });
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const size = Math.min(w, h); // recadrage carré centré
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, (w - size) / 2, (h - size) / 2, size, size, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPhotoFile(file);
      setPhotoUrl(canvas.toDataURL('image/jpeg', 0.9));
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  // Branche le flux sur la balise vidéo une fois affichée ; coupe la caméra à la fermeture/démontage.
  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen]);

  useEffect(() => {
    if (!open) stopCamera();
    return () => stopCamera();
  }, [open, stopCamera]);

  const uploadPhoto = async (file) => {
    if (!file) return null;
    const ext = (file.name?.split('.').pop() || 'png').toLowerCase();
    const fileName = `${photoPrefix}/${String(recordId)}_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (error) {
      toast({ title: "Erreur d'upload photo", description: error.message, variant: 'destructive' });
      return undefined;
    }
    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!recordId) {
      toast({ title: 'Profil introuvable', description: 'Impossible d’identifier votre profil.', variant: 'destructive' });
      return;
    }
    if (!form.nom.trim() || !form.prenom.trim()) {
      toast({ title: 'Champs requis', description: 'Le nom et le prénom sont obligatoires.', variant: 'destructive' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim() || null,
      };
      if (withPhoto) {
        if (photoFile) {
          const uploaded = await uploadPhoto(photoFile);
          if (uploaded !== undefined) payload.photo_url = uploaded;
        } else {
          payload.photo_url = photoUrl || null;
        }
      }

      const { error } = await supabase.from(table).update(payload).eq('id', recordId);
      if (error) {
        toast({ title: 'Échec de la mise à jour', description: error.message, variant: 'destructive' });
        setIsSavingProfile(false);
        return;
      }

      toast({ title: 'Profil mis à jour', description: 'Vos informations ont été enregistrées.', className: 'bg-green-500 text-white' });
      onSaved?.(payload);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite.", variant: 'destructive' });
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({ title: 'Mot de passe trop court', description: `Au moins ${MIN_PASSWORD_LENGTH} caractères.`, variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Confirmation incorrecte', description: 'Les deux mots de passe ne correspondent pas.', variant: 'destructive' });
      return;
    }

    setIsSavingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        toast({ title: 'Session requise', description: "Disponible uniquement pour les comptes connectés via authentification sécurisée.", variant: 'destructive' });
        setIsSavingPassword(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: 'Échec du changement', description: error.message, variant: 'destructive' });
        setIsSavingPassword(false);
        return;
      }
      toast({ title: 'Mot de passe mis à jour', description: 'Votre mot de passe a été modifié.', className: 'bg-green-500 text-white' });
      setNewPassword('');
      setConfirmPassword('');
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite.", variant: 'destructive' });
      setIsSavingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-lg">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-t-lg bg-gradient-to-r from-primary via-primary/80 to-primary/35" />

        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {withPhoto && photoUrl ? (
                <img src={photoUrl} alt="" className="h-14 w-14 rounded-full border-2 border-primary object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-white text-lg font-black text-primary ring-1 ring-primary/20">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-primary">{displayName}</DialogTitle>
              <DialogDescription className="truncate">{initialData.email || 'Gérez votre compte'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue={allowProfileEdit ? 'profil' : 'securite'} className="mt-1">
          <TabsList className={`grid w-full ${allowProfileEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {allowProfileEdit && (
              <TabsTrigger value="profil" className="gap-1.5"><User className="h-4 w-4" /> Profil</TabsTrigger>
            )}
            <TabsTrigger value="securite" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Sécurité</TabsTrigger>
          </TabsList>

          {/* ── Onglet Profil ── */}
          {allowProfileEdit && (
            <TabsContent value="profil" className="mt-4">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                {withPhoto && (
                  <div className="flex flex-col items-center gap-2">
                    {isCameraOpen ? (
                      <>
                        <div className="overflow-hidden rounded-2xl border-2 border-primary/40 bg-black shadow-inner">
                          <video ref={videoRef} autoPlay playsInline muted className="h-48 w-48 object-cover" />
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button type="button" size="sm" onClick={capturePhoto} disabled={busy}>
                            <Camera className="mr-1.5 h-4 w-4" /> Capturer
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={stopCamera} disabled={busy}>
                            <X className="mr-1.5 h-4 w-4" /> Annuler
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {photoUrl ? (
                          <div className="relative">
                            <img src={photoUrl} alt="Photo de profil" className="h-24 w-24 rounded-full border-2 border-primary object-cover" />
                            <button
                              type="button"
                              onClick={() => { setPhotoFile(null); setPhotoUrl(null); }}
                              className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                              disabled={busy}
                              aria-label="Retirer la photo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-primary/30 bg-primary/5 text-primary">
                            <Camera className="h-8 w-8 opacity-50" />
                          </div>
                        )}
                        <Input id="edit-profile-photo" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={busy} />
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('edit-profile-photo')?.click()} disabled={busy}>
                            <UploadCloud className="mr-1.5 h-4 w-4" />
                            {photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={busy}>
                            <Camera className="mr-1.5 h-4 w-4" /> Prendre une photo
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-nom">Nom</Label>
                    <Input id="edit-nom" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} disabled={busy} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-prenom">Prénom</Label>
                    <Input id="edit-prenom" value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} disabled={busy} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-tel" className="flex items-center gap-2"><Phone className="h-4 w-4" /> Téléphone</Label>
                    <Input id="edit-tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} disabled={busy} placeholder="Téléphone" />
                  </div>
                  {initialData.email !== undefined && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
                      <Input value={initialData.email || ''} disabled readOnly className="bg-muted/50" />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
                  <Button type="submit" disabled={busy}>
                    {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}
                    Enregistrer
                  </Button>
                </div>
              </form>
            </TabsContent>
          )}

          {/* ── Onglet Sécurité ── */}
          <TabsContent value="securite" className="mt-4">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-new-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="edit-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={busy}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="edit-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">Le mot de passe doit contenir au moins {MIN_PASSWORD_LENGTH} caractères.</p>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
                <Button type="submit" disabled={busy}>
                  {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Mettre à jour le mot de passe
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;
