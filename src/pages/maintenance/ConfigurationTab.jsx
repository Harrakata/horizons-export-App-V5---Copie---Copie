import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

const defaultAgences = [
  { id: 1, nom: 'Agence A', nbreTerminaux: 2 },
  { id: 2, nom: 'Agence B', nbreTerminaux: 2 },
];

const ipPool = ['192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.13'];
const imprimantes = ['IMP-100', 'IMP-200', 'IMP-300'];
const lecteurs = ['LECT-100', 'LECT-200', 'LECT-300'];
const ecrans = ['ECR-100', 'ECR-200', 'ECR-300'];

const ConfigurationTab = () => {
  const [agenceId, setAgenceId] = useState('');
  const [terminaux, setTerminaux] = useState({}); // { agenceId: [terminal] }
  const [formData, setFormData] = useState({
    ref: '',
    type: '2020',
    position: '',
    ip: '',
    imprimante: '',
    lecteur: '',
    ecran: '',
  });

  const handleAddTerminal = () => {
    if (!agenceId) return;
    const data = { ...formData, id: Date.now() };
    setTerminaux((prev) => ({
      ...prev,
      [agenceId]: prev[agenceId] ? [...prev[agenceId], data] : [data],
    }));
    setFormData({ ref: '', type: '2020', position: '', ip: '', imprimante: '', lecteur: '', ecran: '' });
  };

  const selectedTerminaux = terminaux[agenceId] || [];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Configuration des terminaux</CardTitle>
        <CardDescription>Sélectionnez une agence et configurez ses terminaux.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Agence</Label>
            <Select value={agenceId} onValueChange={(v) => setAgenceId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une agence" />
              </SelectTrigger>
              <SelectContent>
                {defaultAgences.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type de terminal</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2020">2020</SelectItem>
                <SelectItem value="2032">2032</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Référence</Label>
            <Input value={formData.ref} onChange={(e) => setFormData((p) => ({ ...p, ref: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Position</Label>
            <Input value={formData.position} onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>IP</Label>
            <Select value={formData.ip} onValueChange={(v) => setFormData((p) => ({ ...p, ip: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {ipPool.map((ip) => (
                  <SelectItem key={ip} value={ip}>{ip}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Imprimante</Label>
            <Select value={formData.imprimante} onValueChange={(v) => setFormData((p) => ({ ...p, imprimante: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {imprimantes.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lecteur</Label>
            <Select value={formData.lecteur} onValueChange={(v) => setFormData((p) => ({ ...p, lecteur: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {lecteurs.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Écran</Label>
            <Select value={formData.ecran} onValueChange={(v) => setFormData((p) => ({ ...p, ecran: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {ecrans.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAddTerminal} disabled={!agenceId || !formData.ref}>Ajouter le terminal</Button>
        {selectedTerminaux.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium mb-2">Terminaux configurés</h4>
            <ul className="space-y-1 list-disc list-inside text-sm">
              {selectedTerminaux.map((t) => (
                <li key={t.id}>{t.ref} - {t.type} - {t.position}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConfigurationTab;
