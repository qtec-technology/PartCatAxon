import { Request, Response, NextFunction } from 'express';
import * as termRepo from '#src/repositories/term.repository.js';
import {
    toCWeightQueryDTO,
    toMasterFGParamsDTO,
    toTermDeleteBodyDTO,
    toTermIdParamDTO,
    toTermsQueryDTO,
} from '#src/dtos/term/term.request.dto.js';
import type {
    CWeightResponseDTO,
    MasterFGResponseDTO,
    TermMutationResponseDTO,
    TermsResponseDTO,
    VendorEmailResponseDTO,
} from '#src/dtos/term/term.response.dto.js';
import { calculate } from '#src/services/calculation.service.js';
import { toCalcInput } from '#src/services/calc-input.mapper.js';
import { writeAuditLog, AuditAction, AuditEntity } from '#src/services/audit.service.js';
import { env } from '#src/config/env.js';
import { success, error } from '#src/utils/response.js';
import { canDeleteOwnedRecordByActor } from '#src/services/attachment-legacy.service.js';

// ─── Term Controller ────────────────────────────────────────────────────────

/** GET /api/terms?itemId=X — List terms by ItemID */
export async function getTerms(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toTermsQueryDTO(req.query);
        if (itemId === null) {
            res.status(400).json(error('itemId query param is required'));
            return;
        }

        const terms = await termRepo.getTermsByItemId(itemId);
        const payload: TermsResponseDTO = terms;
        res.json(success(payload, undefined, { total: payload.length }));
    } catch (err) {
        next(err);
    }
}

/** GET /api/terms/cweight?vendorStockItemNo=X - Get chargeable weight by vendor stock item no */
export async function getCWeight(req: Request, res: Response, next: NextFunction) {
    try {
        const { vendorStockItemNo } = toCWeightQueryDTO(req.query);
        if (!vendorStockItemNo) {
            res.status(400).json(error('vendorStockItemNo query param is required'));
            return;
        }

        const cWeight = await termRepo.getCWeight(vendorStockItemNo);
        const payload: CWeightResponseDTO = { cWeight: Number(cWeight) || 0 };
        res.json(success(payload));
    } catch (err) {
        next(err);
    }
}

/** GET /api/terms/:id - Get single term */
export async function getTermById(req: Request, res: Response, next: NextFunction) {
    try {
        const { termId } = toTermIdParamDTO(req.params);
        if (termId === null) {
            res.status(400).json(error('Invalid TermID'));
            return;
        }

        const term = await termRepo.getTermById(termId);
        if (!term) {
            res.status(404).json(error('Term not found'));
            return;
        }

        res.json(success(term));
    } catch (err) {
        next(err);
    }
}

/** POST /api/terms — Create new term with auto-calculation */
export async function createTerm(req: Request, res: Response, next: NextFunction) {
    try {
        const updatedBy = req.authUser?.firstname || req.authUser?.username || 'System';
        const data = req.body;

        // Run calculation engine
        const calcInput = toCalcInput(data);

        const calculated = calculate(calcInput);

        const termId = await termRepo.createTerm(data, calculated, updatedBy);
        const payload: TermMutationResponseDTO = { TermID: termId, ...calculated };
        writeAuditLog({ action: AuditAction.CREATE, entity: AuditEntity.TERM, entityId: termId, username: updatedBy });
        res.status(201).json(success(payload));
    } catch (err) {
        next(err);
    }
}

/** PUT /api/terms/:id — Update term with recalculation */
export async function updateTerm(req: Request, res: Response, next: NextFunction) {
    try {
        const { termId } = toTermIdParamDTO(req.params);
        if (termId === null) {
            res.status(400).json(error('Invalid TermID'));
            return;
        }

        const updatedBy = req.authUser?.firstname || req.authUser?.username || 'System';
        const data = req.body;

        // Recalculate
        const calcInput = toCalcInput(data);

        const calculated = calculate(calcInput);

        await termRepo.updateTerm(termId, data, calculated, updatedBy);
        const payload: TermMutationResponseDTO = { TermID: termId, ...calculated };
        writeAuditLog({ action: AuditAction.UPDATE, entity: AuditEntity.TERM, entityId: termId, username: updatedBy });
        res.json(success(payload, 'Term updated successfully'));
    } catch (err) {
        next(err);
    }
}

/** DELETE /api/terms/:id — Delete term */
export async function deleteTerm(req: Request, res: Response, next: NextFunction) {
    try {
        const { termId } = toTermIdParamDTO(req.params);
        if (termId === null) {
            res.status(400).json(error('Invalid TermID'));
            return;
        }

        const { confirmText, confirmTermId } = toTermDeleteBodyDTO(req.body);
        if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
            res.status(400).json(error('Invalid confirmText'));
            return;
        }
        if (confirmTermId === null || confirmTermId !== termId) {
            res.status(400).json(error('confirmTermId must match route TermID'));
            return;
        }

        const term = await termRepo.getTermById(termId);
        if (!term) {
            res.status(404).json(error('Term not found'));
            return;
        }

        if (!canDeleteOwnedRecordByActor(String(term.Updatedby || ''), req.authUser)) {
            res.status(403).json(error('You are not authorized to delete this term. Only owner, supervisor, or manager can delete it.'));
            return;
        }

        await termRepo.deleteTerm(termId);
        const username = req.authUser?.firstname || req.authUser?.username || 'System';
        writeAuditLog({ action: AuditAction.DELETE, entity: AuditEntity.TERM, entityId: termId, username });
        res.json(success(null, 'Term deleted successfully'));
    } catch (err) {
        next(err);
    }
}

/** POST /api/terms/calculate — Preview calculation without saving */
export async function previewCalculation(req: Request, res: Response, next: NextFunction) {
    try {
        const data = req.body;

        const calcInput = toCalcInput(data);

        const calculated = calculate(calcInput);
        res.json(success(calculated));
    } catch (err) {
        next(err);
    }
}

/** GET /api/terms/:id/vendor-email — Get vendor email for term */
export async function getVendorEmail(req: Request, res: Response, next: NextFunction) {
    try {
        const { termId } = toTermIdParamDTO(req.params);
        if (termId === null) {
            res.status(400).json(error('Invalid TermID'));
            return;
        }

        const data = await termRepo.getVendorEmail(termId);

        // Build mailto: URL for RFQ — always generate (empty To if no vendor email)
        const toAddr = data.email || '';
        const cc = env.RFQ_MAILTO_CC;
        const subject = env.RFQ_MAILTO_SUBJECT || 'RFQ#';
        const NL = '%0a';   // mailto newline

        // Helper: encode a value for mailto body (special chars safe, newlines → %0a)
        const enc = (s: string) =>
            encodeURIComponent(s).replace(/%0A/gi, NL).replace(/%0D/gi, '');

        const bodyParts = [
            enc(`Dear ${data.contactName || 'Sir/Madam'}`),
            NL,
            enc('Please quote for the following items ...'),
            NL,
            enc(`Brand: ${data.brand || ''}`),
            NL,
            enc(`Part No: ${data.catalogNo || ''}`),
            NL,
            enc(`Description: ${data.itemDescription || ''}`),
            NL,
            enc(`LongDesc: ${data.longDesc || ''}`),
            NL,
        ];

        const body = bodyParts.join(NL);
        const mailtoUrl = `mailto:${toAddr}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${body}`;

        const email: VendorEmailResponseDTO = { ...data, mailtoUrl };
        res.json(success(email));
    } catch (err) {
        next(err);
    }
}

/** GET /api/terms/:id/item-detail — Get item detail by TermID */
export async function getItemDetailByTerm(req: Request, res: Response, next: NextFunction) {
    try {
        const { termId } = toTermIdParamDTO(req.params);
        if (termId === null) {
            res.status(400).json(error('Invalid TermID'));
            return;
        }

        const item = await termRepo.getItemDetailByTermId(termId);
        if (!item) {
            res.status(404).json(error('Item not found for this term'));
            return;
        }
        res.json(success(item));
    } catch (err) {
        next(err);
    }
}

/** GET /api/terms/master-fg/:itemId — Get MasterFG by ItemID */
export async function getMasterFG(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toMasterFGParamsDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const masterFG = await termRepo.getMasterFGByItemId(itemId);
        const payload: MasterFGResponseDTO = { masterFG };
        res.json(success(payload));
    } catch (err) {
        next(err);
    }
}
