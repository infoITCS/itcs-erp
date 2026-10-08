import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { ResellersService } from "./service";
import type {
  AddressInput,
  ContactBody,
  ContactListQuery,
  CreateResellerInput,
  ResellerListQuery,
  UpdateContactInput,
  UpdateResellerInput,
} from "./validation";

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

export class ResellersController {
  constructor(private readonly resellersService: ResellersService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as ResellerListQuery;
    const page = await this.resellersService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Resellers", data: page });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const reseller = await this.resellersService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Reseller", data: reseller });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateResellerInput;
    const reseller = await this.resellersService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Reseller created", data: reseller }, 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateResellerInput;
    const reseller = await this.resellersService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Reseller updated", data: reseller });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.resellersService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Reseller deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const reseller = await this.resellersService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Reseller restored", data: reseller });
  });

  listAddresses = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const addresses = await this.resellersService.listAddresses(organizationId(req), params.id);
    sendSuccess(res, { message: "Addresses", data: addresses });
  });

  createAddress = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as AddressInput;
    const address = await this.resellersService.createAddress(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Address created", data: address }, 201);
  });

  updateAddress = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; addressId: string };
    const body = req.validated?.body as AddressInput;
    const address = await this.resellersService.updateAddress(
      organizationId(req),
      actorId(req),
      params.id,
      params.addressId,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Address updated", data: address });
  });

  removeAddress = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; addressId: string };
    const result = await this.resellersService.removeAddress(
      organizationId(req),
      actorId(req),
      params.id,
      params.addressId,
      meta(req),
    );
    sendSuccess(res, { message: "Address deleted", data: result });
  });

  listContacts = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ContactListQuery;
    const page = await this.resellersService.listContacts(
      organizationId(req),
      params.id,
      query,
      req.auth?.permissions ?? [],
    );
    sendSuccess(res, { message: "Contacts", data: page });
  });

  createContact = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ContactBody;
    const contact = await this.resellersService.createContact(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Contact created", data: contact }, 201);
  });

  updateContact = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateContactInput;
    const contact = await this.resellersService.updateContact(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Contact updated", data: contact });
  });

  removeContact = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.resellersService.removeContact(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Contact deleted", data: result });
  });

  listCustomers = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ContactListQuery;
    const page = await this.resellersService.listCustomers(organizationId(req), params.id, query.limit, query.cursor);
    sendSuccess(res, { message: "Customers", data: page });
  });

  assignCustomer = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; customerId: string };
    const customer = await this.resellersService.assignCustomer(
      organizationId(req),
      actorId(req),
      params.id,
      params.customerId,
      meta(req),
    );
    sendSuccess(res, { message: "Customer assigned", data: customer });
  });

  unassignCustomer = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; customerId: string };
    const result = await this.resellersService.unassignCustomer(
      organizationId(req),
      actorId(req),
      params.id,
      params.customerId,
      meta(req),
    );
    sendSuccess(res, { message: "Customer unassigned", data: result });
  });
}
