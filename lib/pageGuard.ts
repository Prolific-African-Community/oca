import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { CourseStatus, EnrollmentStatus, Role } from '@prisma/client';
import { getUserById, resolveEffectiveRole } from './serverAuth';
import { readSessionToken, SESSION_COOKIE } from './session';
import { prisma } from './prisma';

/**
 * Protection de page côté serveur, compatible Next 12 Pages Router.
 * Approche la moins invasive : un `getServerSideProps` réutilisable, sans
 * middleware ni changement de framework.
 *
 * La page ne rend donc plus rien avant que le serveur ait validé la session :
 * un visiteur non autorisé est redirigé avant tout envoi de HTML.
 */
export function requireRoleSSR(allowed: Role[]): GetServerSideProps {
  return async (ctx: GetServerSidePropsContext) => {
    const userId = readSessionToken(ctx.req.cookies?.[SESSION_COOKIE]);
    const user = userId ? await getUserById(userId) : null;

    if (!user) {
      return {
        redirect: { destination: '/login', permanent: false },
      };
    }

    const role = resolveEffectiveRole(user);
    const hasRole =
      (role !== null && allowed.includes(role)) ||
      user.memberships.some((m) => allowed.includes(m.role));

    if (!hasRole) {
      return {
        redirect: { destination: '/login', permanent: false },
      };
    }

    // Aucune donnée n'est passée en props : les écrans lisent toujours
    // /api/auth/me côté client. Le rôle sert uniquement au diagnostic.
    return { props: { role } };
  };
}

/**
 * Page de cours enseignant : rôle PROFESSOR **et** affectation au cours.
 * Sans cela, la coquille de page se rendrait pour n'importe quel professeur,
 * même non affecté — l'API refuserait les données, mais autant fermer la porte
 * en amont et renvoyer l'enseignant vers sa liste de cours.
 */
export function requireAssignedCoursePage(): GetServerSideProps {
  return async (ctx: GetServerSidePropsContext) => {
    const userId = readSessionToken(ctx.req.cookies?.[SESSION_COOKIE]);
    const user = userId ? await getUserById(userId) : null;

    const membership = user?.memberships.find((m) => m.role === Role.PROFESSOR);

    if (!user || !membership) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const courseId = ctx.params?.courseId;

    const assignment =
      typeof courseId === 'string'
        ? await prisma.courseAssignment.findFirst({
            where: {
              userId: user.id,
              courseId,
              course: { institutionId: membership.institutionId },
            },
            select: { id: true },
          })
        : null;

    if (!assignment) {
      return { redirect: { destination: '/teacher', permanent: false } };
    }

    return { props: {} };
  };
}

/**
 * Page de cours étudiant : rôle STUDENT **et** inscription active au semestre
 * du cours. Un étudiant non inscrit est renvoyé vers sa liste de cours.
 */
export function requireEnrolledCoursePage(): GetServerSideProps {
  return async (ctx: GetServerSidePropsContext) => {
    const userId = readSessionToken(ctx.req.cookies?.[SESSION_COOKIE]);
    const user = userId ? await getUserById(userId) : null;

    const membership = user?.memberships.find((m) => m.role === Role.STUDENT);

    if (!user || !membership) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const courseId = ctx.params?.courseId;

    const course =
      typeof courseId === 'string'
        ? await prisma.course.findFirst({
            where: {
              id: courseId,
              institutionId: membership.institutionId,
              status: CourseStatus.PUBLISHED,
              semester: {
                enrollments: {
                  some: { userId: user.id, status: EnrollmentStatus.ACTIVE },
                },
              },
            },
            select: { id: true },
          })
        : null;

    if (!course) {
      return { redirect: { destination: '/student/courses', permanent: false } };
    }

    return { props: {} };
  };
}
