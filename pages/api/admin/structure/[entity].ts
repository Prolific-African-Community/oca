import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { requireInstitutionRole } from '../../../../lib/serverAuth';
import { AuditAction, createAuditLog } from '../../../../lib/audit';
import {
  createStructureEntity,
  isStructureEntity,
  STRUCTURE_ENTITIES,
  ValidationError,
} from '../../../../lib/adminStructure';

/**
 * Création d'un élément de structure académique :
 * POST /api/admin/structure/{faculty|department|cycle|program|academic-year|semester|course}
 *
 * ADMIN uniquement. L'établissement provient de la session ; tout `institutionId`
 * présent dans le corps de la requête est ignoré.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const { entity } = req.query;

  if (!isStructureEntity(entity)) {
    return res.status(404).json({
      message: 'Type inconnu',
      allowed: STRUCTURE_ENTITIES,
    });
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN);
  if (!scope) return;

  try {
    const created = await createStructureEntity(
      entity,
      scope.institutionId,
      (req.body ?? {}) as Record<string, unknown>
    );

    const record = created as { id?: string; name?: string; title?: string; code?: string };

    await createAuditLog({
      actorUserId: scope.user.id,
      institutionId: scope.institutionId,
      action: AuditAction.STRUCTURE_CREATE,
      entityType: entity,
      entityId: record.id ?? 'inconnu',
      metadata: { name: record.name ?? record.title ?? null, code: record.code ?? null },
    });

    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }

    console.error(`[admin/structure/${entity}]`, error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
