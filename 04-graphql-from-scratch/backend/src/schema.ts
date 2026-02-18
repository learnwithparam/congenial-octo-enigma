// src/schema.ts

export const typeDefs = `#graphql
  type Startup {
    id: ID!
    name: String!
    slug: String!
    tagline: String!
    description: String!
    url: String!
    upvotes: Int!
    createdAt: String!
    founder: User!
    category: Category!
    comments: [Comment!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    avatarUrl: String
    startups: [Startup!]!
  }

  type Category {
    id: ID!
    name: String!
    slug: String!
    startups: [Startup!]!
  }

  type Comment {
    id: ID!
    content: String!
    createdAt: String!
    author: User!
    startup: Startup!
  }

  enum SortBy {
    NEWEST
    OLDEST
    UPVOTES_DESC
    UPVOTES_ASC
    NAME_ASC
    NAME_DESC
  }

  input CreateStartupInput {
    name: String!
    tagline: String!
    description: String!
    url: String!
    categoryId: ID!
    founderId: ID!
  }

  input UpdateStartupInput {
    name: String
    tagline: String
    description: String
    url: String
    categoryId: ID
  }

  type Query {
    startups(
      limit: Int
      offset: Int
      categoryId: ID
      search: String
      sortBy: SortBy
    ): [Startup!]!
    startup(id: ID!): Startup
    startupCount(categoryId: ID, search: String): Int!
    categories: [Category!]!
    category(id: ID!): Category
    user(id: ID!): User
  }

  type Mutation {
    createStartup(input: CreateStartupInput!): Startup!
    updateStartup(id: ID!, input: UpdateStartupInput!): Startup
    deleteStartup(id: ID!): Boolean!
    upvoteStartup(id: ID!): Startup
    createComment(startupId: ID!, content: String!, authorId: ID!): Comment!
  }

  type Subscription {
    """
    Fires when any startup receives an upvote.
    Pass startupId to filter for a specific startup.
    """
    startupUpvoted(startupId: ID): Startup!

    """
    Fires when a new comment is added to the specified startup.
    """
    commentAdded(startupId: ID!): Comment!
  }
`;
