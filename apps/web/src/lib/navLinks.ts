import { LayoutDashboard, Truck, Users, XCircle, type LucideIcon } from 'lucide-react';

export interface NavLink {
  to: string;
  label: string;
  end: boolean;
  icon: LucideIcon;
}

export const NAV_LINKS: NavLink[] = [
  { to: '/', label: 'Resumen', end: true, icon: LayoutDashboard },
  { to: '/subscribers', label: 'Suscriptores', end: false, icon: Users },
  { to: '/deliveries', label: 'Entregas', end: false, icon: Truck },
  { to: '/dlq', label: 'Mensajes muertos', end: false, icon: XCircle },
];
