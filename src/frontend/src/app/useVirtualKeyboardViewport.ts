import { useEffect } from "preact/hooks";

const keyboardThreshold = 80;
const geometrySettleDelay = 100;

type VirtualKeyboard = EventTarget & { boundingRect: { height: number } };
type NativeImeState = { height: number; visible: boolean };
type KeyboardWindow = Window & { __DRAFTLAB_ANDROID_IME__?: NativeImeState };

const nonTypingInputTypes = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "file",
  "hidden",
  "image",
  "month",
  "radio",
  "range",
  "reset",
  "submit",
  "time",
  "week",
]);

function isTypingControl(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLInputElement) {
    return (
      !element.disabled &&
      !element.readOnly &&
      !nonTypingInputTypes.has(element.type.toLowerCase())
    );
  }
  if (element instanceof HTMLTextAreaElement)
    return !element.disabled && !element.readOnly;
  return element instanceof HTMLElement && element.isContentEditable;
}

function findScrollContainer(field: HTMLElement): HTMLElement | null {
  let candidate = field.parentElement;
  while (candidate) {
    if (candidate.matches("[data-app-scroll-container]")) return candidate;
    const overflowY = window.getComputedStyle(candidate).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return candidate;
    candidate = candidate.parentElement;
  }
  return document.querySelector<HTMLElement>("[data-app-scroll-container]");
}

/** Mantiene visible cualquier control de escritura por encima del teclado móvil. */
export function useVirtualKeyboardViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const keyboardWindow = window as KeyboardWindow;
    const visualViewport = window.visualViewport;
    const virtualKeyboard = (
      navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }
    ).virtualKeyboard;
    let nativeIme = keyboardWindow.__DRAFTLAB_ANDROID_IME__ ?? null;
    let keyboardHeight = 0;
    let overlayHeight = 0;
    let restingWindowHeight = window.innerHeight;
    let keyboardWasOpen = false;
    let scrollBeforeKeyboard: { container: HTMLElement; top: number } | null =
      null;
    let settleTimer = 0;
    let frame = 0;

    const getMetrics = () => {
      const visualViewportReduction = visualViewport
        ? Math.max(
            0,
            window.innerHeight -
              visualViewport.height -
              visualViewport.offsetTop,
          )
        : 0;
      const fallbackHeight = Math.max(
        virtualKeyboard?.boundingRect.height ?? 0,
        visualViewportReduction,
      );
      const height = nativeIme
        ? nativeIme.visible
          ? nativeIme.height
          : 0
        : fallbackHeight;
      if (height < keyboardThreshold) restingWindowHeight = window.innerHeight;
      const resizedViewport =
        visualViewportReduction >= keyboardThreshold ||
        window.innerHeight < restingWindowHeight - keyboardThreshold;
      return { height, overlay: resizedViewport ? 0 : height };
    };

    const getRelatedActionBottom = (field: HTMLElement, fieldRect: DOMRect) => {
      let candidate = field.parentElement;
      while (candidate && !candidate.matches("[data-app-scroll-container]")) {
        const action = candidate.querySelector<HTMLElement>(
          "[data-keyboard-primary-action], button[type='submit'], .gold-button",
        );
        if (action) {
          const actionRect = action.getBoundingClientRect();
          const distance = actionRect.top - fieldRect.bottom;
          if (distance >= 0 && distance <= 180) return actionRect.bottom;
        }
        candidate = candidate.parentElement;
      }
      return fieldRect.bottom;
    };

    const keepFocusedControlVisible = () => {
      const field = isTypingControl(document.activeElement)
        ? document.activeElement
        : null;
      if (!field || keyboardHeight < keyboardThreshold) return;

      const container = findScrollContainer(field);
      if (!container) return;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const safeGap =
        Number.parseFloat(
          window
            .getComputedStyle(field)
            .getPropertyValue("--app-content-gutter"),
        ) || 16;
      const visibleBottom =
        viewportTop + viewportHeight - overlayHeight - safeGap;
      const fieldRect = field.getBoundingClientRect();
      const protectedBottom = getRelatedActionBottom(field, fieldRect);
      const belowKeyboard = protectedBottom - visibleBottom;
      const aboveViewport = viewportTop + safeGap - fieldRect.top;

      if (belowKeyboard > 1) {
        container.scrollBy({ top: belowKeyboard, behavior: "smooth" });
      } else if (aboveViewport > 1) {
        container.scrollBy({ top: -aboveViewport, behavior: "smooth" });
      }
    };

    const scheduleVisibilityCheck = (delay = geometrySettleDelay) => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(keepFocusedControlVisible);
      }, delay);
    };

    const updateViewport = () => {
      const metrics = getMetrics();
      keyboardHeight = metrics.height;
      overlayHeight = metrics.overlay;
      const keyboardOpen = keyboardHeight >= keyboardThreshold;
      root.style.setProperty(
        "--app-keyboard-height",
        `${Math.round(keyboardHeight)}px`,
      );
      root.toggleAttribute("data-virtual-keyboard-open", keyboardOpen);

      if (keyboardOpen && !keyboardWasOpen) {
        const focusedField = isTypingControl(document.activeElement)
          ? document.activeElement
          : null;
        const container = focusedField && findScrollContainer(focusedField);
        if (container)
          scrollBeforeKeyboard = { container, top: container.scrollTop };
      }
      if (!keyboardOpen && keyboardWasOpen && scrollBeforeKeyboard) {
        const { container, top } = scrollBeforeKeyboard;
        window.requestAnimationFrame(() =>
          container.scrollTo({ top, behavior: "smooth" }),
        );
        scrollBeforeKeyboard = null;
      }
      keyboardWasOpen = keyboardOpen;
      if (keyboardOpen) scheduleVisibilityCheck();
    };

    const onFocusIn = (event: FocusEvent) => {
      if (
        isTypingControl(event.target instanceof Element ? event.target : null)
      )
        scheduleVisibilityCheck(350);
    };
    const onNativeImeInset = (event: Event) => {
      const detail = (event as CustomEvent<NativeImeState>).detail;
      if (!detail) return;
      nativeIme = {
        height: Math.max(0, Number(detail.height) || 0),
        visible: Boolean(detail.visible),
      };
      updateViewport();
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);
    virtualKeyboard?.addEventListener("geometrychange", updateViewport);
    window.addEventListener("draftlab:ime-inset", onNativeImeInset);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      virtualKeyboard?.removeEventListener("geometrychange", updateViewport);
      window.removeEventListener("draftlab:ime-inset", onNativeImeInset);
      document.removeEventListener("focusin", onFocusIn);
      root.style.removeProperty("--app-keyboard-height");
      root.removeAttribute("data-virtual-keyboard-open");
    };
  }, []);
}
