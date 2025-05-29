import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ConfigurationTab = ({ agences, terminals, setTerminals }) => {
  const [selectedAgence, setSelectedAgence] = useState('');
  const [form, setForm] = useState({ ref: '', position: '', type: '2020' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const addTerminal = () => {
    if (!selectedAgence || !form.ref || !form.position) return;
    setTerminals((prev) => {
      const list = prev[selectedAgence] || [];
      return { ...prev, [selectedAgence]: [...list, { ...form }] };
    });
    setForm({ ref: '', position: '', type: '2020' });
  };

  const currentList = terminals[selectedAgence] || [];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Configuration des terminaux</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Agence</Label>
            <Select value={selectedAgence} onValueChange={setSelectedAgence}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une agence" />
              </SelectTrigger>
              <SelectContent>
                {agences.map((ag) => (
                  <SelectItem key={ag.id} value={String(ag.id)}>
                    {ag.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Référence</Label>
            <Input name="ref" value={form.ref} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label>Position</Label>
            <Input name="position" value={form.position} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(val) => setForm((f) => ({ ...f, type: val }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2020">2020</SelectItem>
                <SelectItem value="2032">2032</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={addTerminal} className="bg-gradient-to-r from-primary to-green-600 text-white">
          Ajouter le terminal
        </Button>
        {currentList.length > 0 && (
          <div className="mt-4">
            <h3 className="font-bold mb-2">Terminaux de l'agence sélectionnée</h3>
            <ul className="list-disc pl-4 space-y-1">
              {currentList.map((t, idx) => (
                <li key={idx}>{`${t.ref} - ${t.position} (${t.type})`}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConfigurationTab;
