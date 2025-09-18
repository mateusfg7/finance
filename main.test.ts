/** biome-ignore-all lint/style/noMagicNumbers: Bypass for tests */

import { describe, expect, it } from "bun:test";
import axios from "axios";

const client = axios.create({
  baseURL: "http://localhost:3000",
});

describe("GET /health", () => {
  it('should return "ok"', async () => {
    const response = await client.get("/health");
    expect(response.status).toBe(200);
    expect(response.data).toBe("ok");
  });
});
