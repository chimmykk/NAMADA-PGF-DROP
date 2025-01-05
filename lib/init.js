import { startScheduler } from './scheduler';
import { getTransactions, decodeInputData } from './etherscan';
import { extractNamadaKey, saveTransactions, markBlockAsScraped } from './db';

const ADDRESS = process.env.COINCENTER_ADDRESS;
const STARTING_BLOCK = process.env.SCANNING_START_BLOCK || 0;
let isInitialized = false;

async function performInitialScrape() {
  console.log('Starting initial blockchain scrape...');
  try {
    const transactions = await getTransactions(ADDRESS, STARTING_BLOCK, 99999999);
    // Decode input data filters out transactions that don't have input data, as well as failed txs
    const decodedTransactions = decodeInputData(transactions);
    const filteredTransactions = decodedTransactions.filter(tx =>
      tx.decodedRawInput && 
      extractNamadaKey(tx.decodedRawInput) !== ''
    );

    console.log(`Found ${filteredTransactions.length} historical transactions`);

    // Save all transactions in bulk
    await saveTransactions(filteredTransactions);

    // Mark the last block as scraped with the total number of transactions found
    let lastBlock;
    if (filteredTransactions.length === 0) {
      lastBlock = parseInt(process.env.SCANNING_START_BLOCK) || 0;
    } else {
      lastBlock = Math.max(...filteredTransactions.map(tx => parseInt(tx.block_number)));
    }
    await markBlockAsScraped(lastBlock, filteredTransactions.length);


    console.log('Initial scrape complete');
    return filteredTransactions;
  } catch (error) {
    console.error('Error during initial scrape:', error);
    throw error;
  }
}

export async function initialize(skipInitialScrape = false) {
  if (isInitialized) {
    console.log('Server already initialized, skipping...');
    return;
  }

  console.log('Initializing server...');
  try {
    // Only perform initial scrape if not skipped
    if (!skipInitialScrape) {
      console.log('Performing initial scrape...');
      await performInitialScrape();
    } else {
      console.log('Skipping initial scrape...');
    }
    
    // Always start the scheduler
    console.log('Starting scheduler for ongoing updates...');
    startScheduler();
    
    isInitialized = true;
    console.log('Server initialization complete');
  } catch (error) {
    console.error('Error during server initialization:', error);
    throw error;
  }
} 