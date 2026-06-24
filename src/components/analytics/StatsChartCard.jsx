import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, BarChart3, Gauge, PieChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CHART_COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#22c55e', '#f97316'];
const CHART_SOFT_BACKGROUNDS = [
  'rgba(13, 148, 136, 0.12)',
  'rgba(14, 165, 233, 0.12)',
  'rgba(245, 158, 11, 0.12)',
  'rgba(239, 68, 68, 0.12)',
  'rgba(139, 92, 246, 0.12)',
  'rgba(236, 72, 153, 0.12)',
  'rgba(34, 197, 94, 0.12)',
  'rgba(249, 115, 22, 0.12)',
];

const formatChartValue = (value) => {
  const safeValue = Number(value) || 0;
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(1);
};

const getChartColor = (index) => CHART_COLORS[index % CHART_COLORS.length];
const getChartSoftBackground = (index) => CHART_SOFT_BACKGROUNDS[index % CHART_SOFT_BACKGROUNDS.length];

const EmptyChartState = ({ message }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const PieChartGraphic = ({ data }) => {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const visualData = data.slice(0, 6);

  if (!total || visualData.length === 0) {
    return <EmptyChartState message="Aucune non-conformité à répartir." />;
  }

  let previousAngle = 0;
  const gradientSegments = visualData.map((item, index) => {
    const currentAngle = previousAngle + ((Number(item.value) || 0) / total) * 360;
    const segment = `${getChartColor(index)} ${previousAngle}deg ${currentAngle}deg`;
    previousAngle = currentAngle;
    return segment;
  });

  const remaining = Math.max(data.length - visualData.length, 0);

  return (
    <div className="grid gap-3 xl:grid-cols-[160px_minmax(0,1fr)] xl:items-start">
      <div className="flex justify-center pt-1">
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-inner">
          <div
            className="h-33 w-33 rounded-full shadow-[inset_0_0_18px_rgba(15,23,42,0.10)]"
            style={{ background: `conic-gradient(${gradientSegments.join(', ')})`, width: '8.25rem', height: '8.25rem' }}
          />
          <div className="absolute flex h-18 w-18 flex-col items-center justify-center rounded-full bg-background/95 shadow-lg ring-1 ring-border/60" style={{ width: '4.5rem', height: '4.5rem' }}>
            <span className="text-2xl font-bold text-foreground">{formatChartValue(total)}</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Total</span>
          </div>
        </div>
      </div>
      <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {visualData.map((item, index) => {
          const value = Number(item.value) || 0;
          const percent = total === 0 ? 0 : (value / total) * 100;
          return (
            <div
              key={`${item.label}-${index}`}
              className="rounded-xl border border-border/70 bg-white/70 px-3 py-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: getChartColor(index) }} />
                  <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground">
                  {formatChartValue(value)} • {percent.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(percent, value > 0 ? 6 : 0)}%`, backgroundColor: getChartColor(index) }} />
              </div>
            </div>
          );
        })}
        {remaining > 0 ? (
          <p className="text-[11px] text-muted-foreground">+ {remaining} autre(s) non affichée(s).</p>
        ) : null}
      </div>
    </div>
  );
};

const LineChartGraphic = ({ data }) => {
  if (!data.length) {
    return <EmptyChartState message="Aucune non-conformité sur la période." />;
  }

  const chartWidth = 720;
  const chartHeight = 250;
  const paddingLeft = 32;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 42;
  const values = data.map((item) => Number(item.value) || 0);
  const maxValue = Math.max(...values, 0);
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? paddingLeft + usableWidth / 2
        : paddingLeft + (index * usableWidth) / Math.max(data.length - 1, 1);
    const y =
      maxValue === 0
        ? paddingTop + usableHeight
        : paddingTop + usableHeight - ((Number(item.value) || 0) / maxValue) * usableHeight;

    return { ...item, x, y };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = [
    `${paddingLeft},${chartHeight - paddingBottom}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${chartWidth - paddingRight},${chartHeight - paddingBottom}`,
  ].join(' ');

  const gridLevels = 4;
  const xLabelStep = data.length > 8 ? Math.ceil(data.length / 6) : 1;
  const latestValue = values[values.length - 1] || 0;
  const firstValue = values[0] || 0;
  const delta = latestValue - firstValue;
  const deltaLabel = delta === 0 ? 'Stable' : delta > 0 ? `+${formatChartValue(delta)}` : formatChartValue(delta);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-white/70 px-3 py-2 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Pic</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">{formatChartValue(maxValue)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-white/70 px-3 py-2 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Dernière valeur</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">{formatChartValue(latestValue)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-white/70 px-3 py-2 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Variation</p>
          <p className={`mt-0.5 text-xl font-bold ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-emerald-600' : 'text-foreground'}`}>
            {deltaLabel}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-white/70 p-2 shadow-sm">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48 min-w-[580px] w-full">
          <defs>
            <linearGradient id="analytics-line-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {Array.from({ length: gridLevels + 1 }, (_, level) => {
            const y = paddingTop + (usableHeight * level) / gridLevels;
            const labelValue = Math.round(maxValue - (maxValue * level) / gridLevels);
            return (
              <g key={`grid-${level}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.18)"
                  strokeDasharray="4 6"
                />
                <text x={6} y={y + 4} className="fill-slate-400 text-[11px] font-medium">
                  {formatChartValue(labelValue)}
                </text>
              </g>
            );
          })}

          <polyline fill="url(#analytics-line-fill)" points={areaPoints} />
          <polyline fill="none" stroke="#22c55e" strokeWidth="4" points={linePoints} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r="5.5" fill="#ffffff" stroke="#22c55e" strokeWidth="3" />
              {(index % xLabelStep === 0 || index === points.length - 1) && (
                <text x={point.x} y={chartHeight - 14} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium">
                  {point.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

const BarChartGraphic = ({ data }) => {
  const visualData = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).slice(0, 8);
  const maxValue = Math.max(...visualData.map((item) => Number(item.value) || 0), 0);

  if (!visualData.length || maxValue === 0) {
    return <EmptyChartState message="Aucune donnée suffisante pour établir un classement." />;
  }

  return (
    <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
      {visualData.map((item, index) => {
        const value = Number(item.value) || 0;
        const width = maxValue === 0 ? 0 : (value / maxValue) * 100;

        return (
          <div key={`${item.label}-${index}`} className="rounded-xl border border-border/70 bg-white/70 px-3 py-2 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: getChartColor(index) }}>
                  {index + 1}
                </span>
                <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold text-foreground">{formatChartValue(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(width, value > 0 ? 8 : 0)}%`,
                  background: `linear-gradient(90deg, ${getChartColor(index)} 0%, ${getChartColor(index)}cc 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ProgressChartGraphic = ({ data }) => {
  const visualData = data.filter((item) => Number(item.value) > 0);
  const total = visualData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (!total || visualData.length === 0) {
    return <EmptyChartState message="Aucune donnée disponible pour calculer la répartition." />;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border/70 bg-white/70 px-3 py-2 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Volume total</p>
            <p className="text-xl font-bold text-foreground">{formatChartValue(total)}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">{visualData.length} segment(s)</div>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted/60">
          {visualData.map((item, index) => {
            const value = Number(item.value) || 0;
            const width = (value / total) * 100;
            return (
              <div
                key={`${item.label}-${index}`}
                className="h-full transition-all"
                style={{ width: `${width}%`, backgroundColor: getChartColor(index) }}
                title={`${item.label} • ${formatChartValue(value)}`}
              />
            );
          })}
        </div>
      </div>
      <div className="max-h-[220px] overflow-y-auto grid gap-1.5 pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {visualData.map((item, index) => {
          const value = Number(item.value) || 0;
          const percent = total === 0 ? 0 : (value / total) * 100;
          return (
            <div key={`${item.label}-${index}`} className="rounded-xl border border-border/70 px-3 py-2 shadow-sm" style={{ backgroundColor: getChartSoftBackground(index) }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: getChartColor(index) }} />
                  <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground">
                  {formatChartValue(value)} • {percent.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CHART_TYPE_CONFIG = {
  pie: {
    icon: PieChart,
    emptyMessage: 'Aucune non-conformité à répartir.',
  },
  line: {
    icon: Activity,
    emptyMessage: 'Aucune donnée à afficher sur la période.',
  },
  bar: {
    icon: BarChart3,
    emptyMessage: 'Aucune donnée suffisante pour un classement.',
  },
  progress: {
    icon: Gauge,
    emptyMessage: 'Aucune donnée disponible pour la répartition.',
  },
};

const StatsChartCard = ({ title, description, type = 'pie', data = [] }) => {
  const chartType = CHART_TYPE_CONFIG[type] ? type : 'pie';
  const Icon = CHART_TYPE_CONFIG[chartType].icon;
  const safeData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (chartType === 'line') return data;
    return data.filter((item) => Number(item.value) > 0);
  }, [chartType, data]);

  const content = (() => {
    if (!safeData.length) {
      return <EmptyChartState message={CHART_TYPE_CONFIG[chartType].emptyMessage} />;
    }

    if (chartType === 'line') return <LineChartGraphic data={safeData} />;
    if (chartType === 'bar') return <BarChartGraphic data={safeData} />;
    if (chartType === 'progress') return <ProgressChartGraphic data={safeData} />;
    return <PieChartGraphic data={safeData} />;
  })();

  return (
    <Card className="overflow-hidden border-white/70 bg-white/75 shadow-sm backdrop-blur">
      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-white/70 via-white/40 to-transparent px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {content}
        </motion.div>
      </CardContent>
    </Card>
  );
};

export default StatsChartCard;
