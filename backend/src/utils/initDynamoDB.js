import {
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';
import { client, TABLES } from '../dynamodb.js';
import { fileURLToPath } from 'url';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Definicje tabel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const tableDefinitions = [
  {
    TableName: TABLES.USERS,
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
  {
    TableName: TABLES.SCOOTERS,
    KeySchema: [{ AttributeName: 'scooterId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'scooterId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'StatusIndex',
        KeySchema: [{ AttributeName: 'status', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
  {
    TableName: TABLES.RESERVATIONS,
    KeySchema: [{ AttributeName: 'reservationId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'reservationId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'scooterId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIndex',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'ScooterIndex',
        KeySchema: [{ AttributeName: 'scooterId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
  {
    TableName: TABLES.RIDES,
    KeySchema: [{ AttributeName: 'rideId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'rideId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIndex',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funkcje pomocnicze
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function tableExists(tableName) {
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function deleteTable(tableName) {
  try {
    const command = new DeleteTableCommand({ TableName: tableName });
    await client.send(command);
    console.log(`Usunięto tabelę: ${tableName}`);

    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }
}

async function createTable(tableDefinition) {
  try {
    const command = new CreateTableCommand(tableDefinition);
    await client.send(command);
    console.log(`Utworzono tabelę: ${tableDefinition.TableName}`);

    await waitForTableActive(tableDefinition.TableName);
  } catch (error) {
    console.error(`Błąd tworzenia tabeli ${tableDefinition.TableName}:`, error.message);
    throw error;
  }
}

async function waitForTableActive(tableName, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const command = new DescribeTableCommand({ TableName: tableName });
      const response = await client.send(command);

      if (response.Table.TableStatus === 'ACTIVE') {
        console.log(`Tabela ${tableName} jest aktywna`);
        return;
      }

      console.log(`Czekam na aktywację tabeli ${tableName}... (${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Błąd sprawdzania statusu tabeli ${tableName}:`, error.message);
      throw error;
    }
  }

  throw new Error(`Timeout: Tabela ${tableName} nie została aktywowana w czasie`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Główna funkcja inicjalizacji
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function initializeDynamoDB(reset = false) {
  console.log('\nInicjalizacja DynamoDB...\n');

  try {
    for (const tableDefinition of tableDefinitions) {
      const tableName = tableDefinition.TableName;
      const exists = await tableExists(tableName);

      if (exists && reset) {
        console.log(`Tabela ${tableName} istnieje - usuwanie...`);
        await deleteTable(tableName);
      }

      if (!exists || reset) {
        console.log(`Tworzenie tabeli: ${tableName}...`);
        await createTable(tableDefinition);
      } else {
        console.log(`Tabela ${tableName} już istnieje`);
      }
    }

    console.log('\nInicjalizacja DynamoDB zakończona!\n');
    return true;
  } catch (error) {
    console.error('\nBłąd inicjalizacji DynamoDB:', error);
    return false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reset = process.argv.includes('--reset');
  initializeDynamoDB(reset)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}