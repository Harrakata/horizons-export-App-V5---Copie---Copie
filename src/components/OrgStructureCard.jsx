import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Network, Globe, Building2, User, Loader2, Check, X, Link2, Unlink,
  UserCog, Briefcase, Wrench, ShieldCheck, Layers, Pencil,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { isSecteurEnabled, isGuichetiereAgenceRequired } from '@/lib/orgStructureConfig';
import { APP_SPACE_FUNCTIONALITIES, EXPLOITATION_MENU_PERMISSIONS } from '@/lib/exploitationProfiles';

// ════════════════════════════════════════════════════════════════════════════
//  Carte « Structure organisationnelle » (multi-tenant) — organigramme interactif
//  Représente la hiérarchie Région → Secteur → Agence → Guichetière sous forme de
//  croquis. Chaque nœud regroupe, pour son niveau :
//   - la MODULARITÉ de structure (secteur actif/inactif, rattachement agence
//     obligatoire/optionnel) — app_settings/org_structure ;
//   - l'ESPACE applicatif du rôle (Directeur régional, Chef de secteur, Chef
//     d'agence, Guichetière) — système `functionalites_espaces` ;
//   - les ONGLETS de création & gestion (Régions, Secteurs, Agences…) de l'Espace
//     Exploitation — système `functionalites_espaces_onglets`.
//  Espaces et onglets sont pilotés par la page parente (props onToggleSpace /
//  onToggleExploitationTab) afin de réutiliser sa persistance et ses toasts.
// ════════════════════════════════════════════════════════════════════════════

const spaceLabel = (key) => APP_SPACE_FUNCTIONALITIES.find((f) => f.key === key)?.label || key;
const tabLabel = (key) => EXPLOITATION_MENU_PERMISSIONS.find((t) => t.path === key)?.label || key;

const SPACE_ICONS = {
  'espace-directeur-regional': <Globe className="h-3.5 w-3.5" />,
  'espace-directeur-general': <ShieldCheck className="h-3.5 w-3.5" />,
  'espace-chef-secteur': <UserCog className="h-3.5 w-3.5" />,
  'espace-chef-agence': <Briefcase className="h-3.5 w-3.5" />,
  'espace-guichetiere': <User className="h-3.5 w-3.5" />,
  'espace-technicien': <Wrench className="h-3.5 w-3.5" />,
};

// ── Interrupteur (switch) ────────────────────────────────────────────────────
const MiniSwitch = ({ checked, onClick, disabled, busy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onClick}
    className={[
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
      checked ? 'bg-primary' : 'bg-slate-300',
      disabled ? 'cursor-not-allowed opacity-60' : '',
    ].join(' ')}
  >
    <span
      className={[
        'inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      ].join(' ')}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : null}
    </span>
  </button>
);

// ── Puce « Espace applicatif » ───────────────────────────────────────────────
const SpaceChip = ({ spaceKey, enabled, onToggle, disabled, busy, hint }) => (
  <div
    className={[
      'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors',
      disabled
        ? 'border-slate-200 bg-slate-50/60 opacity-70'
        : enabled
          ? 'border-primary/20 bg-primary/[0.04]'
          : 'border-slate-200 bg-background/60',
    ].join(' ')}
  >
    <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
      <span
        className={[
          'flex h-6 w-6 items-center justify-center rounded-lg',
          enabled && !disabled ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500',
        ].join(' ')}
      >
        {SPACE_ICONS[spaceKey]}
      </span>
      <span className="flex flex-col leading-tight">
        {spaceLabel(spaceKey)}
        {hint ? <span className="text-[10px] font-normal text-muted-foreground">{hint}</span> : null}
      </span>
    </span>
    <MiniSwitch checked={enabled} onClick={onToggle} disabled={disabled} busy={busy} />
  </div>
);

// ── Puce « Onglet de création & gestion » (compacte) ─────────────────────────
const ManageTabChip = ({ tabKey, label, enabled, onToggle, disabled, busy }) => (
  <div
    className={[
      'inline-flex items-center gap-2 rounded-lg border px-2 py-1 transition-colors',
      disabled
        ? 'border-slate-200 bg-slate-50/60 opacity-70'
        : enabled
          ? 'border-primary/20 bg-primary/[0.04]'
          : 'border-slate-200 bg-background/60',
    ].join(' ')}
  >
    <span className="text-[11px] font-medium text-slate-700">{label || tabLabel(tabKey)}</span>
    <MiniSwitch checked={enabled} onClick={onToggle} disabled={disabled} busy={busy} />
  </div>
);

// ── Contrôle segmenté (pilule) pour la structure ────────────────────────────
const SegmentedToggle = ({ value, options, onChange, disabled, busy }) => (
  <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/80 p-0.5 shadow-sm">
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={String(opt.value)}
          type="button"
          disabled={disabled || busy}
          onClick={() => !active && onChange(opt.value)}
          className={[
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
            active ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
            disabled || busy ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          {busy && active ? <Loader2 className="h-3 w-3 animate-spin" /> : opt.icon}
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ── Nœud de l'organigramme ──────────────────────────────────────────────────
const Node = ({ icon, title, subtitle, badge, disabled = false, accent = false, children }) => (
  <div
    className={[
      'relative w-full max-w-md rounded-2xl border p-4 shadow-sm transition-all duration-300',
      disabled
        ? 'border-dashed border-slate-300 bg-slate-50/70 opacity-80'
        : accent
          ? 'border-primary/30 bg-primary/[0.04]'
          : 'border-primary/20 bg-primary/[0.04]',
    ].join(' ')}
  >
    <div className="flex items-start gap-3">
      <div
        className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
          disabled ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary',
        ].join(' ')}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={['font-semibold', disabled ? 'text-slate-500' : 'text-slate-900'].join(' ')}>{title}</p>
          {badge}
        </div>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
    {children ? <div className="mt-3 space-y-2">{children}</div> : null}
  </div>
);

// ── Connecteur vertical entre deux nœuds ────────────────────────────────────
const Connector = ({ dashed = false, muted = false, label }) => (
  <div className="relative flex h-12 w-full items-center justify-center">
    <div
      className={[
        'absolute inset-y-0 border-l-2',
        dashed ? 'border-dashed' : '',
        muted ? 'border-slate-300' : 'border-primary/40',
      ].join(' ')}
    />
    {label ? (
      <span className="relative z-10 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
        {label}
      </span>
    ) : null}
  </div>
);

const ALWAYS_ACTIVE_BADGE = (
  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
    Toujours actif
  </Badge>
);

const OrgStructureCard = ({
  canWrite = true,
  spaceFunctionalities = {},
  spaceTabFunctionalities = {},
  onToggleSpace,
  onToggleExploitationTab,
  isSpaceSettingsLoading = false,
  isSpaceTabSettingsLoading = false,
}) => {
  const { toast } = useToast();
  const { org, setOrgStructure } = useFeatureFlags();
  // pending = clé en cours d'enregistrement (structure / espace / onglet).
  const [pending, setPending] = useState(null);

  const secteurEnabled = isSecteurEnabled(org);
  const agenceRequired = isGuichetiereAgenceRequired(org);

  const spaceEnabled = (key) => spaceFunctionalities?.[key] !== false;
  const tabEnabled = (key) => spaceTabFunctionalities?.['espace-exploitation']?.[key] !== false;

  const applyStructure = async (key, partial) => {
    if (!canWrite) return;
    setPending(key);
    try {
      await setOrgStructure(partial);
      toast({ title: 'Structure mise à jour', className: 'bg-green-500 text-white' });
    } catch (error) {
      toast({ title: 'Erreur de sauvegarde', description: error.message, variant: 'destructive' });
    }
    setPending(null);
  };

  const toggleSpace = async (key) => {
    if (!canWrite || typeof onToggleSpace !== 'function') return;
    setPending(`space:${key}`);
    try {
      await onToggleSpace(key, !spaceEnabled(key));
    } finally {
      setPending(null);
    }
  };

  const toggleTab = async (key) => {
    if (!canWrite || typeof onToggleExploitationTab !== 'function') return;
    setPending(`tab:${key}`);
    try {
      await onToggleExploitationTab(key, !tabEnabled(key));
    } finally {
      setPending(null);
    }
  };

  const spaceBusy = (key) => pending === `space:${key}` || isSpaceSettingsLoading;
  const tabBusy = (key) => pending === `tab:${key}` || isSpaceTabSettingsLoading;

  // Bloc « Création & gestion » : liste d'onglets d'exploitation rattachés au niveau.
  // Chaque item peut être une clé d'onglet (string) ou { key, label } pour un libellé dédié.
  const renderManage = (items, { disabled = false } = {}) => (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Pencil className="h-3 w-3" /> Création &amp; gestion
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const key = typeof item === 'string' ? item : item.key;
          const label = typeof item === 'string' ? undefined : item.label;
          return (
            <ManageTabChip
              key={label || key}
              tabKey={key}
              label={label}
              enabled={!disabled && tabEnabled(key)}
              onToggle={() => toggleTab(key)}
              disabled={!canWrite || disabled}
              busy={tabBusy(key)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className="shadow-xl glassmorphism">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl text-primary">
          <Network className="h-6 w-6" /> Structure organisationnelle
        </CardTitle>
        <CardDescription>
          Croquis de la hiérarchie de ce client. Chaque niveau regroupe son réglage de structure, son espace applicatif et ses onglets de création &amp; gestion — les modifications s'appliquent à tous les utilisateurs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Niveau national & espaces transverses — au-dessus de la hiérarchie régionale */}
        <div className="mx-auto mb-0 max-w-md space-y-4 rounded-2xl border border-dashed border-primary/20 bg-background/60 p-4">
          {/* Direction Générale — niveau national (au-dessus des régions) */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Direction Générale (national)
            </p>
            <SpaceChip
              spaceKey="espace-directeur-general"
              enabled={spaceEnabled('espace-directeur-general')}
              onToggle={() => toggleSpace('espace-directeur-general')}
              disabled={!canWrite}
              busy={spaceBusy('espace-directeur-general')}
            />
            {renderManage(['direction-generale'])}
          </div>

          {/* Maintenance */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" /> Maintenance
            </p>
            <SpaceChip
              spaceKey="espace-technicien"
              enabled={spaceEnabled('espace-technicien')}
              onToggle={() => toggleSpace('espace-technicien')}
              disabled={!canWrite}
              busy={spaceBusy('espace-technicien')}
            />
            {renderManage(['techniciens'])}
          </div>

          {/* Administration */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Administration
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.03] px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                Espace Exploitation
              </span>
              {ALWAYS_ACTIVE_BADGE}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-primary/20 bg-background/60 p-4 sm:p-6">
          {/* Lien niveau national → Région */}
          <Connector label="Niveau régional" />

          {/* Région — racine de la hiérarchie régionale */}
          <Node
            icon={<Globe className="h-5 w-5" />}
            title="Région"
            subtitle="Niveau racine de l'organisation."
            accent
            badge={ALWAYS_ACTIVE_BADGE}
          >
            <SpaceChip
              spaceKey="espace-directeur-regional"
              enabled={spaceEnabled('espace-directeur-regional')}
              onToggle={() => toggleSpace('espace-directeur-regional')}
              disabled={!canWrite}
              busy={spaceBusy('espace-directeur-regional')}
            />
            {renderManage(['regions', 'validation-paiement-gain'])}
          </Node>

          {/* Lien Région → Secteur (ou contournement si secteur off) */}
          <Connector
            dashed={!secteurEnabled}
            muted={!secteurEnabled}
            label={!secteurEnabled ? 'Niveau secteur contourné' : null}
          />

          {/* Secteur — modulable */}
          <Node
            icon={<Network className="h-5 w-5" />}
            title="Secteur"
            subtitle="Niveau intermédiaire entre la région et les agences."
            disabled={!secteurEnabled}
            badge={
              <Badge
                variant="outline"
                className={
                  secteurEnabled
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-slate-200 bg-slate-100 text-slate-600'
                }
              >
                {secteurEnabled ? 'Actif' : 'Inactif'}
              </Badge>
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Niveau&nbsp;:</span>
              <SegmentedToggle
                value={secteurEnabled}
                onChange={(v) => applyStructure('secteur', { secteur: { enabled: v } })}
                disabled={!canWrite}
                busy={pending === 'secteur'}
                options={[
                  { value: true, label: 'Actif', icon: <Check className="h-3 w-3" /> },
                  { value: false, label: 'Inactif', icon: <X className="h-3 w-3" /> },
                ]}
              />
            </div>
            <SpaceChip
              spaceKey="espace-chef-secteur"
              enabled={secteurEnabled && spaceEnabled('espace-chef-secteur')}
              onToggle={() => toggleSpace('espace-chef-secteur')}
              disabled={!canWrite || !secteurEnabled}
              busy={spaceBusy('espace-chef-secteur')}
              hint={!secteurEnabled ? 'Indisponible : niveau secteur désactivé' : undefined}
            />
            {renderManage(['secteurs', 'chefs-secteur'], { disabled: !secteurEnabled })}
          </Node>

          {/* Lien Secteur → Agence */}
          <Connector muted={!secteurEnabled} />

          {/* Agence */}
          <Node
            icon={<Building2 className="h-5 w-5" />}
            title="Agence"
            subtitle="Point de vente."
            badge={ALWAYS_ACTIVE_BADGE}
          >
            <SpaceChip
              spaceKey="espace-chef-agence"
              enabled={spaceEnabled('espace-chef-agence')}
              onToggle={() => toggleSpace('espace-chef-agence')}
              disabled={!canWrite}
              busy={spaceBusy('espace-chef-agence')}
            />
            {renderManage(['agences', 'chefs-agence'])}
          </Node>

          {/* Lien Agence → Guichetière (pointillés si rattachement optionnel) */}
          <Connector
            dashed={!agenceRequired}
            label={
              agenceRequired ? (
                <><Link2 className="h-3 w-3" /> Rattachement obligatoire</>
              ) : (
                <><Unlink className="h-3 w-3" /> Rattachement optionnel</>
              )
            }
          />

          {/* Guichetière */}
          <Node
            icon={<User className="h-5 w-5" />}
            title="Guichetière"
            subtitle={
              agenceRequired
                ? 'Obligatoirement rattachée à une agence.'
                : 'Peut exister sans rattachement à une agence.'
            }
            badge={ALWAYS_ACTIVE_BADGE}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Rattachement&nbsp;:</span>
              <SegmentedToggle
                value={agenceRequired}
                onChange={(v) => applyStructure('guichetiere', { guichetiere: { agenceRequired: v } })}
                disabled={!canWrite}
                busy={pending === 'guichetiere'}
                options={[
                  { value: true, label: 'Obligatoire', icon: <Link2 className="h-3 w-3" /> },
                  { value: false, label: 'Optionnel', icon: <Unlink className="h-3 w-3" /> },
                ]}
              />
            </div>
            <SpaceChip
              spaceKey="espace-guichetiere"
              enabled={spaceEnabled('espace-guichetiere')}
              onToggle={() => toggleSpace('espace-guichetiere')}
              disabled={!canWrite}
              busy={spaceBusy('espace-guichetiere')}
            />
            {renderManage(['guichetieres'])}
          </Node>
        </div>

        {!canWrite ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Lecture seule — vous n'avez pas les droits pour modifier la structure.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default OrgStructureCard;
