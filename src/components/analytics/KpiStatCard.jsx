import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const TONE_STYLES = {
  primary: {
    iconWrap: 'bg-primary/10 text-primary ring-primary/15',
    accent: 'from-primary/15 via-primary/5 to-transparent',
  },
  emerald: {
    iconWrap: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/15',
    accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
  },
  blue: {
    iconWrap: 'bg-blue-500/10 text-blue-600 ring-blue-500/15',
    accent: 'from-blue-500/15 via-blue-500/5 to-transparent',
  },
  amber: {
    iconWrap: 'bg-amber-500/10 text-amber-600 ring-amber-500/15',
    accent: 'from-amber-500/15 via-amber-500/5 to-transparent',
  },
  red: {
    iconWrap: 'bg-red-500/10 text-red-600 ring-red-500/15',
    accent: 'from-red-500/15 via-red-500/5 to-transparent',
  },
  violet: {
    iconWrap: 'bg-violet-500/10 text-violet-600 ring-violet-500/15',
    accent: 'from-violet-500/15 via-violet-500/5 to-transparent',
  },
};

const KpiStatCard = ({ icon, label, value, helper = '', tone = 'primary' }) => {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.primary;

  return (
    <Card className="relative overflow-hidden border-white/70 bg-white/80 shadow-sm backdrop-blur">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneStyle.accent}`} />
      <CardContent className="relative p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneStyle.iconWrap} shadow-sm`}>
            {icon ? React.cloneElement(icon, { className: 'h-7 w-7' }) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">{value}</p>
            {helper ? <p className="mt-2 text-xs text-muted-foreground">{helper}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KpiStatCard;
