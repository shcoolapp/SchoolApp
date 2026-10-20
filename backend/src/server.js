require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const subjectRoutes = require('./routes/subjects');
const subjectImportRoutes = require('./routes/subjectImport');
const marksRoutes = require('./routes/marks');
const homeworkRoutes = require('./routes/homework');
const examRoutes = require('./routes/exams');
const todoRoutes = require('./routes/todos');
const holidayRoutes = require('./routes/holidays');
const archiveRoutes = require('./routes/archive');
const adminRoutes = require('./routes/admin');
const { seedDefaultAdmin } = require('./utils/seedAdmin');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/subjects', subjectImportRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`School portal backend running on port ${PORT}`);
  seedDefaultAdmin();
});
