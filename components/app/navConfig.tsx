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
  /**
   * Page de paramètres du rôle, si elle existe. Le lien du pied de la barre
   * latérale et l'entrée du menu de compte s'y rendent ; sans elle, ils ne
   * sont tout simplement pas affichés. Un lien de réglages qui ramène à
   * l'accueil est pire que pas de lien du tout.
   */
  settings?: string;
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
    settings: '/admin/settings',
    /**
     * Chaque entrée mène désormais à une page réelle : structure, étudiants,
     * professeurs et cours. Aucun lien ne pointe vers une route inexistante.
     */
    nav: [
      { label: 'Pilotage', short: 'Pilotage', href: '/admin', icon: HomeIcon },
      {
        label: 'Structure',
        short: 'Structure',
        href: '/admin/structure',
        icon: LayersIcon,
      },
      {
        label: 'Étudiants',
        short: 'Étudiants',
        href: '/admin/students',
        icon: UsersIcon,
      },
      {
        label: 'Professeurs',
        short: 'Profs',
        href: '/admin/professors',
        icon: CapIcon,
      },
      {
        label: 'Cours',
        short: 'Cours',
        href: '/admin/structure?tab=course',
        icon: BookIcon,
      },
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

/**
 * Entrée de navigation active, pour la barre latérale comme pour la barre
 * mobile.
 *
 * Deux entrées peuvent viser la même page : « Structure » mène à
 * /admin/structure, « Cours » à /admin/structure?tab=course. Comparer le seul
 * chemin les allumerait toutes les deux. Les entrées portant une requête sont
 * donc examinées d'abord, comme les plus spécifiques ; l'entrée nue ne
 * l'emporte que si aucune ne correspond.
 */
export function activeHref(
  nav: NavItem[],
  home: string,
  pathname: string,
  asPath: string
): string | null {
  const path = asPath.split('#')[0];

  const specific = nav.find(
    (item) => item.href.indexOf('?') !== -1 && item.href === path
  );
  if (specific) return specific.href;

  const plain = nav.filter((item) => item.href.indexOf('?') === -1);
  const match = plain.find((item) =>
    item.href === home
      ? pathname === home
      : pathname === item.href || pathname.indexOf(item.href + '/') === 0
  );
  return match ? match.href : null;
}

export function resolveRole(role?: string): RoleMeta {
  return roleConfig[role ?? 'student'] ?? roleConfig.student;
}
