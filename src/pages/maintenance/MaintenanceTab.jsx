import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
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

const agences = [
  { id: 1, nom: 'Agence A' },
  { id: 2, nom: 'Agence B' },
];

const terminauxByAgence = {
  1: [ { id: 1, ref: 'T-A1', sousEnsembles: ['IMP-100', 'LECT-100', 'ECR-100'] } ],
  2: [ { id: 2, ref: 'T-B1', sousEnsembles: ['IMP-200', 'LECT-200', 'ECR-200'] } ],
};

const sousEnsembleOptions = ['IMP-100', 'LECT-100', 'ECR-100', 'IMP-200', 'LECT-200', 'ECR-200'];
const codePannes = ['P-01', 'P-02', 'P-03'];
const panneList = ['Carte mère', 'Alimentation', 'Affichage'];
const codeInterventions = ['I-01', 'I-02'];
const pieces = ['Rouleau', 'Composant'];

const MaintenanceTab = ({ technicien }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    agence: '',
    terminal: '',
    sousEnsemble: '',
    typeIntervention: 'curative',
    code: '',
    panne: '',
    piece: '',
    commentaire: '',
    remplace: 'non',
    remplacement: '',
  });
  const [recap, setRecap] = useState(null);

  const terminaux = terminauxByAgence[form.agence] || [];
  const sousEnsembles = terminaux.find(t => String(t.id) === form.terminal)?.sousEnsembles || [];

  const handleChange = (field) => (value) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const finish = () => {
    setRecap({ ...form, technicien });
  };

  if (recap) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Agence : {agences.find(a => String(a.id) === recap.agence)?.nom}</p>
          <p>Terminal : {recap.terminal}</p>
          <p>Sous-ensemble : {recap.sousEnsemble}</p>
          <p>Type : {recap.typeIntervention}</p>
          {recap.typeIntervention === 'curative' ? (
            <>
              <p>Code panne : {recap.code}</p>
              <p>Panne : {recap.panne}</p>
            </>
          ) : (
            <>
              <p>Code intervention : {recap.code}</p>
              <p>Pièce : {recap.piece}</p>
            </>
          )}
          <p>Commentaire : {recap.commentaire}</p>
          {recap.remplace === 'oui' && <p>Remplacé par : {recap.remplacement}</p>}
          <p className="font-medium">Technicien : {technicien?.prenom} {technicien?.nom}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => { setForm({ agence: '', terminal: '', sousEnsemble: '', typeIntervention: 'curative', code: '', panne: '', piece: '', commentaire: '', remplace: 'non', remplacement: '' }); setRecap(null); }}>Terminer</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Fiche de maintenance</CardTitle>
        <CardDescription>Remplissez les informations ci-dessous.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Agence</Label>
              <Select value={form.agence} onValueChange={handleChange('agence')}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {agences.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Terminal</Label>
              <Select value={form.terminal} onValueChange={handleChange('terminal')} disabled={!form.agence}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {terminaux.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.ref}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sous-ensemble</Label>
              <Select value={form.sousEnsemble} onValueChange={handleChange('sousEnsemble')} disabled={!form.terminal}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {sousEnsembles.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type d'intervention</Label>
              <Select value={form.typeIntervention} onValueChange={handleChange('typeIntervention')}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="curative">Curative</SelectItem>
                  <SelectItem value="preventive">Préventive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.typeIntervention === 'curative' ? (
              <>
                <div className="space-y-2">
                  <Label>Code panne</Label>
                  <Select value={form.code} onValueChange={handleChange('code')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {codePannes.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Panne</Label>
                  <Select value={form.panne} onValueChange={handleChange('panne')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {panneList.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Code intervention</Label>
                  <Select value={form.code} onValueChange={handleChange('code')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {codeInterventions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pièce</Label>
                  <Select value={form.piece} onValueChange={handleChange('piece')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {pieces.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Commentaire</Label>
              <Input value={form.commentaire} onChange={(e) => handleChange('commentaire')(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Remplacé</Label>
              <Select value={form.remplace} onValueChange={handleChange('remplace')}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="non">Non</SelectItem>
                  <SelectItem value="oui">Oui</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.remplace === 'oui' && (
              <div className="space-y-2">
                <Label>Sous-ensemble de remplacement</Label>
                <Select value={form.remplacement} onValueChange={handleChange('remplacement')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {sousEnsembleOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Retour</Button>}
        {step === 1 && <Button onClick={() => setStep(2)} disabled={!form.sousEnsemble}>Suivant</Button>}
        {step === 2 && <Button onClick={finish}>Finir intervention</Button>}
      </CardFooter>
    </Card>
  );
};

export default MaintenanceTab;
