import { Pool, PoolClient, QueryResultRow } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = <Result extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
) => pool.query<Result>(text, values);

export async function withTransaction<Result>(
  callback: (client: PoolClient) => Promise<Result>
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}