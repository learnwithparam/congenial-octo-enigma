.PHONY: help setup install dev test clean docker-up docker-down
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)02 -- Ship Your First Page$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup (install deps)
	@cd frontend && npm install
	@echo "$(GREEN)Setup complete$(NC)"

install: ## Install dependencies
	@cd frontend && npm install

dev: ## Start development server
	@cd frontend && npm run dev

test: ## Run tests
	@cd frontend && npm test

clean: ## Remove node_modules and build artifacts
	@rm -rf frontend/node_modules frontend/.next
	@echo "$(GREEN)Cleaned$(NC)"

docker-up: ## Start with Docker
	@docker compose up -d
	@echo "$(GREEN)Running at http://localhost:3000$(NC)"

docker-down: ## Stop Docker containers
	@docker compose down
