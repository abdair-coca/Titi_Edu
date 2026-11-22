import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento común de hojas y paneles (R4 filtros, R6 vista rápida):
 * Esc cierra, el fondo no scrollea, el foco queda adentro y vuelve a quien lo
 * tenía al cerrar, y la hoja se cierra arrastrando hacia abajo.
 */
export default function useSheetDismiss({ open, onClose }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, [open]);

  // Arrastrar la manija: la hoja sigue al dedo y se cierra si baja > 25 %.
  const drag = useRef(null);
  const dragHandlers = {
    onPointerDown(e) {
      const panel = panelRef.current;
      if (!panel) return;
      drag.current = { y: e.clientY, h: panel.offsetHeight };
      e.currentTarget.setPointerCapture(e.pointerId);
      panel.style.transition = 'none';
    },
    onPointerMove(e) {
      const panel = panelRef.current;
      if (!drag.current || !panel) return;
      const dy = Math.max(0, e.clientY - drag.current.y);
      panel.style.transform = `translateY(${dy}px)`;
    },
    onPointerUp(e) {
      const panel = panelRef.current;
      if (!drag.current || !panel) return;
      const dy = Math.max(0, e.clientY - drag.current.y);
      const shouldClose = dy > drag.current.h * 0.25;
      drag.current = null;
      panel.style.transition = 'transform 200ms ease-out';
      panel.style.transform = shouldClose ? 'translateY(100%)' : '';
      if (shouldClose) setTimeout(() => onCloseRef.current(), 180);
    },
  };
  dragHandlers.onPointerCancel = dragHandlers.onPointerUp;

  return { panelRef, dragHandlers };
}
