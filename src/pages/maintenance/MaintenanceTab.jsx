import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const MaintenanceTab = ({ agences, terminals }) => {
  const [selectedAgence, setSelectedAgence] = useState('');
  const [selectedTerminal, setSelectedTerminal] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const terminalsOfAgence = terminals[selectedAgence] || [];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Fiche de maintenance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Agence</Label>
            <Select value={selectedAgence} onValueChange={(v) => { setSelectedAgence(v); setSelectedTerminal(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une agence" />
              </SelectTrigger>
              <SelectContent>
                {agences.map((ag) => (
                  <SelectItem key={ag.id} value={String(ag.id)}>{ag.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Terminal</Label>
            <Select value={selectedTerminal} onValueChange={setSelectedTerminal} disabled={!selectedAgence}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {terminalsOfAgence.map((t, idx) => (
                  <SelectItem key={idx} value={String(idx)}>{t.ref}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Commentaire</Label>
            <Input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>
        </div>
        <Button className="bg-gradient-to-r from-primary to-green-600 text-white" disabled={!selectedTerminal}>
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
};

export default MaintenanceTab;
