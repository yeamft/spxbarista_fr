import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const staffRoleSchema = z.string().min(1);

const staffMutationSchema = z.object({
  accessToken: z.string().optional(),
  email: z.string().trim().optional(),
  name: z.string().trim().min(1),
  role: staffRoleSchema,
  branch: z.string().trim().min(1),
  staffSalesAll: z.boolean().optional(),
  assignedStore: z.enum(["Store 1", "Store 2"]).optional(),
  assignedInventoryLocations: z.array(z.string()).optional(),
  password: z.string(),
});

export const createSupabaseStaffUser = createServerFn({ method: "POST" })
  .validator(staffMutationSchema)
  .handler(async () => {
    throw new Error("Staff users are managed via the Express API (/api/auth/register).");
  });

export const updateSupabaseStaffUser = createServerFn({ method: "POST" })
  .validator(staffMutationSchema.extend({ id: z.string().min(1) }))
  .handler(async () => {
    throw new Error("Staff users are managed via the Express API.");
  });

export const deactivateSupabaseStaffUser = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), accessToken: z.string().optional() }))
  .handler(async () => {
    throw new Error("Staff users are managed via the Express API.");
  });
