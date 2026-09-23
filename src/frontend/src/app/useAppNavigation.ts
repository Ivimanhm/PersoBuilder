import { useState } from "preact/hooks";
import { getPreviewPage, type PageId } from "./routes";

export function useAppNavigation() {
  const previewPage = getPreviewPage();
  const [welcomed, setWelcomed] = useState(Boolean(previewPage));
  const [activePage, setActivePage] = useState<PageId>(previewPage ?? "home");
  return { welcomed, start: () => setWelcomed(true), activePage, previewPage, navigate: setActivePage };
}
