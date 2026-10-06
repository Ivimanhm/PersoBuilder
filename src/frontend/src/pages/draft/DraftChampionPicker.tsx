import { useRef } from "preact/hooks";
import type { Champion, Role } from "../../types";
import { Select } from "../../components/Select/Select";
import { TextField } from "../../components/TextField/TextField";
import { roleLabels, roleOrder } from "../../components/TeamTable/TeamTable";

type DraftChampionPickerProps = {
  champions: Champion[];
  selected: Champion | null;
  canConfirm: boolean;
  search: string;
  roleFilter: Role | "all";
  loading: boolean;
  error: string;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: Role | "all") => void;
  onSelect: (champion: Champion) => void;
  onConfirm: () => void;
  onRetry: () => void;
};

export function DraftChampionPicker({
  champions,
  selected,
  canConfirm,
  search,
  roleFilter,
  loading,
  error,
  onSearchChange,
  onRoleFilterChange,
  onSelect,
  onConfirm,
  onRetry,
}: DraftChampionPickerProps) {
  const championListRef = useRef<HTMLDivElement>(null);
  const concealed = loading || Boolean(error);
  return (
    <section className={`champion-picker${error && !loading ? " has-error" : ""}`}>
      <header className={concealed ? "draft-picker-concealed" : ""}>
        <TextField containerClassName="champion-search" prefix={<i className="bi bi-search" />} value={search} onValueChange={onSearchChange} placeholder="Buscar campeón..." ariaLabel="Buscar campeón" />
        <Select
          value={roleFilter}
          onValueChange={(nextRole) => {
            onRoleFilterChange(nextRole);
            championListRef.current?.scrollTo({ left: 0, behavior: "auto" });
          }}
          aria-label="Filtrar por posición"
          ariaLabel="Filtrar por posición"
          options={[{ value: "all", label: "Todos" }, ...roleOrder.map((role) => ({ value: role, label: roleLabels[role] }))]}
        />
      </header>
      <div className={`draft-champions ${concealed ? "draft-picker-concealed" : ""}`} ref={championListRef}
        onWheel={(event) => {
          const list = event.currentTarget;
          if (list.ownerDocument.documentElement.dataset.desktopApp !== "true" || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
          const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? list.clientWidth : 1;
          const nextLeft = Math.max(0, Math.min(list.scrollWidth - list.clientWidth, list.scrollLeft + event.deltaY * unit));
          if (nextLeft === list.scrollLeft) return;
          event.preventDefault();
          list.scrollLeft = nextLeft;
        }}>
        {champions.map((champion) => (
          <button className={selected?.id === champion.id ? "selected" : ""} type="button" onClick={() => onSelect(champion)} key={champion.id}>
            <img src={champion.image} alt="" loading="lazy" decoding="async" />
            <strong>{champion.name}</strong>
          </button>
        ))}
      </div>
      <footer className={concealed ? "draft-picker-concealed" : ""}>
        <button className="gold-button confirm-button" type="button" disabled={!canConfirm || concealed} onClick={onConfirm}>
          <i className="bi bi-check-lg" /> Confirmar selección
        </button>
      </footer>
      {loading ? (
        <div className="draft-champions-status" role="status" aria-live="polite"><i className="bi bi-arrow-repeat" aria-hidden="true" /><span>Cargando campeones usados...</span></div>
      ) : error ? (
        <div className="draft-champions-status error" role="alert"><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /><span>{error}</span><button type="button" onClick={onRetry}>Reintentar</button></div>
      ) : null}
    </section>
  );
}
