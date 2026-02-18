// src/pubsub.ts
import { EventEmitter } from 'events';
import type { StartupRecord, CommentRecord } from './data/store.js';

// Event names as constants to prevent typos
export const EVENTS = {
  STARTUP_UPVOTED: 'STARTUP_UPVOTED',
  COMMENT_ADDED: 'COMMENT_ADDED',
} as const;

// Payload types for type safety
export interface StartupUpvotedPayload {
  startupUpvoted: StartupRecord;
}

export interface CommentAddedPayload {
  commentAdded: CommentRecord;
}

// Simple in-memory PubSub using EventEmitter
class PubSub {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Allow many subscribers (default is 10)
    this.emitter.setMaxListeners(100);
  }

  publish(event: string, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  asyncIterator<T = unknown>(event: string): AsyncIterableIterator<T> {
    const emitter = this.emitter;
    const pullQueue: Array<(value: IteratorResult<T>) => void> = [];
    const pushQueue: T[] = [];
    let done = false;

    function pushValue(value: T) {
      if (pullQueue.length > 0) {
        const resolve = pullQueue.shift()!;
        resolve({ value, done: false });
      } else {
        pushQueue.push(value);
      }
    }

    const listener = (data: T) => {
      pushValue(data);
    };
    emitter.on(event, listener);

    return {
      [Symbol.asyncIterator]() {
        return this;
      },

      next(): Promise<IteratorResult<T>> {
        if (done) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }

        if (pushQueue.length > 0) {
          return Promise.resolve({
            value: pushQueue.shift()!,
            done: false,
          });
        }

        return new Promise((resolve) => {
          pullQueue.push(resolve);
        });
      },

      return(): Promise<IteratorResult<T>> {
        done = true;
        emitter.removeListener(event, listener);
        for (const resolve of pullQueue) {
          resolve({ value: undefined as unknown as T, done: true });
        }
        pullQueue.length = 0;
        pushQueue.length = 0;
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      },

      throw(error: unknown): Promise<IteratorResult<T>> {
        done = true;
        emitter.removeListener(event, listener);
        return Promise.reject(error);
      },
    };
  }
}

// Single instance shared across the application
export const pubsub = new PubSub();
