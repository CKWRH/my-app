import type { CloudflareBindings } from './env'

export type UserRecord = {
  id: string
  email: string
  display_name: string
  role: string
  password_hash: string
  is_active: number
}

export type ChatMessageRecord = {
  id: string
  room: string
  user_id: string
  display_name: string
  content: string
  created_at: string
}

export type SensorReading = {
  id: string
  device_id: string
  temperature_c: number
  stepper_status: 'stopped' | 'moving' | 'error'
  servo_angle: number
  recorded_at: string
}

export function requireDatabase(env: CloudflareBindings) {
  if (!env.DB) throw new Error('D1 database binding DB is not configured')
  return env.DB
}

export async function findUserByEmail(env: CloudflareBindings, email: string) {
  const db = requireDatabase(env)
  return db.prepare(
    'SELECT id, email, display_name, role, password_hash, is_active FROM users WHERE email = ?1'
  ).bind(email.toLowerCase()).first<UserRecord>()
}

export async function findUserById(env: CloudflareBindings, id: string) {
  const db = requireDatabase(env)
  return db.prepare(
    'SELECT id, email, display_name, role, is_active FROM users WHERE id = ?1'
  ).bind(id).first<Omit<UserRecord, 'password_hash'>>()
}

export async function createUser(
  env: CloudflareBindings,
  input: { email: string; displayName: string; passwordHash: string }
) {
  const db = requireDatabase(env)
  const user = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase(),
    display_name: input.displayName,
    role: 'user',
    is_active: 1,
  }
  await db.prepare(
    'INSERT INTO users (id, email, display_name, password_hash) VALUES (?1, ?2, ?3, ?4)'
  ).bind(user.id, user.email, user.display_name, input.passwordHash).run()
  return user
}

export async function createAuthSession(
  env: CloudflareBindings,
  input: { id: string; userId: string; expiresAt: string }
) {
  const db = requireDatabase(env)
  await db.prepare(
    'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)'
  ).bind(input.id, input.userId, input.expiresAt).run()
}

export async function revokeAuthSession(env: CloudflareBindings, id: string) {
  const db = requireDatabase(env)
  await db.prepare(
    'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?1'
  ).bind(id).run()
}

export async function listChatMessages(env: CloudflareBindings, room: string, limit = 50) {
  const db = requireDatabase(env)
  const result = await db.prepare(
    'SELECT id, room, user_id, display_name, content, created_at FROM chat_messages WHERE room = ?1 ORDER BY created_at DESC LIMIT ?2'
  ).bind(room, limit).all<ChatMessageRecord>()
  return result.results.reverse()
}

export async function listAdminUsers(env: CloudflareBindings) {
  const db = requireDatabase(env)
  const result = await db.prepare(
    'SELECT id, email, display_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
  ).all<Omit<UserRecord, 'password_hash'> & { created_at: string }>()
  return result.results
}

export async function setUserActiveStatus(env: CloudflareBindings, id: string, isActive: boolean) {
  const db = requireDatabase(env)
  return db.prepare(
    'UPDATE users SET is_active = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2'
  ).bind(isActive ? 1 : 0, id).run()
}

export async function createSensorReading(
  env: CloudflareBindings,
  input: Omit<SensorReading, 'recorded_at'>
) {
  const db = requireDatabase(env)
  await db.prepare(
    'INSERT INTO sensor_readings (id, device_id, temperature_c, stepper_status, servo_angle) VALUES (?1, ?2, ?3, ?4, ?5)'
  ).bind(input.id, input.device_id, input.temperature_c, input.stepper_status, input.servo_angle).run()
  return db.prepare(
    'SELECT id, device_id, temperature_c, stepper_status, servo_angle, recorded_at FROM sensor_readings WHERE id = ?1'
  ).bind(input.id).first<SensorReading>()
}

export async function listSensorReadings(env: CloudflareBindings, limit = 50) {
  const db = requireDatabase(env)
  const result = await db.prepare(
    'SELECT id, device_id, temperature_c, stepper_status, servo_angle, recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT ?1'
  ).bind(limit).all<SensorReading>()
  return result.results
}
