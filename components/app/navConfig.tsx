import {
  HomeIcon,
  BookIcon,
  ProgressIcon,
  LiveIcon,
  UsersIcon,
  LayersIcon,
  BuildingIcon,
  GlobeIcon,
} from '../ui/icons';

export interface NavItem {
  label: string;
  /** compact label for the mobile tab bar */
  short?: string;
  href: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
}

export interface RoleMeta {
  label: string;
  home: string;
  nav: NavItem[];
}

export const roleConfig: Record<string, RoleMeta> = {
  student: {
    label: 'Étudiant',
    home: '/student',
    nav: [
      { label: "Aujourd'hui", short: 'Accueil', href: '/student', icon: HomeIcon },
      { label: 'Mes cours', short: 'Cours', href: '/student/courses', icon: BookIcon },
      { label: 'Notes & crédits', short: 'Notes', href: '/student/grades', icon: ProgressIcon },
      { label: 'Sessions live', short: 'Live', href: '/student/live', icon: LiveIcon },
    ],
  },
  teacher: {
    label: 'Enseignant',
    home: '/teacher',
    nav: [
      { label: 'Mes enseignements', short: 'Cours', href: '/teacher', icon: BookIcon },
    ],
  },
  admin: {
    label: 'Administration',
    home: '/admin',
    nav: [
      { label: 'Accueil', href: '/admin', icon: HomeIcon },
      { label: 'Étudiants', href: '/admin/students', icon: UsersIcon },
      { label: 'Programmes', href: '/admin/programs', icon: LayersIcon },
    ],
  },
  superadmin: {
    label: 'Super Admin',
    home: '/superadmin',
    nav: [
      { label: 'Réseau', href: '/superadmin', icon: GlobeIcon },
      { label: 'Universités', href: '/superadmin/universities', icon: BuildingIcon },
    ],
  },
};

export function resolveRole(role?: string): RoleMeta {
  return roleConfig[role ?? 'student'] ?? roleConfig.student;
}
