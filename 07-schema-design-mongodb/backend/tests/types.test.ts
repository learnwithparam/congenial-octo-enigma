import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  UserSchema,
  CategorySchema,
  StartupSchema,
  EmbeddedCommentSchema,
  EmbeddedUpvoteSchema,
} from '../src/types.js';

describe('UserSchema', () => {
  it('should validate a correct user', () => {
    const data = { name: 'Alice', email: 'alice@example.com', bio: 'Hello' };
    const result = UserSchema.parse(data);
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('should reject an invalid email', () => {
    const data = { name: 'Alice', email: 'not-an-email' };
    expect(() => UserSchema.parse(data)).toThrow();
  });

  it('should reject an empty name', () => {
    const data = { name: '', email: 'alice@example.com' };
    expect(() => UserSchema.parse(data)).toThrow();
  });
});

describe('CategorySchema', () => {
  it('should validate a correct category', () => {
    const result = CategorySchema.parse({ name: 'Dev Tools', slug: 'dev-tools' });
    expect(result.name).toBe('Dev Tools');
    expect(result.slug).toBe('dev-tools');
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('EmbeddedCommentSchema', () => {
  it('should validate and generate an _id', () => {
    const userId = new ObjectId();
    const result = EmbeddedCommentSchema.parse({ content: 'Great!', userId });
    expect(result._id).toBeInstanceOf(ObjectId);
    expect(result.content).toBe('Great!');
    expect(result.userId).toBe(userId);
  });

  it('should reject empty content', () => {
    expect(() =>
      EmbeddedCommentSchema.parse({ content: '', userId: new ObjectId() }),
    ).toThrow();
  });
});

describe('EmbeddedUpvoteSchema', () => {
  it('should validate with a userId', () => {
    const userId = new ObjectId();
    const result = EmbeddedUpvoteSchema.parse({ userId });
    expect(result.userId).toBe(userId);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('StartupSchema', () => {
  it('should validate a full startup with defaults', () => {
    const result = StartupSchema.parse({
      name: 'TestApp',
      slug: 'testapp',
      tagline: 'A test application',
      description: 'This is a description for the test application.',
      categoryId: new ObjectId(),
      founderId: new ObjectId(),
    });

    expect(result.status).toBe('pending');
    expect(result.featured).toBe(false);
    expect(result.comments).toEqual([]);
    expect(result.upvotes).toEqual([]);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('should reject an invalid status', () => {
    expect(() =>
      StartupSchema.parse({
        name: 'TestApp',
        slug: 'testapp',
        tagline: 'A test',
        description: 'Desc',
        categoryId: new ObjectId(),
        founderId: new ObjectId(),
        status: 'unknown',
      }),
    ).toThrow();
  });
});
