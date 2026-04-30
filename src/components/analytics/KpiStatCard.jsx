import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const TONE_STYLES = {
  primary: {
    iconWrap: 'from-primary/20 via-primary/10 to-white text-primary ring-primary/20',
    accent: 'from-primary/18 via-primary/8 to-transparent',
    border: 'border-primary/20',
    rail: 'from-primary via-primary/80 to-primary/35',
  },
  emerald: {
    iconWrap: 'from-emerald-500/20 via-emerald-500/10 to-white text-emerald-600 ring-emerald-500/20',
    accent: 'from-emerald-500/18 via-emerald-500/8 to-transparent',
    border: 'border-emerald-500/20',
    rail: 'from-emerald-500 via-emerald-500/80 to-emerald-500/35',
  },
  blue: {
    iconWrap: 'from-blue-500/20 via-blue-500/10 to-white text-blue-600 ring-blue-500/20',
    accent: 'from-blue-500/18 via-blue-500/8 to-transparent',
    border: 'border-blue-500/20',
    rail: 'from-blue-500 via-blue-500/80 to-blue-500/35',
  },
  amber: {
    iconWrap: 'from-amber-500/20 via-amber-500/10 to-white text-amber-600 ring-amber-500/20',
    accent: 'from-amber-500/18 via-amber-500/8 to-transparent',
    border: 'border-amber-500/20',
    rail: 'from-amber-500 via-amber-500/80 to-amber-500/35',
  },
  red: {
    iconWrap: 'from-red-500/20 via-red-500/10 to-white text-red-600 ring-red-500/20',
    accent: 'from-red-500/18 via-red-500/8 to-transparent',
    border: 'border-red-500/20',
    rail: 'from-red-500 via-red-500/80 to-red-500/35',
  },
  violet: {
    iconWrap: 'from-violet-500/20 via-violet-500/10 to-white text-violet-600 ring-violet-500/20',
    accent: 'from-violet-500/18 via-violet-500/8 to-transparent',
    border: 'border-violet-500/20',
    rail: 'from-violet-500 via-violet-500/80 to-violet-500/35',
  },
};

const KpiStatCard = ({ icon, label, value, helper = '', tone = 'primary' }) => {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.primary;
  const isIconElement = React.isValidElement(icon);
  const Icon = isIconElement ? null : icon;

  return (
    <Card className={`relative overflow-hidden border bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur ${toneStyle.border}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${toneStyle.rail}`} />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneStyle.accent}`} />
      <CardContent className="relative p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] bg-gradient-to-br ring-1 ${toneStyle.iconWrap} shadow-[0_12px_24px_-14px_rgba(15,23,42,0.45)]`}>
            {isIconElement ? React.cloneElement(icon, { className: 'h-7 w-7' }) : null}
            {Icon ? <Icon className="h-7 w-7" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">{label}</p>
            <p className="mt-1 text-4xl font-black tracking-tight text-foreground">{value}</p>
            {helper ? <p className="mt-2 max-w-[24rem] text-xs leading-5 text-muted-foreground">{helper}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KpiStatCard;
