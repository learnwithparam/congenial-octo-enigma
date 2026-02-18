.PHONY: help setup install dev dev-gateway dev-auth dev-notifications test clean docker-up docker-down
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)10 -- Microservices That Make Sense$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup (create .env, install deps)
	@if [ ! -f gateway/.env ]; then \
		echo "$(BLUE)Creating .env file...$(NC)"; \
		cp gateway/.env.example gateway/.env; \
	fi
	@npm install
	@echo "$(GREEN)Setup complete$(NC)"

install: ## Install dependencies
	@npm install

dev: ## Start all services (run each in a separate terminal)
	@echo "$(BLUE)Start services in separate terminals:$(NC)"
	@echo "  make dev-gateway"
	@echo "  make dev-auth"
	@echo "  make dev-notifications"

dev-gateway: ## Start API gateway (port 3000)
	@npm run dev

dev-auth: ## Start auth service (port 3001)
	@npm run dev:auth

dev-notifications: ## Start notification service (port 3002)
	@npm run dev:notifications

test: ## Run tests
	@npm test

clean: ## Remove node_modules and dist
	@rm -rf node_modules dist
	@echo "$(GREEN)Cleaned$(NC)"

docker-up: ## Start all services with Docker
	@docker compose up -d
	@echo "$(GREEN)Gateway: http://localhost:3000  Auth: http://localhost:3001  Notifications: http://localhost:3002$(NC)"

docker-down: ## Stop Docker containers
	@docker compose down
