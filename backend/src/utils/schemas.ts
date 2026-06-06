import { z } from "zod";
import {
  safeUsername,
  safeCrimeKey,
  safeUid,
  safeEmail,
  safeText,
  safeName,
  safeMessage,
  safeSearchQuery,
  safeCoercedInt,
  safeEnum,
  safeUuid,
  sanitizeString
} from "./sanitize";

const requiredReason = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "reason is required")
    .max(max, `Cannot exceed ${max} characters`)
    .transform(sanitizeString);

export const paginationQuery = z.object({
  page: safeCoercedInt(1, 10000).default(1),
  limit: safeCoercedInt(1, 100).default(20)
});

export const sortQuery = z.object({
  sort: z.string().max(50).optional(),
  order: safeEnum(["asc", "desc"]).default("desc")
});

export const searchQuery = z.object({
  q: safeSearchQuery
});

export const syncUserSchema = z.object({
  body: z.object({
    username: safeUsername.optional(),
    referral: safeUid.optional()
  })
});

export const checkUsernameSchema = z.object({
  params: z.object({
    username: safeUsername
  })
});

export const registerSchema = z.object({
  body: z.object({
    username: safeUsername,
    email: safeEmail.optional(),
    referral: safeUid.optional()
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: safeEmail
  })
});

export const attemptCrimeSchema = z.object({
  body: z.object({
    crimeKey: safeCrimeKey,
    idempotencyKey: safeUuid.optional()
  })
});

export const adminUidParamSchema = z.object({
  params: z.object({
    uid: safeUid
  })
});

export const adminBanSchema = z.object({
  params: z.object({
    uid: safeUid
  }),
  body: z.object({
    banType: safeEnum(["soft", "hard", "shadow"]),
    reason: requiredReason(500),
    expiresAt: z.string().datetime().optional(),
    durationDays: z.number().int().min(1).max(365).optional()
  })
});

export const adminAdjustMoneySchema = z.object({
  params: z.object({
    uid: safeUid
  }),
  body: z.object({
    amount: z.number().int().min(-1000000000).max(1000000000),
    reason: requiredReason(200)
  })
});

export const adminSearchSchema = z.object({
  query: z.object({
    ...paginationQuery.shape,
    q: safeSearchQuery.optional(),
    filter: z.string().max(50).optional()
  })
});

export const createSupportTicketSchema = z.object({
  body: z.object({
    subject: safeName(3, 100),
    category: safeEnum(["bug", "appeal", "billing", "other"]),
    message: safeMessage
  })
});

export const replyTicketSchema = z.object({
  params: z.object({
    ticketId: safeCoercedInt(1)
  }),
  body: z.object({
    message: safeMessage
  })
});

export const gdprDeleteSchema = z.object({
  body: z.object({
    confirmPhrase: z.literal("DELETE MY ACCOUNT"),
    reason: safeText(500).optional()
  })
});

export const createCheckoutSchema = z.object({
  body: z.object({
    priceId: z.string().min(1).max(100),
    quantity: safeCoercedInt(1, 100).optional().default(1)
  })
});

export const attackPlayerSchema = z.object({
  params: z.object({
    targetUid: safeUid
  }),
  body: z.object({
    weaponId: safeCoercedInt(1).optional()
  })
});

export const sendMessageSchema = z.object({
  body: z.object({
    recipientUid: safeUid,
    subject: safeName(1, 100),
    body: safeMessage
  })
});

export const marketListingSchema = z.object({
  body: z.object({
    itemId: safeCoercedInt(1),
    quantity: safeCoercedInt(1, 9999),
    price: safeCoercedInt(1, 1000000000)
  })
});

export const tradeSchema = z.object({
  params: z.object({
    targetUid: safeUid
  }),
  body: z.object({
    offeredItemIds: z.array(safeCoercedInt(1)).max(10),
    requestedItemIds: z.array(safeCoercedInt(1)).max(10),
    offeredMoney: safeCoercedInt(0, 1000000000).optional().default(0),
    requestedMoney: safeCoercedInt(0, 1000000000).optional().default(0)
  })
});

export const gangApplicationSchema = z.object({
  params: z.object({
    gangId: safeCoercedInt(1)
  }),
  body: z.object({
    message: safeText(300).optional()
  })
});

export type AttemptCrimeInput = z.infer<typeof attemptCrimeSchema>["body"];
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type SyncUserInput = z.infer<typeof syncUserSchema>["body"];
export type AdminBanInput = z.infer<typeof adminBanSchema>["body"];
export type SupportTicketInput = z.infer<typeof createSupportTicketSchema>["body"];
export type MarketListingInput = z.infer<typeof marketListingSchema>["body"];
export type SendMessageInput = z.infer<typeof sendMessageSchema>["body"];
