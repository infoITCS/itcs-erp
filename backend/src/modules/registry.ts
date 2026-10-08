import type { AppModule, ModuleDependencies } from "./module";
import { createAuthModule } from "./auth";
import { createUsersModule } from "./users";
import { createRolesModule } from "./roles";
import { createPermissionsModule } from "./permissions";
import { createCustomersModule } from "./customers";
import { createContactsModule } from "./contacts";
import { createProductsModules } from "./products";
import { createResellersModules } from "./resellers";
import { createOpportunitiesModule } from "./opportunities";
import { createTendersModule } from "./tenders";
import { createQuotesModule } from "./quotes";
import { createSalesOrdersModule } from "./sales-orders";
import { createDeliveriesModule } from "./deliveries";
import { createInvoicesModule } from "./invoices";
import { createPaymentsModule } from "./payments";
import { createCurrenciesModule } from "./currencies";
import { createDocumentSequencesModule } from "./document-sequences";
import { createOrganizationsModule } from "./organizations";
import { createPurchasingModule } from "./purchasing";
import { createVendorsModule } from "./vendors";
import { createInventoryModule } from "./inventory";
import { createAccountingModule } from "./accounting";
import { createExpensesModule } from "./expenses";
import { createProjectsModule } from "./projects";
import { createTasksModule } from "./tasks";
import { createRenewalsModule } from "./renewals";
import { createReportsModule } from "./reports";
import { createNotificationsModule } from "./notifications";
import { createAuditLogsModule } from "./audit-logs";

export function createModules(deps: ModuleDependencies): AppModule[] {
  return [
    createAuthModule(deps),
    createUsersModule(deps),
    createRolesModule(deps),
    createPermissionsModule(deps),
    createCustomersModule(deps),
    createContactsModule(deps),
    ...createProductsModules(deps),
    ...createResellersModules(deps),
    createOpportunitiesModule(deps),
    createTendersModule(deps),
    createQuotesModule(deps),
    createSalesOrdersModule(deps),
    createDeliveriesModule(deps),
    createInvoicesModule(deps),
    createPaymentsModule(deps),
    createCurrenciesModule(deps),
    createDocumentSequencesModule(deps),
    createOrganizationsModule(deps),
    createPurchasingModule(deps),
    createVendorsModule(deps),
    createInventoryModule(deps),
    createAccountingModule(deps),
    createExpensesModule(deps),
    createProjectsModule(deps),
    createTasksModule(deps),
    createRenewalsModule(deps),
    createReportsModule(deps),
    createNotificationsModule(deps),
    createAuditLogsModule(deps),
  ];
}
