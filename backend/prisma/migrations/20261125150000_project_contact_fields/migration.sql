ALTER TABLE "projects"
    ADD COLUMN "contact_id" UUID,
    ADD COLUMN "customer_contact_name" VARCHAR(120),
    ADD COLUMN "customer_contact_email" VARCHAR(320),
    ADD COLUMN "customer_contact_phone" VARCHAR(40),
    ADD COLUMN "supplier_company" VARCHAR(200),
    ADD COLUMN "supplier_contact_name" VARCHAR(120),
    ADD COLUMN "supplier_contact_email" VARCHAR(320),
    ADD COLUMN "supplier_contact_phone" VARCHAR(40);

ALTER TABLE "projects" ADD CONSTRAINT "projects_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON UPDATE CASCADE ON DELETE SET NULL;
