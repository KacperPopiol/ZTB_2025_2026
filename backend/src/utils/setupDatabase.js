import { initializeDynamoDB } from './initDynamoDB.js';
import { seedScooters } from './seedData.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Automatyczne inicjalizowanie i seedowanie bazy danych
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function setupDatabase(options = {}) {
  const {
    reset = false,        // Czy resetować istniejące tabele
    seed = true,          // Czy seedować dane
    force = false,        // Alias dla reset + seed
  } = options;

  const shouldReset = reset || force;
  const shouldSeed = seed || force;

  try {
    console.log('\nRozpoczynam automatyczne inicjalizowanie bazy danych...\n');

    console.log('Inicjalizowanie tabel DynamoDB...');
    const initSuccess = await initializeDynamoDB(shouldReset);
    
    if (!initSuccess) {
      throw new Error('Błąd inicjalizacji tabel DynamoDB');
    }

    if (shouldSeed) {
      console.log('\nSeedowanie danych...');
      await seedScooters();
    } else {
      console.log('\nPominięto seedowanie danych');
    }

    console.log('\nAutomatyczne inicjalizowanie bazy danych zakończone pomyślnie!\n');
    return true;
  } catch (error) {
    console.error('\nBłąd automatycznego inicjalizowania bazy danych:', error);
    throw error;
  }
}

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset') || args.includes('--force');
  const force = args.includes('--force');
  const noSeed = args.includes('--no-seed');

  setupDatabase({
    reset,
    seed: !noSeed,
    force,
  })
    .then(() => {
      console.log('Setup zakończony pomyślnie');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup zakończony błędem:', error);
      process.exit(1);
    });
}

