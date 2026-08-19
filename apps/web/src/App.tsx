import { Route, Routes } from 'react-router-dom';

import { ApiKeyGate } from './auth/ApiKeyGate';
import { Layout } from './components/Layout';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { DlqPage } from './pages/DlqPage';
import { OverviewPage } from './pages/OverviewPage';
import { SubscribersPage } from './pages/SubscribersPage';

export default function App() {
  return (
    <ApiKeyGate>
      <Layout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/subscribers" element={<SubscribersPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/dlq" element={<DlqPage />} />
        </Routes>
      </Layout>
    </ApiKeyGate>
  );
}
