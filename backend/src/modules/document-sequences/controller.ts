import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { DocumentSequencesService } from "./service";

export class DocumentSequencesController {
  constructor(private readonly documentSequencesService: DocumentSequencesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const query = req.validated?.query as { year?: number };
    const year = query.year ?? new Date().getUTCFullYear();
    const sequences = await this.documentSequencesService.list(req.auth.organizationId, year);
    sendSuccess(res, { message: "Document sequences", data: sequences });
  });
}
