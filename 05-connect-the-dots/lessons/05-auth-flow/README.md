# 05 — JWT Authentication Flow

Every real application needs to know who its users are. So far, our LaunchPad frontend can display startups and even create new ones, but there is no concept of a logged-in user. Anyone can submit a startup, and there is no way to restrict editing to the person who created it. In this lesson, we will explore how JWT (JSON Web Token) authentication works, how the frontend types we already have support this flow, and how to wire up login, signup, token storage, and protected routes in a Next.js application.

The backend does not have auth endpoints yet, so we will focus on understanding the concepts, building the frontend infrastructure, and preparing the code so that once the backend adds `/auth/login` and `/auth/signup` endpoints, everything connects seamlessly.

## What You Will Learn

- What JWTs are and why they are used for stateless authentication
- How the jose library verifies and decodes tokens in an Edge-compatible way
- How to build login and signup flows that call an auth API
- Where to store tokens (cookies vs localStorage) and the trade-offs of each
- How to attach the Authorization header to every API request using axios interceptors
- How to protect routes in Next.js using middleware
- How the existing AuthResponse and User types in our project support this flow

## Key Concepts

### JSON Web Tokens (JWT)

A JWT is a compact, URL-safe string that represents a set of claims. It has three parts separated by dots: a header, a payload, and a signature. The header describes the signing algorithm. The payload contains claims like the user ID, email, and expiration time. The signature ensures the token has not been tampered with.

Here is what a decoded JWT payload might look like for our LaunchPad app:

```json
{
  "sub": 1,
  "email": "alice@example.com",
  "name": "Alice",
  "iat": 1700000000,
  "exp": 1700086400
}
```

The `sub` (subject) is the user ID. The `iat` is when the token was issued. The `exp` is when it expires. The server signs this payload with a secret key. When the frontend sends the token back on subsequent requests, the server can verify the signature without looking anything up in a database. This is what makes JWT authentication stateless.

### The jose Library

Our project includes the `jose` library (check `package.json` for `"jose": "^5.0.0"`). Jose is the go-to JWT library for modern JavaScript because it works everywhere: Node.js, browsers, Cloudflare Workers, and Next.js Edge Runtime. Libraries like `jsonwebtoken` rely on Node.js-specific crypto APIs and will not work in Edge middleware, which is where we need to verify tokens for route protection.

Jose provides functions to sign, verify, and decode tokens:

```ts
import { jwtVerify, SignJWT } from 'jose';

// Verifying a token (server-side)
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const { payload } = await jwtVerify(token, secret);
console.log(payload.sub); // user ID
```

### Stateless vs Stateful Auth

Traditional session-based auth stores a session ID in a cookie and looks up the session in a database on every request. JWT auth is stateless because the token itself contains all the information the server needs. The trade-off is that you cannot easily revoke a specific token before it expires (you would need a blocklist, which reintroduces state). For most applications, short-lived tokens combined with refresh tokens provide a good balance.

## Step by Step

### Step 1: Understanding the Existing Types

Our project already defines the types that an auth flow needs. Open `src/types/index.ts`:

```ts
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
```

The `AuthResponse` interface describes what the backend will return when a user logs in or signs up. It includes a JWT token string and the user object. The `User` interface matches the user record in the database. These types are the contract between our frontend and backend.

### Step 2: Building the Auth API Functions

Let us create the API functions that will call the backend auth endpoints. These follow the same pattern as our startup CRUD functions in `src/lib/api.ts`.

Create `src/lib/auth.ts`:

```ts
// src/lib/auth.ts

import apiClient from './api-client';
import type { AuthResponse } from '@/types';

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
}

export async function signup(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/signup', {
    name,
    email,
    password,
  });
  return response.data;
}

export async function getMe(): Promise<{ user: User }> {
  const response = await apiClient.get('/auth/me');
  return response.data;
}
```

The `login` and `signup` functions send credentials to the server and receive an `AuthResponse` with the JWT and user data. The `getMe` function calls a protected endpoint that returns the currently authenticated user based on the token in the request header.

### Step 3: Storing the Token

After a successful login, you need to store the token somewhere so it can be sent with future requests. There are two common approaches.

Approach 1 - localStorage:

```ts
// After successful login
function handleLoginSuccess(authResponse: AuthResponse) {
  localStorage.setItem('token', authResponse.token);
  localStorage.setItem('user', JSON.stringify(authResponse.user));
}

// Reading the token later
function getToken(): string | null {
  return localStorage.getItem('token');
}
```

localStorage is simple and works well for single-page applications. The token persists across page refreshes and browser restarts. However, localStorage is accessible to any JavaScript running on your page, which means a cross-site scripting (XSS) vulnerability could expose the token.

Approach 2 - HTTP-only cookies:

```ts
// The server sets the cookie in its response header:
// Set-Cookie: token=eyJhbG...; HttpOnly; Secure; SameSite=Strict; Path=/

// The browser automatically sends the cookie with every request
// No JavaScript code needed to manage it
```

HTTP-only cookies cannot be read by JavaScript, which makes them immune to XSS attacks. The browser automatically includes them in requests to the same domain. The downside is more complexity: you need the backend to set the cookie, and you need to handle CORS and SameSite settings carefully.

For our LaunchPad project, we will use a hybrid approach that is common in Next.js applications. We store the token in a cookie that Next.js middleware can read for route protection, but we also make it available to client-side code for the axios Authorization header.

### Step 4: Setting Cookies in Next.js

Next.js provides a `cookies()` function for server-side cookie management. Create a server action for handling login:

```ts
// src/app/auth/actions.ts
'use server';

import { cookies } from 'next/headers';

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('token');
}
```

The `httpOnly: true` flag prevents client-side JavaScript from reading the cookie. The `secure` flag ensures the cookie is only sent over HTTPS in production. The `sameSite: 'lax'` setting provides CSRF protection while still allowing the cookie to be sent on top-level navigations.

### Step 5: Attaching the Token to API Requests

This is where our axios interceptor from `src/lib/api-client.ts` becomes essential. We need to modify the request interceptor to attach the Authorization header to every outgoing request.

Here is how the updated api-client.ts would look:

```ts
// Updated request interceptor in src/lib/api-client.ts

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach auth token if available
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }

    if (process.env.NODE_ENV === 'development') {
      const method = config.method?.toUpperCase() || 'UNKNOWN';
      console.log('[API] ' + method + ' ' + config.url);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);
```

The `getAuthToken` function reads the token from wherever you stored it. If you used localStorage:

```ts
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}
```

The `typeof window === 'undefined'` check is important because this code might run during server-side rendering, where localStorage does not exist.

The `Bearer` prefix is part of the HTTP Authorization standard (RFC 6750). The backend extracts the token by splitting on the space character.

### Step 6: Handling 401 Responses

When a token expires or is invalid, the backend responds with a 401 Unauthorized status. We should handle this globally in our response interceptor rather than in every individual API call.

```ts
// Updated response interceptor in src/lib/api-client.ts

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;

      if (status === 401) {
        // Token is expired or invalid
        // Clear stored auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      console.error(
        '[API Error] ' + status + ': ' + (data?.error || error.message)
      );
    } else if (error.request) {
      console.error('[API Error] No response from server');
    } else {
      console.error('[API Error] ' + error.message);
    }

    return Promise.reject(error);
  }
);
```

This interceptor acts as a safety net. If any API call returns 401, the user is automatically logged out and redirected to the login page. No individual component needs to handle expired tokens manually.

### Step 7: Protecting Routes with Next.js Middleware

Next.js middleware runs before every request and is the ideal place to check authentication. Create `src/middleware.ts` (this file must be in the `src` root, not inside `app`):

```ts
// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const protectedPaths = ['/startups/new', '/dashboard', '/profile'];

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this path requires authentication
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Read the token from the cookie
  const token = request.cookies.get('token')?.value;

  if (!token) {
    // No token - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify the token using jose
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token is invalid or expired
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('token');
    return response;
  }
}

export const config = {
  matcher: ['/startups/new', '/dashboard/:path*', '/profile/:path*'],
};
```

There are several things to notice here. The `matcher` config tells Next.js which routes this middleware applies to, so it does not run on every single page load. We use `jwtVerify` from jose to verify the token signature and check expiration. If the token is missing or invalid, we redirect to `/login` and include the original path as a `redirect` query parameter so we can send the user back after they log in. The jose library works in Edge Runtime, which is where Next.js middleware runs.

### Step 8: Building a Login Page

With the infrastructure in place, here is what a login page component would look like:

```tsx
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/lib/auth';
import { setAuthCookie } from '@/app/auth/actions';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const authResponse = await login(email, password);

      // Store token for client-side API calls
      localStorage.setItem('token', authResponse.token);
      localStorage.setItem('user', JSON.stringify(authResponse.user));

      // Store token in cookie for middleware
      await setAuthCookie(authResponse.token);

      // Redirect to the original page or home
      router.push(redirectTo);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        if (status === 401) {
          setError('Invalid email or password.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6">
      <h1 className="text-2xl font-bold mb-6">Log In to LaunchPad</h1>

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
```

Notice the pattern: call the API, store the token in both localStorage and a cookie (dual storage), then redirect. Error handling follows the same axios pattern we use in `create-startup-form.tsx`.

### Step 9: Creating an Auth Context

To make the current user available throughout the app without prop drilling, create a React context:

```tsx
// src/components/providers/auth-provider.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth on mount
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  }, []);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    // Also clear the server cookie
    fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

Components can then use `useAuth()` to check the current user:

```tsx
const { user, isLoading, logout } = useAuth();

if (isLoading) return <p>Loading...</p>;
if (!user) return <a href="/login">Log In</a>;
return <p>Welcome, {user.name}</p>;
```

### Step 10: The Complete Auth Flow

Let us trace the entire flow from start to finish:

1. User visits `/startups/new` (a protected route).
2. Next.js middleware checks the cookie, finds no token, redirects to `/login?redirect=/startups/new`.
3. User enters their email and password on the login page.
4. The frontend calls `POST /auth/login` via the axios api client.
5. The backend validates the credentials, creates a JWT signed with the secret, and returns `{ token, user }`.
6. The frontend stores the token in localStorage (for the axios interceptor) and in a cookie (for the middleware).
7. The request interceptor in api-client.ts now attaches `Authorization: Bearer <token>` to every outgoing request.
8. The user is redirected back to `/startups/new`.
9. Middleware sees the valid token in the cookie and allows the request through.
10. If the token expires, any API call returns 401, the response interceptor clears the token and redirects to `/login`.

## Exercise

1. Create the `src/lib/auth.ts` file with the login, signup, and getMe functions as shown in Step 2.
2. Update the request interceptor in `src/lib/api-client.ts` to read a token from localStorage and attach it as a Bearer token.
3. Create the `src/middleware.ts` file that protects the `/startups/new` route. For now, since we do not have a real backend issuing tokens, you can test by manually setting a cookie in the browser dev tools.
4. Create a basic login page at `src/app/login/page.tsx`. It does not need to call a real backend yet. Instead, have it store a mock token in localStorage and the cookie, then redirect.
5. Add a `useAuth` hook and AuthProvider that reads the user from localStorage on mount and provides it via context.
6. Think about what changes you would need if the backend used refresh tokens (a short-lived access token plus a long-lived refresh token). Where would the refresh logic go?

## Summary

Authentication is the bridge between an anonymous API and a personalized application. JWTs provide a stateless mechanism where the token itself carries the user identity, verified by a cryptographic signature. The jose library gives us Edge-compatible JWT verification that works in Next.js middleware.

The frontend auth flow has several moving parts: API functions for login and signup, token storage in both localStorage (for the axios interceptor) and cookies (for middleware), a request interceptor that attaches the Authorization header to every request, a response interceptor that handles 401 errors globally, Next.js middleware for server-side route protection, and a React context for making user state available to components.

Once the backend adds auth endpoints that return the `AuthResponse` shape our types already define, all of this infrastructure will plug in directly.
