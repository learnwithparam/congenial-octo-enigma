// Session routes — login, profile, cart, logout

import { Router } from "express";
import { destroySession } from "../middleware/session.js";
import type { CartItem } from "../types.js";

export const sessionsRouter = Router();

// POST /sessions/login — set user info in session
sessionsRouter.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  req.session!.userId = `user_${Date.now()}`;
  req.session!.username = username;

  res.json({
    message: "Logged in",
    sessionId: req.sessionId,
    session: req.session,
  });
});

// GET /sessions/profile — view current session
sessionsRouter.get("/profile", (req, res) => {
  if (!req.session?.username) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  res.json({ session: req.session });
});

// POST /sessions/cart — add item to cart
sessionsRouter.post("/cart", (req, res) => {
  const { productId, quantity = 1 } = req.body as CartItem;

  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  const cart = req.session!.cart;
  const existing = cart.find((item) => item.productId === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  res.json({ cart: req.session!.cart });
});

// DELETE /sessions/cart/:productId — remove item from cart
sessionsRouter.delete("/cart/:productId", (req, res) => {
  const productId = req.params.productId as string;
  req.session!.cart = req.session!.cart.filter(
    (item) => item.productId !== productId
  );

  res.json({ cart: req.session!.cart });
});

// POST /sessions/logout — destroy session
sessionsRouter.post("/logout", async (req, res) => {
  await destroySession(req, res);
  res.json({ message: "Logged out" });
});
