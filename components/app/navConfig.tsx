import {
  HomeIcon,
  CapIcon,
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
    /**
     * Les sections vivent toutes sur le tableau de bord : la navigation
     * pointe donc des ancres, pas des pages qui n'existent pas encore.
     * Les anciens liens `/admin/students` et `/admin/programs` renvoyaient
     * une 404 — mieux vaut aucune entrée qu'une entrée morte.
     */
    nav: [
      { label: 'Pilotage', short: 'Pilotage', href: '/admin', icon: HomeIcon },
      {
        label: 'Structure',
        short: 'Structure',
        href: '/admin#structure',
        icon: LayersIcon,
      },
      {
        label: 'Étudiants',
        short: 'Étudiants',
        href: '/admin#etudiants',
        icon: UsersIcon,
      },
      {
        label: 'Professeurs',
        short: 'Profs',
        href: '/admin#professeurs',
        icon: CapIcon,
      },
      { label: 'Cours', short: 'Cours', href: '/admin#cours', icon: BookIcon },
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
