import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import { NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { InventoryRepository } from "./repository";
import { DEFAULT_LOCATION, INVENTORY_MODULE } from "./types";
import { applyInventoryMovement } from "./valuation";
import type { CreateAdjustmentInput, MovementQuery, StockQuery } from "./validation";

export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly audit: AuditWriter,
  ) {}

  async stock(organizationId: string, query: StockQuery) {
    return this.repository.listStock(organizationId, query);
  }

  async movements(organizationId: string, query: MovementQuery) {
    return this.repository.listMovements(organizationId, query);
  }

  async formOptions(organizationId: string) {
    return this.repository.formOptions(organizationId);
  }

  async adjust(organizationId: string, actorId: string, input: CreateAdjustmentInput, meta: RequestMeta) {
    const product = await this.repository.findProduct(organizationId, input.productId);
    if (!product) {
      throw new ValidationFailedError({ productId: ["Choose a valid product"] });
    }

    const location = input.location ?? product.receivingLocation ?? DEFAULT_LOCATION;
    const balance = await this.repository.findBalance(organizationId, product.id, location);
    const unitCost = input.unitCost ?? product.weightedAveragePrice.toString();
    const movement = applyInventoryMovement(
      balance,
      input.quantity,
      unitCost,
      product.allowNegativeStock,
    );

    const created = await this.repository.createAdjustment(organizationId, actorId, {
      productId: product.id,
      location,
      unitCost,
      movement,
    });
    if (!created) {
      throw new NotFoundError("Inventory adjustment not recorded");
    }

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "inventory.adjusted",
      module: INVENTORY_MODULE,
      entityType: "inventory-adjustment",
      entityId: created.id,
      newValues: {
        adjustmentId: created.id,
        productId: product.id,
        location,
        quantity: movement.delta,
        unitCost,
        averageCost: movement.averageCost,
        balanceAfter: movement.balanceAfter,
        reason: input.reason,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id: created.id,
      productId: product.id,
      location,
      quantity: movement.delta,
      unitCost,
      averageCost: movement.averageCost,
      balanceAfter: created.balanceAfter,
      reason: input.reason,
    };
  }
}
