import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import passwordRoutes from './routes/passwords';
import adminRoutes from './routes/admin';
import groupRoutes from './routes/groups';
import termRoutes from './routes/terms';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import realtimeRoutes from './routes/realtime';
import organizationRoutes from './routes/organization';
import passwordRequestRoutes from './routes/password-requests';
import vaultRoutes from './routes/vaults';
import kbRoutes from './routes/kb';
import cmdbRoutes from './routes/cmdb';
import onboardingRoutes from './routes/onboarding';
import complianceRoutes from './routes/compliance';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/passwords', passwordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/password-requests', passwordRequestRoutes);
app.use('/api/vaults', vaultRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/cmdb', cmdbRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/compliance', complianceRoutes);

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => { if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, '../frontend/dist/index.html')); });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
