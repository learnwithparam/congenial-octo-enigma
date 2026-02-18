.PHONY: help setup install dev test clean docker-up docker-down
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)03 -- REST APIs That Don't Suck$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup (create .env, install deps)
	@cd backend && if [ ! -f .env ]; then \
		echo "$(BLUE)Creating .env file...$(NC)"; \
		cp .env.example .env; \
	fi
	@cd backend && npm install
	@echo "$(GREEN)Setup complete$(NC)"

install: ## Install dependencies
	@cd backend && npm install

dev: ## Start development server
	@cd backend && npm run dev

test: ## Run tests
	@cd backend && npm test

clean: ## Remove node_modules and dist
	@rm -rf backend/node_modules backend/dist
	@echo "$(GREEN)Cleaned$(NC)"

docker-up: ## Start with Docker
	@docker compose up -d
	@echo "$(GREEN)API running at http://localhost:3001$(NC)"

docker-down: ## Stop Docker containers
	@docker compose down
