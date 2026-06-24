import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

const KpiStatCard = ({ icon, label, value, helper = '', tone = 'primary', solid = true, className = '' }) => {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.primary;
  const isIconElement = React.isValidElement(icon);
  const Icon = isIconElement ? null : icon;

  return (
    <Card
      glass={false}
      className={cn(
        'kpi-stat-card relative overflow-hidden border shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)]',
        solid ? 'bg-white' : 'bg-white/75 backdrop-blur-md',
        toneStyle.border,
        className,
      )}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r sm:h-1.5 ${toneStyle.rail}`} />
      {!solid ? <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneStyle.accent}`} /> : null}
      <CardContent className="relative px-2 py-1.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 sm:h-10 sm:w-10 sm:rounded-xl ${toneStyle.iconWrap} shadow-[0_8px_16px_-10px_rgba(15,23,42,0.35)]`}>
            {isIconElement ? React.cloneElement(icon, { className: 'h-3.5 w-3.5 sm:h-5 sm:w-5' }) : null}
            {Icon ? <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.03em] text-muted-foreground/80 leading-tight sm:text-[0.7rem]">{label}</p>
            <p className="text-base font-black tracking-tight text-foreground leading-none sm:mt-1 sm:text-2xl">{value}</p>
            {/* La phrase d'aide n'apparaît qu'à partir de sm (gain de place sur mobile) */}
            {helper ? <p className="mt-1 hidden text-[0.66rem] leading-3.5 text-muted-foreground sm:block sm:text-[0.7rem] sm:leading-4">{helper}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KpiStatCard;
