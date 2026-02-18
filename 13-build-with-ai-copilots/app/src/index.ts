/**
 * Build with AI Copilots - Course 13
 * A demo script for practicing AI-assisted development workflows.
 *
 * Exercises:
 * - Use AI to refactor the calculateStats function
 * - Use AI to add error handling
 * - Use AI to write tests for these functions
 * - Use AI to improve the type definitions
 */

interface UserData {
  id: number;
  name: string;
  email: string;
  scores: number[];
  active: boolean;
}

interface Stats {
  mean: number;
  median: number;
  min: number;
  max: number;
  total: number;
}

export function calculateStats(scores: number[]): Stats {
  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, total: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const mean = total / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    total,
  };
}

export function filterActiveUsers(users: UserData[]): UserData[] {
  return users.filter((user) => user.active);
}

export function formatUserReport(user: UserData): string {
  const stats = calculateStats(user.scores);
  return [
    `User: ${user.name} (${user.email})`,
    `Status: ${user.active ? "Active" : "Inactive"}`,
    `Scores: ${user.scores.join(", ")}`,
    `Average: ${stats.mean.toFixed(2)}`,
    `Median: ${stats.median}`,
    `Range: ${stats.min} - ${stats.max}`,
  ].join("\n");
}

// Demo
const sampleUsers: UserData[] = [
  {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    scores: [85, 92, 78, 95, 88],
    active: true,
  },
  {
    id: 2,
    name: "Bob",
    email: "bob@example.com",
    scores: [72, 68, 81, 77],
    active: false,
  },
  {
    id: 3,
    name: "Carol",
    email: "carol@example.com",
    scores: [95, 98, 92, 97, 99],
    active: true,
  },
];

console.log("=== Build with AI Copilots - Demo ===\n");

const activeUsers = filterActiveUsers(sampleUsers);
console.log(`Active users: ${activeUsers.length}/${sampleUsers.length}\n`);

for (const user of activeUsers) {
  console.log(formatUserReport(user));
  console.log("---");
}
