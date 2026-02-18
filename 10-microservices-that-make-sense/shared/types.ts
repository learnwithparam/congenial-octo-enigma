// Shared types across all microservices

export interface ServiceConfig {
  name: string;
  port: number;
  version: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: "pass" | "fail";
  responseTime?: number;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  type: "email" | "sms" | "push";
  userId?: string;
}

export interface NotificationResult {
  id: string;
  status: "queued" | "sent" | "failed";
  queuedAt: string;
}

export interface ServiceRoute {
  path: string;
  target: string;
  name: string;
}

export interface CorrelationHeaders {
  "x-correlation-id": string;
  "x-service-name"?: string;
}
