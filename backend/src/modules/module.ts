import type { PrismaClient } from "@prisma/client";
import type { Router } from "express";

export interface ModuleDependencies {
  db: PrismaClient;
  readDb: PrismaClient;
}

export interface AppModule {
  name: string;
  basePath: string;
  router: Router;
}
