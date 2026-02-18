.PHONY: help setup install dev test clean docker-up docker-down build logs shell
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)11 -- Docker for Humans$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup (create .env, install deps)
	@cd app && if [ ! -f .env ]; then \
		echo "$(BLUE)Creating .env file...$(NC)"; \
		cp .env.example .env; \
	fi
	@cd app && npm install
	@echo "$(GREEN)Setup complete$(NC)"

install: ## Install dependencies
	@cd app && npm install

dev: ## Start development server (without Docker)
	@cd app && npm run dev

test: ## Run tests
	@cd app && npm test

clean: ## Remove node_modules and dist
	@rm -rf app/node_modules app/dist
	@echo "$(GREEN)Cleaned$(NC)"

build: ## Build Docker image
	@docker compose build
	@echo "$(GREEN)Built$(NC)"

docker-up: ## Start with Docker
	@docker compose up -d
	@echo "$(GREEN)Running at http://localhost:3000$(NC)"

docker-down: ## Stop Docker containers
	@docker compose down

logs: ## View container logs
	@docker compose logs -f

shell: ## Open shell in app container
	@docker compose exec app /bin/sh
