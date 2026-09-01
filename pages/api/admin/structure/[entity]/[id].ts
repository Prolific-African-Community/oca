import type { NextApiRequest, NextApiResponse } from 'next'
import { Role } from '@prisma/client'
import { requireInstitutionRole } from '../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import {
  NotFoundError,
  ValidationError,
  archiveStructureEntity,
  isArchivable,
  isStructureEntity,
  updateStructureEntity,
} from '../../../../../lib/adminStructure'

/**
 * Correction d'un élément de structure académique :
 * PATCH /api/admin/structure/{entity}/{id}
 *
 * ADMIN uniquement. L'établissement vient de la session ; l'identifiant vient
 * du client et est systématiquement revérifié comme appartenant à cet
 * établissement. Un élément d'un autre établissement répond 404 — le même
 * message qu'un identifiant inexistant, pour ne pas transformer la route en
 * révélateur d'existence.
 *
 * `{ "archived": true|false }` bascule le statut des entités qui en ont un ;
 * tout autre corps est traité comme une modification de champs. Aucune
 * suppression définitive n'est exposée.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const { entity, id } = req.query

  if (!isStructureEntity(entity)) {
    return res.status(404).json({ message: 'Type inconnu' })
  }
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    if (typeof body.archived === 'boolean') {
      if (!isArchivable(entity)) {
        return res.status(400).json({
          code: 'NOT_ARCHIVABLE',
          message:
            'Cet élément n’a pas de statut : il ne peut pas être archivé.',
        })
      }

      const record = await archiveStructureEntity(
        entity,
        scope.institutionId,
        id,
        body.archived
      )

      await createAuditLog({
        actorUserId: scope.user.id,
        institutionId: scope.institutionId,
        action: AuditAction.STRUCTURE_ARCHIVE,
        entityType: entity,
        entityId: id,
        metadata: {
          archived: body.archived,
          status: (record as { status?: string }).status ?? null,
        },
      })

      return res.status(200).json(record)
    }

    const { record, fields } = await updateStructureEntity(
      entity,
      scope.institutionId,
      id,
      body
    )

    await createAuditLog({
      actorUserId: scope.user.id,
      institutionId: scope.institutionId,
      action: AuditAction.STRUCTURE_UPDATE,
      entityType: entity,
      entityId: id,
      // Les champs modifiés, pas leur contenu : on trace l'intention.
      metadata: { fields },
    })

    return res.status(200).json(record)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ message: 'Élément introuvable' })
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field })
    }

    console.error(`[admin/structure/${entity}/update]`, error)
    return res.status(500).json({ message: 'Erreur serveur' })
  }
}
