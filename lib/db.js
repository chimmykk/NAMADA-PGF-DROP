import { Pool } from 'pg';
import dotenv from 'dotenv';
import { bech32m } from 'bech32';

dotenv.config();

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: 'localhost',
  port: 5434,
  database: process.env.POSTGRES_DB
});

export async function saveTransaction(tx) {
  const query = `
    INSERT INTO donations 
    (transaction_hash, from_address, amount_eth, namada_key, input_message, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (transaction_hash) DO NOTHING
    RETURNING *
  `;

  const values = [
    tx.hash,
    tx.from,
    tx.value,
    extractNamadaKey(tx.decodedRawInput),
    tx.decodedRawInput,
    new Date(tx.timestamp)
  ];

  return pool.query(query, values);
}

// New functions for block tracking
export async function markBlockAsScraped(block_number, transactions_found) {
  const query = `
    INSERT INTO scraped_blocks 
    (block_number, transactions_found, scraped_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (block_number) 
    DO UPDATE SET 
      transactions_found = EXCLUDED.transactions_found,
      scraped_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return pool.query(query, [block_number, transactions_found]);
}

export async function isBlockScraped(blockNumber) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM scraped_blocks WHERE block_number = $1
    ) as exists
  `;

  const result = await pool.query(query, [blockNumber]);
  return result.rows[0].exists;
}

export async function getLastScrapedBlock() {
  const query = `
    SELECT block_number 
    FROM scraped_blocks 
    ORDER BY block_number DESC 
    LIMIT 1
  `;

  const result = await pool.query(query);
  return result.rows[0]?.block_number || 0; // Return 0 if no blocks have been scraped
}

export function extractNamadaKey(message) {
  try {
    // Find all potential Namada addresses in the message
    const matches = message.matchAll(/tnam[a-zA-Z0-9]+/g);
    if (!matches) return '';
    
    // Try each match until we find a valid one
    for (const match of matches) {
      const address = match[0];
      
      // Attempt to decode the address as bech32
      try {
        const decoded = bech32m.decode(address);
        // Check if it's a Namada address (prefix should be 'tnam')
        if (decoded.prefix === 'tnam') {
          // If we got here, it's a valid bech32 Namada address
          return address;
        }
      } catch (e) {
        // If bech32 decode fails, continue to next match
        continue;
      }
    }
    
    // If no valid address found, return empty string
    return '';
  } catch (error) {
    console.error('Error extracting Namada key:', error);
    return '';
  }
}

// Add a utility function to get block scraping stats
export async function getBlockScrapingStats(blockNumber) {
  const query = `
    SELECT 
      block_number,
      transactions_found,
      scraped_at
    FROM scraped_blocks 
    WHERE block_number = $1
  `;

  const result = await pool.query(query, [blockNumber]);
  return result.rows[0];
}

// Optional: Add a function to get recent scraping activity
export async function getRecentScrapingActivity(limit = 10) {
  const query = `
    SELECT 
      block_number,
      transactions_found,
      scraped_at
    FROM scraped_blocks 
    ORDER BY scraped_at DESC 
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  return result.rows;
}

export async function saveTransactions(transactions) {
  const BATCH_SIZE = 1000; // Adjust based on your needs
  
  // Process in batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    const values = batch.map((tx) => [
      tx.hash,
      tx.from,
      tx.value,
      extractNamadaKey(tx.decodedRawInput),
      tx.decodedRawInput,
      new Date(tx.timestamp)
    ]).flat();

    const placeholders = batch.map((_, j) => {
      const offset = j * 6;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    }).join(',');

    const query = `
      INSERT INTO donations 
      (transaction_hash, from_address, amount_eth, namada_key, input_message, timestamp)
      VALUES ${placeholders}
      ON CONFLICT (transaction_hash) DO NOTHING
      RETURNING *
    `;

    await pool.query(query, values);
  }
}
