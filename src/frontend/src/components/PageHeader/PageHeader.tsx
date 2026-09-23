import type { IconName } from "../../app/routes";
import { UiIcon } from "../UiIcon/UiIcon";
import "./PageHeader.css";

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: IconName;
  onBack?: () => void;
};

/** Standard heading rendered exclusively by the application layout. */
export function PageHeader({ title, description, icon, onBack }: PageHeaderProps) {
  return (
    <header
      className={`page-title${onBack ? "" : " page-title-without-back"}${icon ? "" : " page-title-without-icon"}`}
    >
      {onBack && (
        <button className="back-button" type="button" onClick={onBack} aria-label="Volver">
          <UiIcon name="back" />
        </button>
      )}
      {icon && <UiIcon name={icon} />}
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </header>
  );
}
