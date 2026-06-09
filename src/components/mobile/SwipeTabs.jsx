import React, { useRef } from 'react';

const THRESHOLD = 60;        // distance horizontale minimale
const RATIO = 1.7;           // dx doit dominer dy (mouvement franchement horizontal)

/**
 * Navigation par balayage horizontal entre onglets (mobile).
 * Réutilise le MÊME tableau d'items que la MobileTabBar :
 *   [{ key, active, onClick }]
 * Balayage vers la gauche → onglet suivant ; vers la droite → précédent.
 *
 * Le geste est ignoré s'il démarre dans une zone défilable horizontalement
 * (tableaux, calendriers) pour ne pas gêner leur scroll.
 */
const SwipeTabs = ({ items = [], children }) => {
  const start = useRef(null);
  const skip = useRef(false);

  const startsInHorizontalScroller = (target, root) => {
    let node = target;
    while (node && node !== root && node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) { start.current = null; return; }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    skip.current = startsInHorizontalScroller(e.target, e.currentTarget);
  };

  const onTouchEnd = (e) => {
    const s = start.current;
    start.current = null;
    if (!s || skip.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * RATIO) return;

    const current = items.findIndex((it) => it.active);
    if (current < 0) return;
    if (dx < 0 && current < items.length - 1) {
      items[current + 1]?.onClick?.();
    } else if (dx > 0 && current > 0) {
      items[current - 1]?.onClick?.();
    }
  };

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
};

export default SwipeTabs;
