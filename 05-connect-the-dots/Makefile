.PHONY: help setup install dev dev-backend dev-frontend test clean docker-up docker-down
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)05 -- Connect the Dots$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup (install deps for frontend and backend)
	@cd backend && if [ ! -f .env ]; then cp .env.example .env 2>/dev/null || true; fi && npm install
	@cd frontend && if [ ! -f .env ]; then cp .env.example .env 2>/dev/null || true; fi && npm install
	@echo "$(GREEN)Setup complete$(NC)"

install: ## Install all dependencies
	@cd backend && npm install
	@cd frontend && npm install

dev: ## Start both frontend and backend
	@echo "$(BLUE)Start backend: make dev-backend$(NC)"
	@echo "$(BLUE)Start frontend: make dev-frontend$(NC)"
	@echo "$(YELLOW)Run each in a separate terminal$(NC)"

dev-backend: ## Start backend API server
	@cd backend && npm run dev

dev-frontend: ## Start frontend dev server
	@cd frontend && npm run dev

test: ## Run tests
	@cd frontend && npm test

clean: ## Remove node_modules and build artifacts
	@rm -rf backend/node_modules backend/dist frontend/node_modules frontend/.next
	@echo "$(GREEN)Cleaned$(NC)"

docker-up: ## Start with Docker (frontend + backend)
	@docker compose up -d
	@echo "$(GREEN)Frontend: http://localhost:3000  Backend: http://localhost:3001$(NC)"

docker-down: ## Stop Docker containers
	@docker compose down
