import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { ContactsService } from "./service";
import type { ContactListQuery, UpdateContactInput } from "./validation";

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

function actorId(req: Request): string {
  if (!req.auth?.userId) {
    throw new UnauthorizedError();
  }
  return req.auth.userId;
}

export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as ContactListQuery;
    const page = await this.contactsService.listAll(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Contacts", data: page });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const contact = await this.contactsService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Contact", data: contact });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateContactInput;
    const contact = await this.contactsService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Contact updated", data: contact });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.contactsService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Contact deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const contact = await this.contactsService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Contact restored", data: contact });
  });
}
