# Makefile Magic

Docker commands are powerful but verbose. Typing `docker compose up --build -d` over and over gets old, and new teammates should not have to memorize flags. A Makefile wraps these commands into short, memorable targets. In this lesson, we will explore our project's Makefile and understand why it makes Docker workflows painless.

## What You'll Learn

- What a Makefile is and why it is useful for Docker projects
- How to read and write Make targets
- The Makefile in our LaunchPad API project
- Creating your own targets for common workflows

## Key Concepts

### Why a Makefile?

A Makefile is a file that defines shortcuts (called targets) for commands. Originally designed for compiling C programs, it turns out to be perfect for wrapping Docker commands because:

1. **Discovery**: `make help` shows every available command with descriptions
2. **Simplicity**: `make docker-up` is easier to remember than `docker compose up -d`
3. **Composition**: A target can combine multiple commands into one step
4. **Documentation**: The Makefile itself documents how to work with the project
5. **Onboarding**: New developers run `make setup` instead of reading a 10-step guide

### Our Project's Makefile

Here is the complete Makefile from the course root:

```makefile
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
```

Let us break down every part.

### .PHONY and .DEFAULT_GOAL

```makefile
.PHONY: help setup install dev test clean docker-up docker-down build logs shell
.DEFAULT_GOAL := help
```

`.PHONY` tells Make that these targets are not actual files. Without this, if a file called `build` existed in the directory, `make build` would think it is already "built" and skip it.

`.DEFAULT_GOAL := help` means running `make` with no arguments executes the `help` target.

### The Help Target

```makefile
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
```

This is a self-documenting pattern. It scans the Makefile for lines matching `target: ## description` and prints them as a formatted table. The `## comment` after each target is both a description and what gets displayed:

```bash
$ make help
11 -- Docker for Humans

Usage:
  help            Show this help
  setup           Initial setup (create .env, install deps)
  install         Install dependencies
  dev             Start development server (without Docker)
  test            Run tests
  clean           Remove node_modules and dist
  build           Build Docker image
  docker-up       Start with Docker
  docker-down     Stop Docker containers
  logs            View container logs
  shell           Open shell in app container
```

Every target is documented. No guessing.

### The Setup Target

```makefile
setup: ## Initial setup (create .env, install deps)
	@cd app && if [ ! -f .env ]; then \
		echo "$(BLUE)Creating .env file...$(NC)"; \
		cp .env.example .env; \
	fi
	@cd app && npm install
	@echo "$(GREEN)Setup complete$(NC)"
```

This is the first command a new developer runs. It:
1. Checks if `app/.env` exists; if not, copies `app/.env.example` to create it
2. Runs `npm install` to install dependencies
3. Prints a success message

The `@` prefix suppresses Make from printing the command before executing it (less noise).

### Docker Targets

```makefile
build: ## Build Docker image
	@docker compose build

docker-up: ## Start with Docker
	@docker compose up -d
	@echo "$(GREEN)Running at http://localhost:3000$(NC)"

docker-down: ## Stop Docker containers
	@docker compose down

logs: ## View container logs
	@docker compose logs -f

shell: ## Open shell in app container
	@docker compose exec app /bin/sh
```

Each target wraps a Docker Compose command. Notice how `docker-up` also prints the URL where the app is accessible. These small touches add up to a much better developer experience.

### Non-Docker Targets

```makefile
dev: ## Start development server (without Docker)
	@cd app && npm run dev

install: ## Install dependencies
	@cd app && npm install

clean: ## Remove node_modules and dist
	@rm -rf app/node_modules app/dist
```

The Makefile also provides targets for working without Docker. This is important because not every situation needs containers. Running `make dev` starts the server directly with `tsx watch src/index.ts`.

## Step by Step

### Step 1: Run make help

```bash
make help
```

or simply:

```bash
make
```

Since `help` is the default goal, both commands show the same output. Read through the available targets.

### Step 2: Initial Setup

```bash
make setup
```

This creates `app/.env` from the example file and installs npm packages. A new team member runs this one command on day one.

### Step 3: Start with Docker

```bash
make docker-up
```

The output tells you the URL. Compare this to what you would have to type:

```bash
docker compose up -d && echo "Running at http://localhost:3000"
```

### Step 4: Watch Logs

```bash
make logs
```

In another terminal, curl the API:

```bash
curl http://localhost:3000/api/startups
```

You see the request logged. Press Ctrl+C to stop following.

### Step 5: Open a Shell

```bash
make shell
```

You are now inside the container. Explore and exit:

```sh
ls src/routes/
exit
```

### Step 6: Stop Everything

```bash
make docker-down
```

### Step 7: Add Your Own Targets

Let us add useful targets. Open the Makefile and add:

```makefile
restart: ## Restart containers
	@docker compose down
	@docker compose up -d
	@echo "$(GREEN)Restarted$(NC)"

rebuild: ## Rebuild and restart
	@docker compose down
	@docker compose up --build -d
	@echo "$(GREEN)Rebuilt and running$(NC)"

prune: ## Remove all Docker artifacts
	@docker compose down -v
	@docker system prune -f
	@echo "$(GREEN)Pruned$(NC)"
```

Remember to add these names to the `.PHONY` line and use a real tab character (not spaces) before each `@` command. Makefiles require tabs for indentation.

### Step 8: Test the New Targets

```bash
make help       # New targets should appear
make rebuild    # Rebuild from scratch
make prune      # Full cleanup
```

## Exercise

1. Run `make` (or `make help`) and read all available targets
2. Use `make setup` followed by `make docker-up` to go from zero to running
3. Use `make logs` and `make shell` to inspect the running container
4. Add a `restart` target that runs `docker compose down` then `docker compose up -d`
5. Add a `rebuild` target that uses `docker compose up --build -d`
6. Verify your new targets appear in `make help` output

## Summary

- Makefiles wrap verbose Docker commands into short, memorable targets
- `.PHONY` prevents conflicts with real filenames; `.DEFAULT_GOAL` sets what `make` alone runs
- The `## comment` pattern creates self-documenting help output
- Our Makefile provides both Docker (`docker-up`, `logs`, `shell`) and non-Docker (`dev`, `install`) targets
- `make setup` gives new developers a one-command onboarding experience
- Custom targets like `restart` and `rebuild` can combine multiple steps into one command
- Always use tab characters (not spaces) for indentation in Makefiles
