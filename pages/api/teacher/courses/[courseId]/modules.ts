import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAssignedCourse } from '../../../../../lib/teacherAccess';
import { AuditAction, createAuditLog } from '../../../../../lib/audit';
import { ValidationError } from '../../../../../lib/validation';
import { contentStatus, optionalInt, optionalText, requiredText } from '../../../../../lib/teacherContent';

/** Création d'un module dans un cours enseigné par le professeur connecté. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedCourse(req, res, req.query.courseId);
  if (!access) return;

  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const explicitOrder = optionalInt(body, 'order', "L'ordre", 0, 999);

    // Sans ordre explicite, le module est ajouté à la fin.
    const order =
      explicitOrder ??
      ((
        await prisma.module.aggregate({
          where: { courseId: access.courseId },
          _max: { order: true },
        })
      )._max.order ?? -1) + 1;

    const created = await prisma.module.create({
      data: {
        courseId: access.courseId,
        title: requiredText(body, 'title', 'le titre'),
        description: optionalText(body, 'description', 2000) ?? null,
        order,
        status: contentStatus(body) ?? ContentStatus.DRAFT,
      },
      select: { id: true, title: true, description: true, order: true, status: true },
    });

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.MODULE_CREATE,
      entityType: 'Module',
      entityId: created.id,
      metadata: { courseId: access.courseId, title: created.title, status: created.status },
    });

    return res.status(201).json({ ...created, lessons: [] });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/modules:create]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
