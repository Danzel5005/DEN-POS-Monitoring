import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./KdsView.jsx", import.meta.url)), "utf8");

describe("KDS display contract", () => {
  it("renders ticket status through the shared label map, never the raw status key", () => {
    expect(source).toContain("KDS_STATUS_LABEL[ticket.status]");
    expect(source).not.toMatch(/\{\s*ticket\.status\s*\}/);
    expect(source).not.toMatch(/\{\s*item\.kategori\s*\}/);
    expect(source).not.toMatch(/\{\s*field\.key\s*\}/);
  });

  it("offers a dismiss action for cancelled tickets", () => {
    expect(source).toContain("Sembunyikan");
    expect(source).toContain("denpos-kds-dismissed:");
  });
});