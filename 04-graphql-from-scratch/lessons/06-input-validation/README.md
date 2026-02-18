# Lesson 06: Input Validation with Zod

In the previous lesson we built mutations that create, update, and delete startups. Our GraphQL schema enforces that required fields are present and that types match (a `String` must be a string, an `Int` must be an integer). But that is where the schema's protection ends. It cannot enforce business rules like "the title must be between 3 and 100 characters" or "the URL must be a valid https link." In this lesson we add real validation using Zod, a TypeScript-first schema validation library that is already in our project dependencies.

By the end of this lesson you will:

- Understand why the GraphQL type system alone is not enough for input validation
- Build Zod schemas that mirror your GraphQL input types with extra constraints
- Create a reusable validation helper for resolvers
- Return clear, field-level error messages through GraphQL's error system
- Define custom error codes and extensions so clients can react programmatically

---

## Why GraphQL Types Are Not Enough

Consider our `CreateStartupInput` type from the schema:

```graphql
input CreateStartupInput {
  title: String!
  description: String!
  category: String!
  websiteUrl: String
  founderId: ID!
}
```

GraphQL guarantees that `title` is a non-null string. But what if the user sends an empty string? Or a string with 10,000 characters? GraphQL will happily accept both. The type system has no concept of:

- Minimum or maximum string length
- String format (email, URL, UUID)
- Number ranges (upvotes cannot be negative)
- Enum membership beyond what is declared in the schema
- Custom business rules (a startup title must be unique)

For any real application you need a validation layer between the raw input and your business logic. This is exactly what Zod provides.

---

## Installing and Understanding Zod

Zod is already listed in our `package.json`, so make sure you have run `npm install`. If you are starting fresh:

```bash
npm install zod
```

Zod lets you define schemas that describe the shape and constraints of data. When you parse data against a schema, Zod either returns the validated (and optionally transformed) data or throws a `ZodError` with detailed information about every field that failed.

Here is a quick example to build intuition:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name is too long'),
  email: z.string().email('Must be a valid email'),
  age: z.number().int().min(13, 'Must be at least 13'),
});

// This succeeds and returns typed data
const user = UserSchema.parse({
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
});

// This throws a ZodError with field-level messages
UserSchema.parse({
  name: '',
  email: 'not-an-email',
  age: 10,
});
```

The key insight is that Zod schemas run at runtime. They complement TypeScript's compile-time checks. TypeScript tells you about type errors before you ship; Zod tells you about bad data when it arrives from the outside world.

---

## Creating Validation Schemas

Create a new file at `src/validation/schemas.ts`. We will define one Zod schema for each GraphQL input type.

```typescript
// src/validation/schemas.ts
import { z } from 'zod';

// --- CreateStartupInput ---
export const CreateStartupInputSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters')
    .trim(),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5000 characters')
    .trim(),

  category: z
    .string()
    .min(1, 'Category is required'),

  websiteUrl: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https', 'URL must use HTTPS')
    .optional()
    .or(z.literal('')),

  founderId: z
    .string()
    .min(1, 'Founder ID is required'),
});

// --- UpdateStartupInput ---
export const UpdateStartupInputSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters')
    .trim()
    .optional(),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5000 characters')
    .trim()
    .optional(),

  category: z
    .string()
    .min(1, 'Category is required')
    .optional(),

  websiteUrl: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https', 'URL must use HTTPS')
    .optional()
    .or(z.literal('')),
});

// --- CreateCommentInput ---
export const CreateCommentInputSchema = z.object({
  startupId: z
    .string()
    .min(1, 'Startup ID is required'),

  authorId: z
    .string()
    .min(1, 'Author ID is required'),

  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters')
    .trim(),
});

// Export inferred types so resolvers can use them
export type CreateStartupInput = z.infer<typeof CreateStartupInputSchema>;
export type UpdateStartupInput = z.infer<typeof UpdateStartupInputSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;
```

Notice a few patterns:

1. `.trim()` automatically strips whitespace. The validated data comes back trimmed, so your database never stores leading or trailing spaces.
2. `.optional()` mirrors GraphQL's nullable fields. For the update input, every field is optional because a partial update should only require the fields being changed.
3. `.or(z.literal(''))` on `websiteUrl` allows an empty string as well as a valid URL. This handles the case where a user clears the URL field.
4. We export inferred types with `z.infer`. These types are derived from the schema, so the validation rules and TypeScript types can never drift apart.

---

## Building a Custom Error Class

Before we build the validation helper, we need a way to communicate validation failures through GraphQL. Apollo Server uses the `GraphQLError` class from the `graphql` package. We will extend it with a custom error code and structured field errors.

Create `src/errors/validation-error.ts`:

```typescript
// src/errors/validation-error.ts
import { GraphQLError } from 'graphql';

export interface FieldError {
  field: string;
  message: string;
}

export class UserInputError extends GraphQLError {
  constructor(message: string, fieldErrors: FieldError[] = []) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        fieldErrors,
      },
    });
  }
}
```

This class does two things:

1. It sets the error code to `BAD_USER_INPUT`. Clients can switch on this code to know the error is a validation problem, not a server crash.
2. It attaches an array of `FieldError` objects in extensions. Each entry names the field and describes the problem. A client can use this to highlight specific form fields.

When this error reaches the client, the response looks like:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Validation failed",
      "extensions": {
        "code": "BAD_USER_INPUT",
        "fieldErrors": [
          { "field": "title", "message": "Title must be at least 3 characters" },
          { "field": "websiteUrl", "message": "URL must use HTTPS" }
        ]
      }
    }
  ]
}
```

This is much more useful than a generic "Bad request" message. The client knows exactly which fields are wrong and what to tell the user.

---

## Building the Validation Helper

Now we create a function that takes a Zod schema and an input object, runs validation, and either returns the clean data or throws our `UserInputError`. Create `src/validation/validate.ts`:

```typescript
// src/validation/validate.ts
import { ZodSchema, ZodError } from 'zod';
import { UserInputError, FieldError } from '../errors/validation-error.js';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    // parse() throws ZodError on failure, returns typed data on success
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: FieldError[] = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new UserInputError('Validation failed', fieldErrors);
    }

    // Re-throw unexpected errors
    throw error;
  }
}
```

The `validate` function is generic. It accepts any Zod schema and any data. If validation passes, it returns the data typed according to the schema. If validation fails, it converts every Zod issue into a `FieldError` and throws a `UserInputError`.

The `issue.path.join('.')` handles nested objects gracefully. If you had a schema for an address with a `city` field inside a `location` object, the path would be `location.city`.

---

## Using Validation in Resolvers

Now let us update our mutation resolvers to use the validation helper. Open `src/resolvers/mutations.ts` (or wherever your mutation resolvers live):

```typescript
// src/resolvers/mutations.ts
import { validate } from '../validation/validate.js';
import {
  CreateStartupInputSchema,
  UpdateStartupInputSchema,
  CreateCommentInputSchema,
} from '../validation/schemas.js';
import { startups, comments } from '../data/store.js';

let nextId = 100;
function generateId(): string {
  return 'id-' + (nextId++);
}

export const mutationResolvers = {
  Mutation: {
    createStartup: (_parent: unknown, args: { input: unknown }) => {
      // Validate and get typed, trimmed data
      const input = validate(CreateStartupInputSchema, args.input);

      const startup = {
        id: generateId(),
        title: input.title,
        description: input.description,
        category: input.category,
        websiteUrl: input.websiteUrl || null,
        founderId: input.founderId,
        upvotes: 0,
        createdAt: new Date().toISOString(),
      };

      startups.push(startup);
      return startup;
    },

    updateStartup: (_parent: unknown, args: { id: string; input: unknown }) => {
      // Validate the partial input
      const input = validate(UpdateStartupInputSchema, args.input);

      const index = startups.findIndex((s) => s.id === args.id);
      if (index === -1) {
        throw new Error('Startup not found');
      }

      // Merge only the fields that were provided
      const updated = { ...startups[index] };
      if (input.title !== undefined) updated.title = input.title;
      if (input.description !== undefined) updated.description = input.description;
      if (input.category !== undefined) updated.category = input.category;
      if (input.websiteUrl !== undefined) updated.websiteUrl = input.websiteUrl || null;

      startups[index] = updated;
      return updated;
    },

    createComment: (_parent: unknown, args: { input: unknown }) => {
      const input = validate(CreateCommentInputSchema, args.input);

      const comment = {
        id: generateId(),
        startupId: input.startupId,
        authorId: input.authorId,
        text: input.text,
        createdAt: new Date().toISOString(),
      };

      comments.push(comment);
      return comment;
    },

    // upvoteStartup and deleteStartup don't need input validation
    // because they only take an ID argument
  },
};
```

The important change is on the first line of each resolver: `validate(SomeSchema, args.input)`. This single line replaces what would be dozens of manual `if` checks. If any field is invalid, the resolver never reaches the business logic. The `UserInputError` is thrown and Apollo Server returns it to the client.

Also notice that after validation, `input` is fully typed. Your editor's autocomplete knows that `input.title` is a string and `input.websiteUrl` is `string | undefined`. This is the power of Zod's type inference working together with TypeScript.

---

## Testing Validation in Apollo Sandbox

Start your server and open Apollo Sandbox. Try creating a startup with invalid data:

```graphql
mutation {
  createStartup(input: {
    title: "Hi"
    description: "Short"
    category: ""
    websiteUrl: "http://not-https.com"
    founderId: "user-1"
  }) {
    id
    title
  }
}
```

You should see a response like this:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Validation failed",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["createStartup"],
      "extensions": {
        "code": "BAD_USER_INPUT",
        "fieldErrors": [
          { "field": "title", "message": "Title must be at least 3 characters" },
          { "field": "description", "message": "Description must be at least 10 characters" },
          { "field": "category", "message": "Category is required" },
          { "field": "websiteUrl", "message": "URL must use HTTPS" }
        ]
      }
    }
  ]
}
```

Every invalid field is reported at once. The client does not have to fix one error, resubmit, find the next error, and repeat. This is a much better experience than sequential validation.

Now try a valid mutation:

```graphql
mutation {
  createStartup(input: {
    title: "  My Cool Startup  "
    description: "This is a startup that does amazing things for developers."
    category: "tech"
    websiteUrl: "https://example.com"
    founderId: "user-1"
  }) {
    id
    title
  }
}
```

Notice the spaces around the title. Because we used `.trim()` in the Zod schema, the returned title will be "My Cool Startup" with no leading or trailing spaces. The validation layer does double duty: it rejects bad data and cleans up acceptable data.

---

## Understanding GraphQL Error Extensions

GraphQL errors have a standard shape defined by the specification. Every error must have a `message` field. The `locations` and `path` fields are added by the GraphQL execution engine to tell you where in the query the error occurred. Everything else goes into `extensions`, which is a free-form JSON object.

Apollo Server uses `extensions.code` as a convention. Some common codes:

- `BAD_USER_INPUT` - the client sent invalid data
- `UNAUTHENTICATED` - the request is missing valid credentials
- `FORBIDDEN` - the user is authenticated but not authorized
- `INTERNAL_SERVER_ERROR` - something unexpected broke on the server

These codes are not part of the GraphQL specification. They are a convention that Apollo popularized and that most GraphQL clients understand. We will use more of these codes in Lesson 08 when we build a complete error handling strategy.

The `extensions` object can hold anything you want. We put `fieldErrors` there, but you could also include a `retryable` boolean, a `timestamp`, or a `requestId` for debugging. The only rule is that `extensions` must be serializable to JSON.

---

## Creating a Validation Wrapper (Advanced Pattern)

If you want to avoid calling `validate()` at the top of every resolver, you can create a higher-order function that wraps resolvers:

```typescript
// src/validation/with-validation.ts
import { ZodSchema } from 'zod';
import { validate } from './validate.js';

type ResolverFn = (
  parent: unknown,
  args: Record<string, unknown>,
  context: unknown
) => unknown;

export function withValidation<T>(
  schema: ZodSchema<T>,
  inputField: string,
  resolver: (
    parent: unknown,
    args: { input: T } & Record<string, unknown>,
    context: unknown
  ) => unknown
): ResolverFn {
  return (parent, args, context) => {
    const validated = validate(schema, args[inputField]);
    const newArgs = { ...args, [inputField]: validated };
    return resolver(
      parent,
      newArgs as { input: T } & Record<string, unknown>,
      context
    );
  };
}
```

Then use it like this:

```typescript
import { withValidation } from '../validation/with-validation.js';
import { CreateStartupInputSchema } from '../validation/schemas.js';

export const mutationResolvers = {
  Mutation: {
    createStartup: withValidation(
      CreateStartupInputSchema,
      'input',
      (_parent, args, _context) => {
        // args.input is already validated and typed
        const startup = {
          id: generateId(),
          title: args.input.title,
          description: args.input.description,
          // ...rest of fields
        };
        startups.push(startup);
        return startup;
      }
    ),
  },
};
```

This pattern has pros and cons. On the plus side, it separates validation from business logic and makes it impossible to forget the validation call. On the minus side, it adds a layer of indirection and makes the resolver harder to read. For this course, we will stick with the explicit `validate()` call because it is simpler and easier to follow.

---

## Validating Enums and Complex Types

Sometimes you need validation beyond simple strings and numbers. Here are a few patterns you will encounter.

Validating against a set of allowed values:

```typescript
const CategorySchema = z.enum([
  'tech',
  'health',
  'finance',
  'education',
  'other',
], {
  errorMap: () => ({
    message: 'Category must be one of: tech, health, finance, education, other',
  }),
});
```

Validating with a custom refinement rule:

```typescript
const StartupSchema = z.object({
  title: z.string().min(3).max(100),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.endDate) > new Date(),
  {
    message: 'End date must be in the future',
    path: ['endDate'],
  }
);
```

The `.refine()` method lets you add arbitrary validation logic. The `path` option tells Zod which field to attach the error to. This is essential for our `fieldErrors` mapping to work correctly.

Validating nested objects:

```typescript
const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().length(2, 'Must be a 2-letter country code'),
});

const CompanySchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
});
```

Zod composes naturally. You build small schemas and combine them into larger ones. If validation fails on `address.city`, the error path will be `address.city`, and our `validate()` function handles it correctly because we used `issue.path.join('.')`.

---

## Client-Side Error Handling

While this is a backend course, it helps to understand how clients will consume your validation errors. Here is how a React client might handle our error format:

```typescript
// Client-side code (for reference)
async function createStartup(input: CreateStartupFormData) {
  const { data, errors } = await client.mutate({
    mutation: CREATE_STARTUP,
    variables: { input },
  });

  if (errors) {
    const validationError = errors.find(
      (e) => e.extensions?.code === 'BAD_USER_INPUT'
    );

    if (validationError) {
      const fieldErrors = validationError.extensions
        .fieldErrors as FieldError[];
      // Set errors on specific form fields
      fieldErrors.forEach(({ field, message }) => {
        form.setError(field, { message });
      });
      return;
    }

    // Handle other error types
    showToast('Something went wrong. Please try again.');
    return;
  }

  // Success — navigate to the new startup page
  router.push('/startups/' + data.createStartup.id);
}
```

The client checks for `BAD_USER_INPUT` errors, extracts the field errors, and maps them to form fields. This creates a smooth user experience where validation messages appear next to the relevant fields, just like server-side validation in a traditional form submission.

---

## Best Practices for GraphQL Validation

1. Validate at the resolver level, not in the schema. The schema defines the shape of the API. The resolver enforces business rules. Mixing the two makes both harder to maintain.

2. Return all validation errors at once. Do not throw on the first invalid field. Zod does this by default, which is one of the reasons we chose it.

3. Use consistent error codes. Every validation error should use `BAD_USER_INPUT`. Every authentication error should use `UNAUTHENTICATED`. Clients depend on these codes being predictable.

4. Keep validation schemas close to the resolvers that use them. If a schema is only used by one resolver, define it in the same file or a nearby file. If it is shared across resolvers, put it in a central `validation/` directory as we did here.

5. Use Zod transforms for data cleaning. The `.trim()` method is a transform that modifies the data. You can also use `.transform()` for more complex operations like normalizing URLs or converting strings to dates.

6. Do not duplicate validation between client and server. The server is the source of truth. The client can have its own validation for instant feedback, but the server must always validate independently. Never trust client-side validation alone.

---

## Exercise

Add a Zod schema for a hypothetical `UpdateUserInput` that validates:

- `name`: optional, 2-50 characters
- `email`: optional, valid email format
- `bio`: optional, max 500 characters
- `websiteUrl`: optional, valid URL with HTTPS

Wire it up with the `validate()` helper in a resolver. Test it by sending invalid data through Apollo Sandbox and verify that you get field-level error messages.

---

## Summary

In this lesson we added a validation layer to our GraphQL API using Zod. The GraphQL type system ensures the right types arrive, and Zod ensures the right values arrive. We built a `UserInputError` class that communicates field-level errors through GraphQL extensions, and a `validate()` helper that bridges Zod and our error system.

The key files we created:

- `src/validation/schemas.ts` - Zod schemas for all input types
- `src/validation/validate.ts` - Generic validation helper
- `src/errors/validation-error.ts` - Custom error class with field errors

In the next lesson we will tackle the N+1 problem using DataLoader, which is one of the most important performance patterns in GraphQL.
