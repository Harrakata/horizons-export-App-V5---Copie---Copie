import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Popover positionné manuellement (indépendant de Radix / floating-ui).
 * - Panneau rendu en `position: fixed` via un portail dans <body>.
 * - Position calculée depuis le bouton puis bornée au viewport (jamais hors écran).
 *
 * Peut être non-contrôlé (clic sur le trigger ouvre/ferme) ou contrôlé via `open`/`onOpenChange`.
 *
 * @param {React.ReactNode} trigger
 * @param {React.ReactNode} children
 * @param {'start'|'end'} [align='end']
 * @param {number} [width=256]            largeur du panneau (ignorée si matchTriggerWidth)
 * @param {boolean} [matchTriggerWidth]   le panneau prend la largeur du bouton
 * @param {string} [maxHeight='28rem']
 * @param {string} [panelClassName]
 * @param {boolean} [disabled]
 * @param {boolean} [open]                mode contrôlé
 * @param {(o:boolean)=>void} [onOpenChange]
 */
const AnchoredPopover = ({
  trigger, children, align = 'end', width = 256, matchTriggerWidth = false,
  maxHeight = '28rem', panelClassName = '', disabled = false, open: openProp, onOpenChange,
  triggerWrapClassName = 'inline-flex',
}) => {
  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = isControlled ? openProp : openState;
  const setOpen = (v) => {
    const next = typeof v === 'function' ? v(open) : v;
    if (!isControlled) setOpenState(next);
    onOpenChange?.(next);
  };

  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const computePos = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const w = Math.min(matchTriggerWidth ? r.width : width, window.innerWidth - margin * 2);
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    setPos({ top: Math.round(r.bottom + 4), left: Math.round(left), width: Math.round(w) });
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
      <span
        ref={triggerRef}
        className={triggerWrapClassName}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
      >
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
