import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSql } from './db.js';
import { HttpError, newId, userToPublic } from './util.js';

const TOKEN_DAYS = 30;

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no está configurada');
  return s;
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getSecret(),
    { expiresIn: `${TOKEN_DAYS}d` }
  );
}

export function getAuthUser(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer (.+)$/);
  if (!m) throw new HttpError(401, 'No autenticado');
  try {
    return jwt.verify(m[1], getSecret());
  } catch {
    throw new HttpError(401, 'Sesión expirada, vuelve a iniciar sesión');
  }
}

export function requireAdmin(auth) {
  if (auth.role !== 'admin') throw new HttpError(403, 'Requiere rol de administrador');
}

export async function login(email, password) {
  if (!email || !password) throw new HttpError(400, 'Email y contraseña son obligatorios');
  const sql = getSql();
  const rows = await sql.query(
    'SELECT * FROM app_users WHERE lower(email) = lower($1)', [String(email).trim()]
  );
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }
  if (user.disabled) throw new HttpError(403, 'Usuario deshabilitado');
  return { token: signToken(user), user: userToPublic(user) };
}

export async function getMe(auth) {
  const sql = getSql();
  const rows = await sql.query('SELECT * FROM app_users WHERE id = $1', [auth.sub]);
  if (!rows[0]) throw new HttpError(401, 'Usuario no existe');
  return userToPublic(rows[0]);
}

// updateMyUserData: campos arbitrarios (ej. pinned_shortcuts) van a data jsonb
export async function updateMyData(auth, patch) {
  const sql = getSql();
  const { full_name, ...rest } = patch || {};
  const rows = await sql.query(
    `UPDATE app_users
     SET data = data || $2::jsonb,
         full_name = COALESCE($3, full_name),
         updated_date = now()
     WHERE id = $1 RETURNING *`,
    [auth.sub, JSON.stringify(rest), full_name ?? null]
  );
  if (!rows[0]) throw new HttpError(404, 'Usuario no existe');
  return userToPublic(rows[0]);
}

export async function listUsers() {
  const sql = getSql();
  const rows = await sql.query('SELECT * FROM app_users ORDER BY created_date');
  return rows.map(userToPublic);
}

export async function createUser(body) {
  const { email, password, full_name, role } = body || {};
  if (!email || !password) throw new HttpError(400, 'Email y contraseña son obligatorios');
  if (String(password).length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  const sql = getSql();
  const id = newId();
  try {
    const rows = await sql.query(
      `INSERT INTO app_users (id, email, password_hash, full_name, role)
       VALUES ($1, lower($2), $3, $4, $5) RETURNING *`,
      [id, String(email).trim(), hashPassword(password), full_name || '', role || 'operario']
    );
    return userToPublic(rows[0]);
  } catch (e) {
    if (String(e.message).includes('app_users_email_key')) {
      throw new HttpError(409, 'Ya existe un usuario con ese email');
    }
    throw e;
  }
}

export async function updateUser(id, body) {
  const sql = getSql();
  const { full_name, role, password, disabled, email, ...rest } = body || {};
  const rows = await sql.query(
    `UPDATE app_users SET
       full_name = COALESCE($2, full_name),
       role = COALESCE($3, role),
       password_hash = COALESCE($4, password_hash),
       disabled = COALESCE($5, disabled),
       email = COALESCE($6, email),
       data = data || $7::jsonb,
       updated_date = now()
     WHERE id = $1 RETURNING *`,
    [
      id,
      full_name ?? null,
      role ?? null,
      password ? hashPassword(password) : null,
      typeof disabled === 'boolean' ? disabled : null,
      email ? String(email).trim().toLowerCase() : null,
      JSON.stringify(rest),
    ]
  );
  if (!rows[0]) throw new HttpError(404, 'Usuario no existe');
  return userToPublic(rows[0]);
}

export async function deleteUser(id, auth) {
  if (id === auth.sub) throw new HttpError(400, 'No puedes eliminar tu propio usuario');
  const sql = getSql();
  await sql.query('DELETE FROM app_users WHERE id = $1', [id]);
  return { ok: true };
}
