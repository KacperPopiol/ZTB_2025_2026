import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import docClient, { TABLES } from '../dynamodb.js';
import redis from '../redis.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rejestracja użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function createUser({ email, password, firstName, lastName, role = 'user' }) {
  try {
    // Sprawdź czy email już istnieje
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('Użytkownik z tym adresem email już istnieje');
    }

    // Hashowanie hasła
    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = uuidv4();
    const now = new Date().toISOString();

    const user = {
      userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role, // 'user' lub 'admin'
      walletBalance: 0,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    const command = new PutCommand({
      TableName: TABLES.USERS,
      Item: user,
    });

    await docClient.send(command);

    // Usuń hasło z odpowiedzi
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Błąd tworzenia użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz użytkownika po ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getUserById(userId) {
  try {
    // Sprawdź cache
    const cached = await redis.get(`user:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const command = new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    const { password, ...userWithoutPassword } = response.Item;

    // Zapisz w cache na 5 minut
    await redis.setex(`user:${userId}`, 300, JSON.stringify(userWithoutPassword));

    return userWithoutPassword;
  } catch (error) {
    console.error('Błąd pobierania użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz użytkownika po email
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getUserByEmail(email) {
  try {
    const command = new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email.toLowerCase(),
      },
    });

    const response = await docClient.send(command);

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return response.Items[0];
  } catch (error) {
    console.error('Błąd pobierania użytkownika po email:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Weryfikacja hasła
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aktualizacja użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function updateUser(userId, updates) {
  try {
    const allowedUpdates = ['firstName', 'lastName', 'isActive'];
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });

    if (updateExpressions.length === 0) {
      throw new Error('Brak prawidłowych pól do aktualizacji');
    }

    // Dodaj updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const command = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);

    // Usuń cache
    await redis.del(`user:${userId}`);

    const { password, ...userWithoutPassword } = response.Attributes;
    return userWithoutPassword;
  } catch (error) {
    console.error('Błąd aktualizacji użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Zmiana hasła
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function changePassword(userId, oldPassword, newPassword) {
  try {
    // Pobierz użytkownika z hasłem
    const command = new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      throw new Error('Użytkownik nie znaleziony');
    }

    // Weryfikuj stare hasło
    const isValid = await verifyPassword(oldPassword, response.Item.password);
    if (!isValid) {
      throw new Error('Nieprawidłowe stare hasło');
    }

    // Hashuj nowe hasło
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateCommand = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: 'SET #password = :password, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#password': 'password',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':password': hashedPassword,
        ':updatedAt': new Date().toISOString(),
      },
    });

    await docClient.send(updateCommand);

    // Usuń cache
    await redis.del(`user:${userId}`);

    return { success: true };
  } catch (error) {
    console.error('Błąd zmiany hasła:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Usuń użytkownika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function deleteUser(userId) {
  try {
    const command = new DeleteCommand({
      TableName: TABLES.USERS,
      Key: { userId },
    });

    await docClient.send(command);

    // Usuń cache
    await redis.del(`user:${userId}`);

    return { success: true };
  } catch (error) {
    console.error('Błąd usuwania użytkownika:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pobierz wszystkich użytkowników (dla admina)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getAllUsers(limit = 50) {
  try {
    const command = new ScanCommand({
      TableName: TABLES.USERS,
      Limit: limit,
    });

    const response = await docClient.send(command);

    // Usuń hasła z odpowiedzi
    const users = response.Items.map(({ password, ...user }) => user);

    return {
      users,
      lastKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    console.error('Błąd pobierania użytkowników:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Doładowanie portfela
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function topUpWallet(userId, amount) {
  try {
    if (amount <= 0) throw new Error("Kwota musi być dodatnia");

    const command = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: 'SET walletBalance = if_not_exists(walletBalance, :start) + :amount, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':start': 0,
        ':amount': amount,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);
    await redis.del(`user:${userId}`); // Czyścimy cache

    const { password, ...userWithoutPassword } = response.Attributes;
    return userWithoutPassword;
  } catch (error) {
    console.error('Błąd doładowania portfela:', error);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Odliczanie z portfela (płatność)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function deductFromWallet(userId, amount) {
  try {
    if (amount <= 0) throw new Error("Kwota musi być dodatnia");

    // Pobierz aktualny stan portfela
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('Użytkownik nie znaleziony');
    }

    const currentBalance = user.walletBalance || 0;
    if (currentBalance < amount) {
      throw new Error('Niewystarczające środki na koncie');
    }

    const command = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: 'SET walletBalance = walletBalance - :amount, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':amount': amount,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);
    await redis.del(`user:${userId}`);

    const { password, ...userWithoutPassword } = response.Attributes;
    return userWithoutPassword;
  } catch (error) {
    console.error('Błąd odliczania z portfela:', error);
    throw error;
  }
}