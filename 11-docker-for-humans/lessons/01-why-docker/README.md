# Why Docker

Every developer has heard (or said) the dreaded phrase: "But it works on my machine!" Docker exists to eliminate this problem entirely. In this lesson, we will understand what Docker is, why it matters, and how it changes the way you think about running software.

## What You'll Learn

- The "works on my machine" problem and why it happens
- The difference between containers and virtual machines
- Docker's mental model: images, containers, and registries
- Why Docker is the standard for modern development workflows

## Key Concepts

### The "Works On My Machine" Problem

Imagine you are building the LaunchPad startup directory -- an Express API with TypeScript. On your laptop, you have Node.js 20 installed, your `.env` file configured, and everything runs perfectly. You hand the code to a teammate, and suddenly:

- They have Node.js 18 installed, and a dependency requires Node 20
- They are on Windows, and a path separator breaks something
- They forgot to create the `.env` file with `PORT=3000`
- Their npm cache has a stale version of a package

None of these are bugs in your code. They are environment mismatches. Docker solves this by packaging your application together with its entire environment.

### Containers vs Virtual Machines

A virtual machine (VM) runs a complete operating system on top of a hypervisor. Each VM has its own kernel, its own file system, and its own set of system libraries. This is powerful but heavy -- a single VM can consume gigabytes of RAM just to boot.

A container, on the other hand, shares the host operating system's kernel. It only isolates the application layer: file system, processes, network, and environment variables. This makes containers:

- **Lightweight**: A container image for our Express app is around 200MB vs multi-GB for a VM
- **Fast**: Containers start in seconds, not minutes
- **Portable**: The same image runs on any machine with Docker installed
- **Reproducible**: Every run starts from the exact same state

```
Virtual Machine                    Container
┌──────────────────┐              ┌──────────────────┐
│   Your App       │              │   Your App       │
│   Node.js 20     │              │   Node.js 20     │
│   npm packages   │              │   npm packages   │
│   Ubuntu 22.04   │              │   Alpine Linux   │
│   Linux Kernel   │              └──────┬───────────┘
│   Hypervisor     │                     │ shares
└──────────────────┘              ┌──────┴───────────┐
                                  │   Host OS Kernel │
                                  └──────────────────┘
```

### Docker's Mental Model

Docker has three core concepts you need to internalize:

**Image**: A read-only blueprint that contains everything your app needs to run -- the operating system, runtime, dependencies, and your code. Think of it as a snapshot. Our LaunchPad API image would contain Alpine Linux, Node.js 20, all npm packages, and our TypeScript source files.

**Container**: A running instance of an image. You can start, stop, and delete containers without affecting the image. It is like the difference between a class and an object in programming.

**Registry**: A place to store and share images. Docker Hub is the default public registry, similar to how npm is the default package registry for Node.js.

```
Dockerfile  --(build)-->  Image  --(run)-->  Container
                             |
                       (push/pull)
                             |
                          Registry
```

### Why Docker for Development

Even if you are not deploying to production with Docker (though you probably should), Docker improves your development workflow:

1. **Onboarding**: New team members run one command instead of following a 20-step setup guide
2. **Consistency**: Everyone on the team runs the exact same environment
3. **Isolation**: Different projects can use different Node.js versions without conflicts
4. **Disposability**: Messed up your database? Delete the container and start fresh

For our LaunchPad API, instead of asking teammates to install Node.js 20, TypeScript, and configure environment variables, we will give them a `Dockerfile` and a `docker-compose.yml` that handles everything.

## Step by Step

### Step 1: Verify Docker is Installed

Open your terminal and run:

```bash
docker --version
```

You should see something like `Docker version 24.x.x` or newer. If not, install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/).

### Step 2: Run Your First Container

Let us prove that Docker works by running a container:

```bash
docker run hello-world
```

This command does three things:
1. Checks if the `hello-world` image exists locally
2. If not, pulls it from Docker Hub
3. Creates and runs a container from that image

### Step 3: Explore What Happened

List the containers that have run:

```bash
docker ps -a
```

You will see the `hello-world` container with a status of "Exited". It ran, printed its message, and stopped. This is normal -- containers only live as long as their main process runs.

### Step 4: Look at the LaunchPad API Structure

Before we containerize anything, look at what we are working with:

```
11-docker-for-humans/
├── app/
│   ├── src/
│   │   ├── index.ts          # Entry point, starts Express server
│   │   ├── app.ts            # Express app with routes and middleware
│   │   ├── types.ts          # TypeScript interfaces (Startup, ApiResponse)
│   │   ├── routes/
│   │   │   ├── health.ts     # GET /health endpoint
│   │   │   └── startups.ts   # CRUD endpoints for /api/startups
│   │   └── middleware/
│   │       ├── request-logger.ts
│   │       └── error-handler.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── Dockerfile
├── docker-compose.yml
└── Makefile
```

This is a real Express API that manages startup listings. In the next lesson, we will write a `Dockerfile` to package it into a container image.

## Exercise

1. Run `docker run hello-world` and confirm it prints the success message
2. Run `docker ps -a` and identify the container ID, image name, and status
3. Run `docker images` and note the size of the `hello-world` image
4. Think about a time you had an environment mismatch with a teammate -- how would Docker have helped?

## Summary

- The "works on my machine" problem comes from environment mismatches, not code bugs
- Containers are lightweight, fast alternatives to virtual machines that share the host kernel
- Docker's core concepts are images (blueprints), containers (running instances), and registries (storage)
- Docker eliminates setup friction by packaging an app with its entire environment
- Our LaunchPad startup directory API is the application we will containerize throughout this course
