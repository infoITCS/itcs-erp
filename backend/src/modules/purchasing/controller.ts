import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import { DEFAULT_EXPENSE_ACCOUNT, DEFAULT_LIABILITY_ACCOUNT } from "./types";
import type { PurchasingService } from "./service";
import type {
  ChangeOrderStatusInput,
  CreateBillInput,
  CreateOrderFromSalesOrderInput,
  CreateOrderInput,
  CreatePaymentInput,
  CreateReceiptInput,
  UpdateBillInput,
  UpdateOrderInput,
  UpdatePaymentInput,
} from "./validation";

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

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

function permissions(req: Request): string[] {
  return req.auth?.permissions ?? [];
}

function id(req: Request): string {
  return (req.validated?.params as { id: string }).id;
}

export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  listOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.purchasingService.listOrders(
      organizationId(req),
      req.validated?.query as Parameters<PurchasingService["listOrders"]>[1],
      permissions(req),
    );
    sendSuccess(res, { message: "Purchase orders", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.purchasingService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Purchasing form options", data: options });
  });

  billFormOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.purchasingService.formOptions(organizationId(req));
    sendSuccess(res, {
      message: "Vendor bill form options",
      data: {
        vendors: options.vendors,
        currencies: options.currencies,
        paymentTerms: options.paymentTerms,
        taxCodes: options.taxCodes,
        products: options.products,
        purchaseOrders: options.orders,
        expenseAccounts: [DEFAULT_EXPENSE_ACCOUNT],
        liabilityAccounts: [DEFAULT_LIABILITY_ACCOUNT],
        statuses: options.billStatuses,
      },
    });
  });

  paymentFormOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.purchasingService.formOptions(organizationId(req));
    sendSuccess(res, {
      message: "Vendor payment form options",
      data: {
        vendors: options.vendors,
        currencies: options.currencies,
        bills: options.bills,
        methods: options.paymentMethods,
        statuses: options.paymentStatuses,
      },
    });
  });

  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.purchasingService.createOrder(
      organizationId(req),
      actorId(req),
      req.validated?.body as CreateOrderInput,
      meta(req),
    );
    sendSuccess(res, { message: "Purchase order created", data: order }, 201);
  });

  createOrderFromSalesOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.purchasingService.createOrderFromSalesOrder(
      organizationId(req),
      actorId(req),
      req.validated?.body as CreateOrderFromSalesOrderInput,
      meta(req),
    );
    sendSuccess(res, { message: "Purchase order created from sales order", data: order }, 201);
  });

  getOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.purchasingService.getOrder(organizationId(req), id(req));
    sendSuccess(res, { message: "Purchase order", data: order });
  });

  updateOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.purchasingService.updateOrder(
      organizationId(req),
      actorId(req),
      id(req),
      req.validated?.body as UpdateOrderInput,
      meta(req),
    );
    sendSuccess(res, { message: "Purchase order updated", data: order });
  });

  removeOrder = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.purchasingService.removeOrder(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Purchase order deleted", data: result });
  });

  restoreOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.purchasingService.restoreOrder(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Purchase order restored", data: order });
  });

  changeOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.purchasingService.changeOrderStatus(
      organizationId(req),
      actorId(req),
      id(req),
      req.validated?.body as ChangeOrderStatusInput,
      meta(req),
      permissions(req),
    );
    sendSuccess(res, { message: "Purchase order status updated", data: order });
  });

  listReceipts = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.purchasingService.listReceipts(
      organizationId(req),
      req.validated?.query as Parameters<PurchasingService["listReceipts"]>[1],
      permissions(req),
    );
    sendSuccess(res, { message: "Goods receipts", data: page });
  });

  getReceipt = asyncHandler(async (req: Request, res: Response) => {
    const receipt = await this.purchasingService.getReceipt(organizationId(req), id(req));
    sendSuccess(res, { message: "Goods receipt", data: receipt });
  });

  createReceipt = asyncHandler(async (req: Request, res: Response) => {
    const receipt = await this.purchasingService.createReceipt(
      organizationId(req),
      actorId(req),
      req.validated?.body as CreateReceiptInput,
      meta(req),
    );
    sendSuccess(res, { message: "Goods receipt created", data: receipt }, 201);
  });

  postReceipt = asyncHandler(async (req: Request, res: Response) => {
    const receipt = await this.purchasingService.postReceipt(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Goods receipt posted", data: receipt });
  });

  removeReceipt = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.purchasingService.removeReceipt(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Goods receipt deleted", data: result });
  });

  restoreReceipt = asyncHandler(async (req: Request, res: Response) => {
    const receipt = await this.purchasingService.restoreReceipt(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Goods receipt restored", data: receipt });
  });

  cancelReceipt = asyncHandler(async (req: Request, res: Response) => {
    const receipt = await this.purchasingService.cancelReceipt(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Goods receipt cancelled", data: receipt });
  });

  listBills = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.purchasingService.listBills(
      organizationId(req),
      req.validated?.query as Parameters<PurchasingService["listBills"]>[1],
      permissions(req),
    );
    sendSuccess(res, { message: "Vendor bills", data: page });
  });

  getBill = asyncHandler(async (req: Request, res: Response) => {
    const bill = await this.purchasingService.getBill(organizationId(req), id(req));
    sendSuccess(res, { message: "Vendor bill", data: bill });
  });

  createBill = asyncHandler(async (req: Request, res: Response) => {
    const bill = await this.purchasingService.createBill(
      organizationId(req),
      actorId(req),
      req.validated?.body as CreateBillInput,
      meta(req),
    );
    sendSuccess(res, { message: "Vendor bill created", data: bill }, 201);
  });

  updateBill = asyncHandler(async (req: Request, res: Response) => {
    const bill = await this.purchasingService.updateBill(
      organizationId(req),
      actorId(req),
      id(req),
      req.validated?.body as UpdateBillInput,
      meta(req),
    );
    sendSuccess(res, { message: "Vendor bill updated", data: bill });
  });

  approveBill = asyncHandler(async (req: Request, res: Response) => {
    const bill = await this.purchasingService.approveBill(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor bill approved", data: bill });
  });

  voidBill = asyncHandler(async (req: Request, res: Response) => {
    const bill = await this.purchasingService.voidBill(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor bill voided", data: bill });
  });

  removeBill = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.purchasingService.removeBill(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor bill deleted", data: result });
  });

  restoreBill = asyncHandler(async (req: Request, res: Response) => {
    const bill = await this.purchasingService.restoreBill(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor bill restored", data: bill });
  });

  listPayments = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.purchasingService.listPayments(
      organizationId(req),
      req.validated?.query as Parameters<PurchasingService["listPayments"]>[1],
      permissions(req),
    );
    sendSuccess(res, { message: "Vendor payments", data: page });
  });

  getPayment = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.purchasingService.getPayment(organizationId(req), id(req));
    sendSuccess(res, { message: "Vendor payment", data: payment });
  });

  createPayment = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.purchasingService.createPayment(
      organizationId(req),
      actorId(req),
      req.validated?.body as CreatePaymentInput,
      meta(req),
    );
    sendSuccess(res, { message: "Vendor payment created", data: payment }, 201);
  });

  updatePayment = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.purchasingService.updatePayment(
      organizationId(req),
      actorId(req),
      id(req),
      req.validated?.body as UpdatePaymentInput,
      meta(req),
    );
    sendSuccess(res, { message: "Vendor payment updated", data: payment });
  });

  approvePayment = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.purchasingService.approvePayment(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor payment approved", data: payment });
  });

  removePayment = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.purchasingService.removePayment(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor payment deleted", data: result });
  });

  restorePayment = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.purchasingService.restorePayment(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor payment restored", data: payment });
  });

  cancelPayment = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.purchasingService.cancelPayment(organizationId(req), actorId(req), id(req), meta(req));
    sendSuccess(res, { message: "Vendor payment cancelled", data: payment });
  });
}
