const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// MODELOS
const Usuario = mongoose.model('Usuario', new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 40 },
  passwordHash: { type: String, required: true }
}, { timestamps: true }));

const Ticket = mongoose.model('Ticket', new mongoose.Schema({
  titulo: { type: String, required: true, trim: true, maxlength: 120 },
  descripcion: { type: String, default: '', maxlength: 2000 },
  prioridad: { type: String, enum: ['Baja', 'Media', 'Alta'], default: 'Media' },
  estado: { type: String, enum: ['Abierto', 'En progreso', 'Cerrado'], default: 'Abierto' },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
}, { timestamps: true }));

const Tarea = mongoose.model('Tarea', new mongoose.Schema({
  titulo: { type: String, required: true, trim: true, maxlength: 120 },
  descripcion: { type: String, default: '', maxlength: 2000 },
  estado: { type: String, enum: ['Pendiente', 'En progreso', 'Completada'], default: 'Pendiente' },
  fechaLimite: { type: Date, default: null },
  creadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
}, { timestamps: true }));

const Mensaje = mongoose.model('Mensaje', new mongoose.Schema({
  de: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  deNombre: { type: String, required: true },
  para: { type: String, default: null }, // null = chat global; username = privado
  mensaje: { type: String, required: true, maxlength: 2000, trim: true }
}, { timestamps: true }));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Sesión inválida o vencida.' });
  }
}

function textoValido(value, max = 120) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

// ENDPOINTS DE AUTENTICACIÓN
app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!textoValido(username, 40) || username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 40 caracteres y la contraseña al menos 6.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = await Usuario.create({ username, passwordHash });
    const token = jwt.sign({ id: usuario._id.toString(), username: usuario.username }, JWT_SECRET, { expiresIn: '12h' });
    res.status(201).json({ token, username: usuario.username });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    console.error(error);
    res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const usuario = await Usuario.findOne({ username });
    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    const token = jwt.sign({ id: usuario._id.toString(), username: usuario.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: usuario.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

app.get('/api/usuarios', auth, async (_req, res) => {
  const usuarios = await Usuario.find({}, 'username').sort({ username: 1 }).lean();
  res.json(usuarios);
});

// ENDPOINTS DE TICKETS
app.get('/api/tickets', auth, async (req, res) => {
  const tickets = await Ticket.find({ creadoPor: req.auth.id }).sort({ createdAt: -1 }).lean();
  res.json(tickets);
});
app.post('/api/tickets', auth, async (req, res) => {
  try {
    const { titulo, descripcion = '', prioridad = 'Media' } = req.body;
    if (!textoValido(titulo, 120)) return res.status(400).json({ error: 'Escribe un título para el ticket.' });
    if (!['Baja', 'Media', 'Alta'].includes(prioridad)) return res.status(400).json({ error: 'Prioridad no válida.' });
    const ticket = await Ticket.create({ titulo: titulo.trim(), descripcion: String(descripcion).slice(0, 2000), prioridad, creadoPor: req.auth.id });
    res.status(201).json(ticket);
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo crear el ticket.' }); }
});
app.patch('/api/tickets/:id', auth, async (req, res) => {
  if (!['Abierto', 'En progreso', 'Cerrado'].includes(req.body.estado)) return res.status(400).json({ error: 'Estado no válido.' });
  const ticket = await Ticket.findOneAndUpdate({ _id: req.params.id, creadoPor: req.auth.id }, { estado: req.body.estado }, { new: true, runValidators: true });
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
  res.json(ticket);
});

// ENDPOINTS DE TAREAS
app.get('/api/tareas', auth, async (req, res) => {
  const tareas = await Tarea.find({ creadaPor: req.auth.id }).sort({ createdAt: -1 }).lean();
  res.json(tareas);
});
app.post('/api/tareas', auth, async (req, res) => {
  try {
    const { titulo, descripcion = '', fechaLimite = null } = req.body;
    if (!textoValido(titulo, 120)) return res.status(400).json({ error: 'Escribe un título para la tarea.' });
    const tarea = await Tarea.create({ titulo: titulo.trim(), descripcion: String(descripcion).slice(0, 2000), fechaLimite: fechaLimite || null, creadaPor: req.auth.id });
    res.status(201).json(tarea);
  } catch (error) { console.error(error); res.status(400).json({ error: 'No se pudo crear la tarea. Revisa la fecha.' }); }
});
app.patch('/api/tareas/:id', auth, async (req, res) => {
  if (!['Pendiente', 'En progreso', 'Completada'].includes(req.body.estado)) return res.status(400).json({ error: 'Estado no válido.' });
  const tarea = await Tarea.findOneAndUpdate({ _id: req.params.id, creadaPor: req.auth.id }, { estado: req.body.estado }, { new: true, runValidators: true });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  res.json(tarea);
});

// ENDPOINTS DE CHAT (global y privado)
app.get('/api/mensajes', auth, async (req, res) => {
  const para = typeof req.query.para === 'string' && req.query.para ? req.query.para : null;
  const filtro = para
    ? { $or: [
        { para: null },
        { $and: [ { deNombre: req.auth.username }, { para } ] },
        { $and: [ { deNombre: para }, { para: req.auth.username } ] }
      ] }
    : { para: null };
  const mensajes = await Mensaje.find(filtro).sort({ createdAt: 1 }).limit(300).lean();
  res.json(mensajes.map(m => ({ ...m, de: m.deNombre })));
});
app.post('/api/mensajes', auth, async (req, res) => {
  const mensaje = String(req.body.mensaje || '').trim();
  const para = typeof req.body.para === 'string' && req.body.para.trim() ? req.body.para.trim() : null;
  if (!textoValido(mensaje, 2000)) return res.status(400).json({ error: 'El mensaje no puede estar vacío ni superar 2000 caracteres.' });
  if (para && para === req.auth.username) return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo.' });
  const nuevo = await Mensaje.create({ de: req.auth.id, deNombre: req.auth.username, para, mensaje });
  res.status(201).json({ ...nuevo.toObject(), de: nuevo.deNombre });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, servicio: 'Chat SaaS', baseDatos: mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

async function iniciar() {
  if (!MONGODB_URI) {
    console.error('Falta configurar MONGODB_URI en las variables de entorno.');
    process.exit(1);
  }
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('Configura JWT_SECRET con una cadena aleatoria de al menos 32 caracteres.');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB.');
  app.listen(PORT, () => console.log(`Servidor listo en el puerto ${PORT}`));
}
iniciar().catch(error => { console.error('No se pudo iniciar el servidor:', error.message); process.exit(1); });
