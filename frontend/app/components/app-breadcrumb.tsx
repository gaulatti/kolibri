import {
  Breadcrumb,
  type BreadcrumbItem,
  type RenderLink,
} from "~/bleecker";
import { NavLink } from "react-router";

const renderLink: RenderLink<BreadcrumbItem> = ({
  item,
  className,
  children,
}) => (
  <NavLink to={item.href} className={className}>
    {children}
  </NavLink>
);

export function AppBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return <Breadcrumb items={items} renderLink={renderLink} />;
}
