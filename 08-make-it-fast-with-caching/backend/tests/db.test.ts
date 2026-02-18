import { describe, it, expect } from "vitest";
import {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
} from "../src/db.js";

describe("simulated database", () => {
  it("should return all products", async () => {
    const products = await getAllProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty("id");
    expect(products[0]).toHaveProperty("name");
  });

  it("should return a product by id", async () => {
    const product = await getProductById("1");
    expect(product).toBeDefined();
    expect(product!.id).toBe("1");
  });

  it("should return undefined for unknown id", async () => {
    const product = await getProductById("unknown");
    expect(product).toBeUndefined();
  });

  it("should filter products by category", async () => {
    const electronics = await getProductsByCategory("electronics");
    expect(electronics.length).toBeGreaterThan(0);
    electronics.forEach((p) => expect(p.category).toBe("electronics"));
  });

  it("should update a product", async () => {
    const updated = await updateProduct("1", { price: 159.99 });
    expect(updated).toBeDefined();
    expect(updated!.price).toBe(159.99);
  });
});
