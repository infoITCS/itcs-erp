import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { ContactsService } from "../contacts/service";
import type { ContactBody, ContactListQuery } from "../contacts/validation";
import type { CustomersService } from "./service";
import type { AddressInput, CreateCustomerInput, CustomerListQuery, UpdateCustomerInput } from "./validation";

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

export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly contactsService: ContactsService,
  ) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as CustomerListQuery;
    const page = await this.customersService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Customers", data: page });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const customer = await this.customersService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Customer", data: customer });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateCustomerInput;
    const result = await this.customersService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Customer created", data: result }, 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateCustomerInput;
    const customer = await this.customersService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Customer updated", data: customer });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.customersService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Customer deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const customer = await this.customersService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Customer restored", data: customer });
  });

  listAddresses = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const addresses = await this.customersService.listAddresses(organizationId(req), params.id);
    sendSuccess(res, { message: "Addresses", data: addresses });
  });

  createAddress = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as AddressInput;
    const address = await this.customersService.createAddress(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Address created", data: address }, 201);
  });

  updateAddress = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; addressId: string };
    const body = req.validated?.body as AddressInput;
    const address = await this.customersService.updateAddress(
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
    const result = await this.customersService.removeAddress(
      organizationId(req),
      actorId(req),
      params.id,
      params.addressId,
      meta(req),
    );
    sendSuccess(res, { message: "Address deleted", data: result });
  });

  listContacts = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { customerId: string };
    const query = req.validated?.query as ContactListQuery;
    const page = await this.contactsService.list(organizationId(req), params.customerId, query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Contacts", data: page });
  });

  createContact = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { customerId: string };
    const body = req.validated?.body as ContactBody;
    const contact = await this.contactsService.create(organizationId(req), actorId(req), params.customerId, body, meta(req));
    sendSuccess(res, { message: "Contact created", data: contact }, 201);
  });
}
