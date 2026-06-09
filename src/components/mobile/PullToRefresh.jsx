import React, { useRef, useState, useCallback } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';

const THRESHOLD = 70;   // distance de déclenchement
const MAX_PULL = 96;    // amplitude visuelle max

/**
 * Tirer pour rafraîchir (mobile). N'engage le geste que si la page est en haut
 * et que le mouvement est vers le bas — pour ne pas gêner le défilement normal.
 *
 * @param {Function} onRefresh  async — appelé au-delà du seuil
 */
const PullToRefresh = ({ onRefresh, children }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (refreshing) { startY.current = null; return; }
    // window scroll ou conteneur ? on se base sur le scroll du document.
    const atTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    startY.current = atTop ? e.touches[0].clientY : null;
  }, [refreshing]);

  const onTouchMove = useCallback((e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    const atTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    if (dy > 0 && atTop) {
      // résistance : on amortit le déplacement
      setPull(Math.min(dy * 0.5, MAX_PULL));
    } else if (dy <= 0) {
      setPull(0);
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      setPull(46);
      try { await onRefresh(); } catch { /* ignore */ }
      setTimeout(() => { setRefreshing(false); setPull(0); }, 350);
    } else {
      setPull(0);
    }
  }, [pull, onRefresh]);

  const ready = pull >= THRESHOLD;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Indicateur */}
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden text-primary"
        style={{ height: pull, opacity: pull > 4 ? 1 : 0, transition: refreshing ? 'height 0.2s ease' : (startY.current == null ? 'height 0.2s ease, opacity 0.2s ease' : 'none') }}
        aria-hidden={pull === 0}
      >
        <span className="flex items-center gap-2 text-xs font-semibold">
          {refreshing ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Actualisation…</>
          ) : ready ? (
            <><RefreshCw className="h-4 w-4" /> Relâchez pour actualiser</>
          ) : (
            <><ArrowDown className="h-4 w-4" /> Tirez pour actualiser</>
          )}
        </span>
      </div>

      <div
        style={{
          transform: `translateY(${refreshing ? 0 : Math.max(0, pull - 46) * 0.4}px)`,
          transition: startY.current == null ? 'transform 0.2s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
