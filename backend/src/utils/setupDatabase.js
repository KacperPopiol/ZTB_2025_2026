import { initializeDynamoDB } from './initDynamoDB.js';
import { seedScooters } from './seedData.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Automatyczne inicjalizowanie i seedowanie bazy danych
// Podobnie jak Sequelize sync({ force: true })
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
    console.log('\n🚀 Rozpoczynam automatyczne inicjalizowanie bazy danych...\n');

    // Krok 1: Inicjalizuj tabele DynamoDB
    console.log('📦 Krok 1: Inicjalizowanie tabel DynamoDB...');
    const initSuccess = await initializeDynamoDB(shouldReset);
    
    if (!initSuccess) {
      throw new Error('Błąd inicjalizacji tabel DynamoDB');
    }

    // Krok 2: Seeduj dane (jeśli wymagane)
    if (shouldSeed) {
      console.log('\n🌱 Krok 2: Seedowanie danych...');
      await seedScooters();
    } else {
      console.log('\n⏭️  Krok 2: Pominięto seedowanie danych');
    }

    console.log('\n✅ Automatyczne inicjalizowanie bazy danych zakończone pomyślnie!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Błąd automatycznego inicjalizowania bazy danych:', error);
    throw error;
  }
}

// Uruchom jeśli wywołano bezpośrednio
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
      console.log('✅ Setup zakończony pomyślnie');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup zakończony błędem:', error);
      process.exit(1);
    });
}

