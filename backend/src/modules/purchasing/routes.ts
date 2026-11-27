import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requireAnyPermission, requirePermission } from "../../middleware/authorize";
import type { PurchasingController } from "./controller";
import {
  billListQuerySchema,
  changeOrderStatusSchema,
  createBillSchema,
  createOrderFromSalesOrderSchema,
  createOrderSchema,
  createPaymentSchema,
  createReceiptSchema,
  orderListQuerySchema,
  paymentListQuerySchema,
  purchasingIdParamSchema,
  receiptListQuerySchema,
  updateBillSchema,
  updateOrderSchema,
  updatePaymentSchema,
} from "./validation";

export function createPurchasingRouter(controller: PurchasingController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/orders", requirePermission("purchasing:read"), validate({ query: orderListQuerySchema }), controller.listOrders);
  router.get("/orders/form-options", requirePermission("purchasing:read"), controller.formOptions);
  router.post("/orders", requirePermission("purchasing:create"), validate({ body: createOrderSchema }), controller.createOrder);
  router.post(
    "/orders/from-sales-order",
    requirePermission("purchasing:create"),
    validate({ body: createOrderFromSalesOrderSchema }),
    controller.createOrderFromSalesOrder,
  );
  router.get("/orders/:id", requirePermission("purchasing:read"), validate({ params: purchasingIdParamSchema }), controller.getOrder);
  router.patch(
    "/orders/:id",
    requirePermission("purchasing:update"),
    validate({ params: purchasingIdParamSchema, body: updateOrderSchema }),
    controller.updateOrder,
  );
  router.delete(
    "/orders/:id",
    requirePermission("purchasing:delete"),
    validate({ params: purchasingIdParamSchema }),
    controller.removeOrder,
  );
  router.post(
    "/orders/:id/restore",
    requirePermission("purchasing:restore"),
    validate({ params: purchasingIdParamSchema }),
    controller.restoreOrder,
  );
  router.post(
    "/orders/:id/status",
    requireAnyPermission("purchasing:approve", "purchasing:update"),
    validate({ params: purchasingIdParamSchema, body: changeOrderStatusSchema }),
    controller.changeOrderStatus,
  );

  router.get(
    "/receipts",
    requirePermission("purchasing:read"),
    validate({ query: receiptListQuerySchema }),
    controller.listReceipts,
  );
  router.post(
    "/receipts",
    requirePermission("purchasing:create"),
    validate({ body: createReceiptSchema }),
    controller.createReceipt,
  );
  router.get(
    "/receipts/:id",
    requirePermission("purchasing:read"),
    validate({ params: purchasingIdParamSchema }),
    controller.getReceipt,
  );
  router.post(
    "/receipts/:id/post",
    requireAnyPermission("purchasing:approve", "inventory:manage"),
    validate({ params: purchasingIdParamSchema }),
    controller.postReceipt,
  );
  router.delete(
    "/receipts/:id",
    requirePermission("purchasing:delete"),
    validate({ params: purchasingIdParamSchema }),
    controller.removeReceipt,
  );
  router.post(
    "/receipts/:id/restore",
    requirePermission("purchasing:restore"),
    validate({ params: purchasingIdParamSchema }),
    controller.restoreReceipt,
  );
  router.post(
    "/receipts/:id/cancel",
    requireAnyPermission("purchasing:approve", "purchasing:update"),
    validate({ params: purchasingIdParamSchema }),
    controller.cancelReceipt,
  );

  router.get("/bills", requirePermission("purchasing:read"), validate({ query: billListQuerySchema }), controller.listBills);
  router.get("/bills/form-options", requirePermission("purchasing:read"), controller.billFormOptions);
  router.post("/bills", requirePermission("purchasing:create"), validate({ body: createBillSchema }), controller.createBill);
  router.get("/bills/:id", requirePermission("purchasing:read"), validate({ params: purchasingIdParamSchema }), controller.getBill);
  router.patch(
    "/bills/:id",
    requirePermission("purchasing:update"),
    validate({ params: purchasingIdParamSchema, body: updateBillSchema }),
    controller.updateBill,
  );
  router.post(
    "/bills/:id/approve",
    requirePermission("purchasing:approve"),
    validate({ params: purchasingIdParamSchema }),
    controller.approveBill,
  );
  router.post(
    "/bills/:id/void",
    requirePermission("purchasing:approve"),
    validate({ params: purchasingIdParamSchema }),
    controller.voidBill,
  );
  router.delete(
    "/bills/:id",
    requirePermission("purchasing:delete"),
    validate({ params: purchasingIdParamSchema }),
    controller.removeBill,
  );
  router.post(
    "/bills/:id/restore",
    requirePermission("purchasing:restore"),
    validate({ params: purchasingIdParamSchema }),
    controller.restoreBill,
  );

  router.get(
    "/payments",
    requirePermission("purchasing:read"),
    validate({ query: paymentListQuerySchema }),
    controller.listPayments,
  );
  router.get("/payments/form-options", requirePermission("purchasing:read"), controller.paymentFormOptions);
  router.post(
    "/payments",
    requirePermission("purchasing:create"),
    validate({ body: createPaymentSchema }),
    controller.createPayment,
  );
  router.get(
    "/payments/:id",
    requirePermission("purchasing:read"),
    validate({ params: purchasingIdParamSchema }),
    controller.getPayment,
  );
  router.patch(
    "/payments/:id",
    requirePermission("purchasing:update"),
    validate({ params: purchasingIdParamSchema, body: updatePaymentSchema }),
    controller.updatePayment,
  );
  router.post(
    "/payments/:id/approve",
    requirePermission("purchasing:approve"),
    validate({ params: purchasingIdParamSchema }),
    controller.approvePayment,
  );
  router.delete(
    "/payments/:id",
    requirePermission("purchasing:delete"),
    validate({ params: purchasingIdParamSchema }),
    controller.removePayment,
  );
  router.post(
    "/payments/:id/restore",
    requirePermission("purchasing:restore"),
    validate({ params: purchasingIdParamSchema }),
    controller.restorePayment,
  );
  router.post(
    "/payments/:id/cancel",
    requireAnyPermission("purchasing:approve", "purchasing:update"),
    validate({ params: purchasingIdParamSchema }),
    controller.cancelPayment,
  );

  return router;
}
