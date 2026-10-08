import "dotenv/config";
import { AccountStatus, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { DOCUMENT_PREFIX, DOCUMENT_TYPES } from "../src/common/numbering/format";
import { hashPassword } from "../src/modules/auth/password";
import {
  PHASE1_PERMISSION_CODES,
  PHASE1_PERMISSIONS,
  VIEWER_PERMISSION_CODES,
} from "../src/modules/permissions/catalog";
import { permissionCode } from "../src/modules/permissions/types";

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminFirstName = process.env.ADMIN_FIRST_NAME?.trim() || "System";
const adminLastName = process.env.ADMIN_LAST_NAME?.trim() || "Admin";

if (!adminEmail || !adminPassword || adminPassword.length < 12) {
  throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before seeding");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set DATABASE_URL before seeding");
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });

const currencies = [
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", decimalPlaces: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimalPlaces: 2 },
];

const rates = [
  { base: "PKR", quote: "PKR", rate: "1.00000000" },
  { base: "USD", quote: "PKR", rate: "278.50000000" },
  { base: "EUR", quote: "PKR", rate: "302.25000000" },
  { base: "GBP", quote: "PKR", rate: "358.75000000" },
  { base: "AED", quote: "PKR", rate: "75.85000000" },
];

async function main(): Promise<void> {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name, symbol: currency.symbol, decimalPlaces: currency.decimalPlaces, isActive: true },
      create: { ...currency, isActive: true },
    });
  }

  const organization = await prisma.organization.upsert({
    where: { code: "ITCS" },
    update: { name: "ITCS", status: "ACTIVE", baseCurrencyCode: "PKR" },
    create: { code: "ITCS", name: "ITCS", baseCurrencyCode: "PKR", status: "ACTIVE" },
  });

  for (const permission of PHASE1_PERMISSIONS) {
    const code = permissionCode(permission.module, permission.action);
    await prisma.permission.upsert({
      where: { code },
      update: { description: permission.description, module: permission.module, action: permission.action },
      create: { code, module: permission.module, action: permission.action, description: permission.description },
    });
  }

  const permissionRows = await prisma.permission.findMany({
    where: { code: { in: [...PHASE1_PERMISSION_CODES] } },
    select: { id: true, code: true },
  });
  const permissionId = new Map(permissionRows.map((row) => [row.code, row.id]));

  const adminRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "admin" } },
    update: { name: "Administrator", description: "Full access to Phase 1 modules", isSystem: true },
    create: {
      organizationId: organization.id,
      code: "admin",
      name: "Administrator",
      description: "Full access to Phase 1 modules",
      isSystem: true,
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "viewer" } },
    update: { name: "Viewer", description: "Read-only access to Phase 1 modules", isSystem: true },
    create: {
      organizationId: organization.id,
      code: "viewer",
      name: "Viewer",
      description: "Read-only access to Phase 1 modules",
      isSystem: true,
    },
  });

  await replaceRolePermissions(adminRole.id, PHASE1_PERMISSION_CODES, permissionId);
  await replaceRolePermissions(viewerRole.id, VIEWER_PERMISSION_CODES, permissionId);

  const passwordHash = await hashPassword(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      status: AccountStatus.ACTIVE,
      failedLoginCount: 0,
      lockedAt: null,
      passwordChangedAt: new Date(),
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      status: AccountStatus.ACTIVE,
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: admin.id } },
    update: { status: AccountStatus.ACTIVE },
    create: { organizationId: organization.id, userId: admin.id, status: AccountStatus.ACTIVE },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const effectiveDate = new Date("2026-01-01T00:00:00.000Z");
  for (const rate of rates) {
    await prisma.exchangeRate.upsert({
      where: {
        organizationId_baseCurrencyCode_quoteCurrencyCode_effectiveDate: {
          organizationId: organization.id,
          baseCurrencyCode: rate.base,
          quoteCurrencyCode: rate.quote,
          effectiveDate,
        },
      },
      update: { rate: rate.rate, source: "seed", isActive: true },
      create: {
        organizationId: organization.id,
        baseCurrencyCode: rate.base,
        quoteCurrencyCode: rate.quote,
        rate: rate.rate,
        effectiveDate,
        source: "seed",
        isActive: true,
      },
    });
  }

  const year = 2026;
  for (const documentType of DOCUMENT_TYPES) {
    await prisma.documentSequence.upsert({
      where: {
        organizationId_documentType_year: {
          organizationId: organization.id,
          documentType,
          year,
        },
      },
      update: { prefix: DOCUMENT_PREFIX[documentType] },
      create: {
        organizationId: organization.id,
        documentType,
        prefix: DOCUMENT_PREFIX[documentType],
        nextNumber: 1,
        padding: 5,
        year,
      },
    });
  }

  const defaultUoms = [
    { code: "EACH", name: "Each" },
    { code: "HOUR", name: "Hour" },
    { code: "DAY", name: "Day" },
    { code: "MONTH", name: "Month" },
    { code: "LICENSE", name: "License" },
    { code: "KG", name: "Kilogram" },
    { code: "BOX", name: "Box" },
  ];
  for (const uom of defaultUoms) {
    await prisma.unitOfMeasure.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: uom.code } },
      update: { name: uom.name, isActive: true },
      create: { organizationId: organization.id, code: uom.code, name: uom.name, isActive: true },
    });
  }

  const defaultTaxCodes = [
    { code: "ZERO", name: "Zero rated", rate: "0.0000" },
    { code: "STD", name: "Standard VAT", rate: "17.0000" },
    { code: "EXEMPT", name: "Exempt", rate: "0.0000" },
  ];
  for (const tax of defaultTaxCodes) {
    await prisma.taxCode.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: tax.code } },
      update: { name: tax.name, rate: tax.rate, isActive: true },
      create: {
        organizationId: organization.id,
        code: tax.code,
        name: tax.name,
        rate: tax.rate,
        isActive: true,
      },
    });
  }
}

async function replaceRolePermissions(
  roleId: string,
  codes: readonly string[],
  permissionId: Map<string, string>,
): Promise<void> {
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.rolePermission.createMany({
    data: codes.map((code) => ({
      roleId,
      permissionId: permissionId.get(code) as string,
    })),
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
