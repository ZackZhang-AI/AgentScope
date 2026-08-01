import { Pool } from "pg";
import { PostgresTraceRepository } from "./postgres-trace-repository";
import { PostgresArtifactStore } from "../../execution/artifact-store";

const globalDatabase = globalThis as typeof globalThis & {
  agentscopePool?: Pool;
  agentscopeTraceRepository?: PostgresTraceRepository;
  agentscopeArtifactStore?: PostgresArtifactStore;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for AgentScope trace storage.");
  }

  return new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export function getDatabasePool() {
  globalDatabase.agentscopePool ??= createPool();
  return globalDatabase.agentscopePool;
}

export function getTraceRepository() {
  globalDatabase.agentscopeTraceRepository ??= new PostgresTraceRepository(
    getDatabasePool(),
  );
  return globalDatabase.agentscopeTraceRepository;
}

export function getOptionalTraceRepository() {
  return process.env.DATABASE_URL ? getTraceRepository() : null;
}

export function getArtifactStore() {
  globalDatabase.agentscopeArtifactStore ??= new PostgresArtifactStore(
    getDatabasePool(),
  );
  return globalDatabase.agentscopeArtifactStore;
}

export function getOptionalArtifactStore() {
  return process.env.DATABASE_URL ? getArtifactStore() : null;
}

export async function closeDatabasePool() {
  if (globalDatabase.agentscopePool) {
    await globalDatabase.agentscopePool.end();
    delete globalDatabase.agentscopePool;
    delete globalDatabase.agentscopeTraceRepository;
    delete globalDatabase.agentscopeArtifactStore;
  }
}
