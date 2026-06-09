import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Popover positionné manuellement (indépendant de Radix / floating-ui).
 * - Le panneau est rendu en `position: fixed` via un portail dans <body>.
 * - Position calculée depuis le bouton déclencheur puis bornée au viewport
 *   (jamais coupé hors écran), aligné à droite par défaut.
 *
 * @param {React.ReactNode} trigger  élément déclencheur (bouton)
 * @param {React.ReactNode} children contenu du panneau
 * @param {'start'|'end'} [align='end']
 * @param {number} [width=256]
 * @param {string} [maxHeight='28rem']
 * @param {string} [panelClassName]
 */
const AnchoredPopover = ({ trigger, children, align = 'end', width = 256, maxHeight = '28rem', panelClassName = '' }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const computePos = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const w = Math.min(width, window.innerWidth - margin * 2);
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    setPos({ top: Math.round(r.bottom + 4), left: Math.round(left), width: w });
  };

  useLayoutEffect(() => {
    if (open) computePos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => computePos();
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <span ref={triggerRef} className="inline-flex" onClick={() => setOpen((o) => !o)}>
        {trigger}
      </span>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight, zIndex: 60 }}
          className={`overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md ${panelClassName}`}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
};

export default AnchoredPopover;
