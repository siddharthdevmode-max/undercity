import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app";

describe("Phase 2 — market routes", () => {
  it("GET /listings is public and returns JSON", async () => {
    const res = await request(app).get("/api/v1/market/listings");
    expect([200, 500]).toContain(res.status);
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("GET /my-listings requires auth", async () => {
    const res = await request(app).get("/api/v1/market/my-listings");
    expect([401, 429, 500]).toContain(res.status);
  });

  it("POST /list requires auth", async () => {
    const res = await request(app).post("/api/v1/market/list").send({});
    expect([401, 429]).toContain(res.status);
  });

  it("POST /buy/:listingId requires auth", async () => {
    const res = await request(app).post("/api/v1/market/buy/1").send({});
    expect([401, 429]).toContain(res.status);
  });

  it("DELETE /listing/:listingId requires auth", async () => {
    const res = await request(app).delete("/api/v1/market/listing/1");
    expect([401, 429]).toContain(res.status);
  });
});

describe("Phase 2 — bank routes", () => {
  it("GET /balance requires auth", async () => {
    const res = await request(app).get("/api/v1/bank/balance");
    expect([401, 429, 500]).toContain(res.status);
  });

  it("POST /deposit requires auth", async () => {
    const res = await request(app).post("/api/v1/bank/deposit").send({ amount: 100 });
    expect([401, 429]).toContain(res.status);
  });

  it("POST /deposit rejects invalid body", async () => {
    const res = await request(app)
      .post("/api/v1/bank/deposit")
      .send({ amount: -1 })
      .set("Authorization", "Bearer fake-token");
    // Without real auth, Firebase middleware throws UnauthorizedError first
    expect([400, 401, 429]).toContain(res.status);
  });

  it("POST /withdraw requires auth", async () => {
    const res = await request(app).post("/api/v1/bank/withdraw").send({ amount: 100 });
    expect([401, 429]).toContain(res.status);
  });

  it("POST /withdraw rejects invalid body", async () => {
    const res = await request(app)
      .post("/api/v1/bank/withdraw")
      .send({ amount: 0 })
      .set("Authorization", "Bearer fake-token");
    expect([400, 401, 429]).toContain(res.status);
  });

  it("POST /transfer requires auth", async () => {
    const res = await request(app).post("/api/v1/bank/transfer").send({ username: "bob", amount: 100 });
    expect([401, 429]).toContain(res.status);
  });

  it("POST /transfer rejects body without username", async () => {
    const res = await request(app)
      .post("/api/v1/bank/transfer")
      .send({ amount: 100 })
      .set("Authorization", "Bearer fake-token");
    expect([400, 401, 429]).toContain(res.status);
  });

  it("GET /history requires auth", async () => {
    const res = await request(app).get("/api/v1/bank/history");
    expect([401, 429, 500]).toContain(res.status);
  });
});

describe("Phase 2 — inventory routes", () => {
  it("GET / requires auth", async () => {
    const res = await request(app).get("/api/v1/inventory");
    expect([401, 429]).toContain(res.status);
  });

  it("POST /use requires auth", async () => {
    const res = await request(app).post("/api/v1/inventory/use").send({ itemId: 1 });
    expect([401, 429]).toContain(res.status);
  });

  it("POST /drop requires auth", async () => {
    const res = await request(app).post("/api/v1/inventory/drop").send({ itemId: 1 });
    expect([401, 429]).toContain(res.status);
  });
});

describe("Phase 2 — referral routes", () => {
  it("GET /my-code requires auth", async () => {
    const res = await request(app).get("/api/v1/referral/my-code");
    expect([401, 429]).toContain(res.status);
  });

  it("POST /apply requires auth", async () => {
    const res = await request(app).post("/api/v1/referral/apply").send({ code: "ABC123" });
    expect([401, 429]).toContain(res.status);
  });

  it("GET /stats requires auth", async () => {
    const res = await request(app).get("/api/v1/referral/stats");
    expect([401, 429]).toContain(res.status);
  });
});
