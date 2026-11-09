"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
export default function CommerceOverlay({
  children,
  onClose,
  busy = false,
  payment = false,
}) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!box.current.contains(previous))
      box.current
        .querySelector("input:not(:disabled),button:not(:disabled)")
        ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  function key(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busy) onClose?.();
    }
    if (e.key === "Tab") {
      const nodes = [
        ...box.current.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ),
      ].filter((el) => el.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  return createPortal(
    <div
      className={`spWorkspace ${payment ? "spPaymentShade" : "spShade"}`}
      ref={box}
      onKeyDown={key}
    >
      {children}
    </div>,
    document.body,
  );
}
