import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { requireAssignedModule } from '../../../../lib/teacherAccess';
import { AuditAction, createAuditLog } from '../../../../lib/audit';
import { ValidationError } from '../../../../lib/validation';
import {
  contentStatus,
  definedOnly,
  optionalInt,
  optionalText,
  requiredText,
} from '../../../../lib/teacherContent';

/** Modification d'un module. Seul le professeur affecté au cours y accède. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedModule(req, res, req.query.moduleId);
  if (!access) return;

  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const data = definedOnly({
      title: 'title' in body ? requiredText(body, 'title', 'le titre') : undefined,
      description: optionalText(body, 'description', 2000),
      order: optionalInt(body, 'order', "L'ordre", 0, 999) ?? undefined,
      status: contentStatus(body),
    });

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }

    const updated = await prisma.module.update({
      where: { id: access.moduleId },
      data,
      select: { id: true, title: true, description: true, order: true, status: true },
    });

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.MODULE_UPDATE,
      entityType: 'Module',
      entityId: updated.id,
      // Champs modifiés, pas le corps de requête : on trace l'intention.
      metadata: { courseId: access.courseId, fields: Object.keys(data), status: updated.status },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/modules:update]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
