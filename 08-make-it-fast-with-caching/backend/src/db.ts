// Simulated database — adds realistic latency to demonstrate caching benefits

import type { Product } from "./types.js";

const SIMULATED_LATENCY_MS = 200;

const products: Product[] = [
  {
    id: "1",
    name: "Mechanical Keyboard",
    price: 149.99,
    category: "electronics",
    description: "Cherry MX Brown switches, RGB backlit",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Ergonomic Mouse",
    price: 79.99,
    category: "electronics",
    description: "Vertical design, 6 buttons, wireless",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "USB-C Hub",
    price: 49.99,
    category: "accessories",
    description: "7-in-1: HDMI, USB-A, SD card, ethernet",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Monitor Stand",
    price: 39.99,
    category: "accessories",
    description: "Adjustable height, cable management",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "5",
    name: "Webcam HD",
    price: 99.99,
    category: "electronics",
    description: "1080p, autofocus, built-in mic",
    updatedAt: new Date().toISOString(),
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getAllProducts(): Promise<Product[]> {
  await sleep(SIMULATED_LATENCY_MS);
  return products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  await sleep(SIMULATED_LATENCY_MS);
  return products.find((p) => p.id === id);
}

export async function getProductsByCategory(
  category: string
): Promise<Product[]> {
  await sleep(SIMULATED_LATENCY_MS);
  return products.filter((p) => p.category === category);
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, "id">>
): Promise<Product | undefined> {
  await sleep(SIMULATED_LATENCY_MS);
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  products[index] = {
    ...products[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return products[index];
}
