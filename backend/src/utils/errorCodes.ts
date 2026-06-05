// ============================================================
// ERROR CODES
// Numeric codes for frontend to handle specific errors
// Format: ERR_CATEGORY_DETAIL
// Frontend can switch on code for specific UI behaviour
// ============================================================

export const ERROR_CODES = {

  // ── Auth (1xxx) ──────────────────────────────────────────
  ERR_AUTH_NO_TOKEN:         { code: "ERR_1001", http: 401, message: "No token provided"              },
  ERR_AUTH_INVALID_TOKEN:    { code: "ERR_1002", http: 401, message: "Invalid or expired token"       },
  ERR_AUTH_REVOKED:          { code: "ERR_1003", http: 401, message: "Session revoked. Sign in again" },
  ERR_AUTH_FORBIDDEN:        { code: "ERR_1004", http: 403, message: "Access denied"                  },
  ERR_AUTH_NOT_ADMIN:        { code: "ERR_1005", http: 403, message: "Admin access required"          },

  // ── User (2xxx) ──────────────────────────────────────────
  ERR_USER_NOT_FOUND:        { code: "ERR_2001", http: 404, message: "User not found"                 },
  ERR_USER_USERNAME_TAKEN:   { code: "ERR_2002", http: 409, message: "Username is already taken"      },
  ERR_USER_BANNED:           { code: "ERR_2003", http: 403, message: "Account suspended"              },
  ERR_USER_DELETED:          { code: "ERR_2004", http: 410, message: "Account has been deleted"       },

  // ── Crime (3xxx) ─────────────────────────────────────────
  ERR_CRIME_NOT_FOUND:       { code: "ERR_3001", http: 404, message: "Crime not found"                },
  ERR_CRIME_LOCKED:          { code: "ERR_3002", http: 403, message: "Crime not unlocked yet"         },
  ERR_CRIME_NO_NERVE:        { code: "ERR_3003", http: 422, message: "Not enough nerve"               },
  ERR_CRIME_IN_JAIL:         { code: "ERR_3004", http: 423, message: "You are in jail"                },
  ERR_CRIME_IN_FED_JAIL:     { code: "ERR_3005", http: 423, message: "You are in federal jail"        },
  ERR_CRIME_COOLDOWN:        { code: "ERR_3006", http: 429, message: "Crime on cooldown"              },

  // ── Jail (4xxx) ──────────────────────────────────────────
  ERR_JAIL_NOT_IN_JAIL:      { code: "ERR_4001", http: 400, message: "You are not in jail"            },
  ERR_JAIL_BAIL_TOO_LOW:     { code: "ERR_4002", http: 422, message: "Not enough money for bail"      },
  ERR_JAIL_BUST_FAILED:      { code: "ERR_4003", http: 422, message: "Bust attempt failed"            },

  // ── Gym (5xxx) ───────────────────────────────────────────
  ERR_GYM_NO_ENERGY:         { code: "ERR_5001", http: 422, message: "Not enough energy to train"     },
  ERR_GYM_INVALID_STAT:      { code: "ERR_5002", http: 400, message: "Invalid stat to train"          },
  ERR_GYM_IN_HOSPITAL:       { code: "ERR_5003", http: 423, message: "Cannot train while in hospital" },

  // ── Market (6xxx) ────────────────────────────────────────
  ERR_MARKET_NOT_FOUND:      { code: "ERR_6001", http: 404, message: "Listing not found"              },
  ERR_MARKET_NO_MONEY:       { code: "ERR_6002", http: 422, message: "Not enough money"               },
  ERR_MARKET_OWN_LISTING:    { code: "ERR_6003", http: 400, message: "Cannot buy your own listing"    },
  ERR_MARKET_SOLD:           { code: "ERR_6004", http: 410, message: "Item already sold"              },

  // ── Gang (7xxx) ──────────────────────────────────────────
  ERR_GANG_NOT_FOUND:        { code: "ERR_7001", http: 404, message: "Gang not found"                 },
  ERR_GANG_ALREADY_IN:       { code: "ERR_7002", http: 409, message: "Already in a gang"              },
  ERR_GANG_NOT_IN:           { code: "ERR_7003", http: 400, message: "Not in a gang"                  },
  ERR_GANG_NOT_LEADER:       { code: "ERR_7004", http: 403, message: "Only the gang leader can do this"},
  ERR_GANG_NAME_TAKEN:       { code: "ERR_7005", http: 409, message: "Gang name already taken"        },

  // ── PvP (8xxx) ───────────────────────────────────────────
  ERR_PVP_SELF_ATTACK:       { code: "ERR_8001", http: 400, message: "Cannot attack yourself"         },
  ERR_PVP_TARGET_NOT_FOUND:  { code: "ERR_8002", http: 404, message: "Target player not found"        },
  ERR_PVP_NO_NERVE:          { code: "ERR_8003", http: 422, message: "Not enough nerve to attack"     },
  ERR_PVP_IN_JAIL:           { code: "ERR_8004", http: 423, message: "Cannot attack while in jail"    },
  ERR_PVP_TARGET_IN_JAIL:    { code: "ERR_8005", http: 422, message: "Target is in jail"              },
  ERR_PVP_TRUCE:             { code: "ERR_8006", http: 429, message: "Attack cooldown active"         },

  // ── Security (9xxx) ──────────────────────────────────────
  ERR_SEC_RATE_LIMIT:        { code: "ERR_9001", http: 429, message: "Too many requests"              },
  ERR_SEC_CHALLENGE:         { code: "ERR_9002", http: 403, message: "Security check failed"          },
  ERR_SEC_TURNSTILE:         { code: "ERR_9003", http: 403, message: "Bot verification failed"        },
  ERR_SEC_HONEYPOT:          { code: "ERR_9004", http: 404, message: "Not found"                      },
  ERR_SEC_IDEMPOTENCY:       { code: "ERR_9005", http: 400, message: "Invalid idempotency key"        },

  // ── Validation (10xxx) ───────────────────────────────────
  ERR_VALIDATION:            { code: "ERR_10001", http: 400, message: "Validation failed"             },
  ERR_NOT_FOUND:             { code: "ERR_10002", http: 404, message: "Resource not found"            },
  ERR_CONFLICT:              { code: "ERR_10003", http: 409, message: "Resource conflict"             },
  ERR_INTERNAL:              { code: "ERR_10004", http: 500, message: "Internal server error"         },

} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
export type ErrorCodeValue = typeof ERROR_CODES[ErrorCodeKey];
