import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const persistenceSchema = z.object({
  accessToken: z.string().optional(),
  menuItems: z.array(z.unknown()).optional(),
  menuCategories: z.array(z.string()).optional(),
  tables: z.array(z.unknown()).optional(),
  orders: z.array(z.unknown()).optional(),
  stations: z.array(z.string()).optional(),
  stock: z.array(z.unknown()).optional(),
  suppliers: z.array(z.unknown()).optional(),
  reservations: z.array(z.unknown()).optional(),
  customers: z.array(z.unknown()).optional(),
  payments: z.array(z.unknown()).optional(),
  salesRecords: z.array(z.unknown()).optional(),
  expenseRecords: z.array(z.unknown()).optional(),
  purchaseOrders: z.array(z.unknown()).optional(),
  guestOrderRequests: z.array(z.unknown()).optional(),
  restaurantProfile: z.unknown().optional(),
});

/** No-op persistence — Express/Mongo API is the backend now. */
export const persistPosRecords = createServerFn({ method: "POST" })
  .validator(persistenceSchema)
  .handler(async () => ({ ok: true as const }));
