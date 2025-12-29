import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

// Konfiguracja klienta DynamoDB
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-central-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined, // dla lokalnego DynamoDB (opcjonalnie)
  credentials: process.env.DYNAMODB_ENDPOINT ? {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  } : undefined
});

// Klient z Document API (łatwiejszy w użyciu)
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Nazwy tabel
export const TABLES = {
  USERS: process.env.DYNAMODB_TABLE_USERS || 'EcoScoot_Users',
  SCOOTERS: process.env.DYNAMODB_TABLE_SCOOTERS || 'EcoScoot_Scooters',
  RESERVATIONS: process.env.DYNAMODB_TABLE_RESERVATIONS || 'EcoScoot_Reservations',
  RIDES: process.env.DYNAMODB_TABLE_RIDES || 'EcoScoot_Rides',
};

// Funkcja sprawdzająca połączenie
export async function checkDynamoDBConnection() {
  try {
    const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb');
    const command = new ListTablesCommand({});
    await client.send(command);
    console.log('✅ Połączenie z DynamoDB udane');
    return true;
  } catch (error) {
    console.error('❌ Błąd połączenia z DynamoDB:', error.message);
    return false;
  }
}

export default docClient;
export { client };
