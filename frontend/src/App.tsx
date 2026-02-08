import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/iam/UsersPage'
import { RolesPage } from '@/pages/iam/RolesPage'
import { PermissionsMatrixPage } from '@/pages/iam/PermissionsMatrixPage'
import { CustomersPage } from '@/pages/cadastros/CustomersPage'
import { ProductsPage } from '@/pages/cadastros/ProductsPage'
import { ServicesPage } from '@/pages/cadastros/ServicesPage'
import { WorkOrdersListPage } from '@/pages/os/WorkOrdersListPage'
import { WorkOrderCreatePage } from '@/pages/os/WorkOrderCreatePage'
import { WorkOrderDetailPage } from '@/pages/os/WorkOrderDetailPage'
import { RecurringContractsPage } from '@/pages/os/RecurringContractsPage'
import { SchedulesPage } from '@/pages/tecnicos/SchedulesPage'
import { TimeEntriesPage } from '@/pages/tecnicos/TimeEntriesPage'
import { TechnicianCashPage } from '@/pages/tecnicos/TechnicianCashPage'
import { AccountsReceivablePage } from '@/pages/financeiro/AccountsReceivablePage'
import { AccountsPayablePage } from '@/pages/financeiro/AccountsPayablePage'
import { CommissionsPage } from '@/pages/financeiro/CommissionsPage'
import { ExpensesPage } from '@/pages/financeiro/ExpensesPage'
import { ReportsPage } from '@/pages/relatorios/ReportsPage'
import { SettingsPage } from '@/pages/configuracoes/SettingsPage'
import { BranchesPage } from '@/pages/configuracoes/BranchesPage'
import { ProfilePage } from '@/pages/configuracoes/ProfilePage'
import { TenantManagementPage } from '@/pages/configuracoes/TenantManagementPage'
import { AuditLogsPage } from '@/pages/configuracoes/AuditLogsPage'
import { QuotesListPage } from '@/pages/orcamentos/QuotesListPage'
import { QuoteCreatePage } from '@/pages/orcamentos/QuoteCreatePage'
import { QuoteDetailPage } from '@/pages/orcamentos/QuoteDetailPage'
import { ServiceCallsPage } from '@/pages/chamados/ServiceCallsPage'
import { ServiceCallMapPage } from '@/pages/chamados/ServiceCallMapPage'
import { TechnicianAgendaPage } from '@/pages/chamados/TechnicianAgendaPage'
import ImportPage from '@/pages/importacao/ImportPage'
import EquipmentListPage from '@/pages/equipamentos/EquipmentListPage'
import EquipmentDetailPage from '@/pages/equipamentos/EquipmentDetailPage'
import EquipmentCreatePage from '@/pages/equipamentos/EquipmentCreatePage'
import EquipmentCalendarPage from '@/pages/equipamentos/EquipmentCalendarPage'
import { CrmDashboardPage } from '@/pages/CrmDashboardPage'
import { CrmPipelinePage } from '@/pages/CrmPipelinePage'
import { Customer360Page } from '@/pages/CrmCustomer360Page'
import { MessageTemplatesPage } from '@/pages/MessageTemplatesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppLayout>{children}</AppLayout>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />

          {/* Rotas autenticadas */}
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

          {/* IAM */}
          <Route path="/iam/usuarios" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/iam/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
          <Route path="/iam/permissoes" element={<ProtectedRoute><PermissionsMatrixPage /></ProtectedRoute>} />

          {/* Cadastros */}
          <Route path="/cadastros/clientes" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
          <Route path="/cadastros/produtos" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/cadastros/servicos" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />

          {/* Orçamentos */}
          <Route path="/orcamentos" element={<ProtectedRoute><QuotesListPage /></ProtectedRoute>} />
          <Route path="/orcamentos/novo" element={<ProtectedRoute><QuoteCreatePage /></ProtectedRoute>} />
          <Route path="/orcamentos/:id" element={<ProtectedRoute><QuoteDetailPage /></ProtectedRoute>} />

          {/* Chamados Técnicos */}
          <Route path="/chamados" element={<ProtectedRoute><ServiceCallsPage /></ProtectedRoute>} />
          <Route path="/chamados/mapa" element={<ProtectedRoute><ServiceCallMapPage /></ProtectedRoute>} />
          <Route path="/chamados/agenda" element={<ProtectedRoute><TechnicianAgendaPage /></ProtectedRoute>} />

          {/* Ordens de Serviço */}
          <Route path="/os" element={<ProtectedRoute><WorkOrdersListPage /></ProtectedRoute>} />
          <Route path="/os/nova" element={<ProtectedRoute><WorkOrderCreatePage /></ProtectedRoute>} />
          <Route path="/os/:id" element={<ProtectedRoute><WorkOrderDetailPage /></ProtectedRoute>} />
          <Route path="/os/contratos-recorrentes" element={<ProtectedRoute><RecurringContractsPage /></ProtectedRoute>} />

          {/* Técnicos */}
          <Route path="/tecnicos/agenda" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
          <Route path="/tecnicos/apontamentos" element={<ProtectedRoute><TimeEntriesPage /></ProtectedRoute>} />
          <Route path="/tecnicos/caixa" element={<ProtectedRoute><TechnicianCashPage /></ProtectedRoute>} />

          {/* Financeiro */}
          <Route path="/financeiro/receber" element={<ProtectedRoute><AccountsReceivablePage /></ProtectedRoute>} />
          <Route path="/financeiro/pagar" element={<ProtectedRoute><AccountsPayablePage /></ProtectedRoute>} />
          <Route path="/financeiro/comissoes" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
          <Route path="/financeiro/despesas" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />

          {/* Relatórios */}
          <Route path="/relatorios" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

          {/* Importação */}
          <Route path="/importacao" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />

          {/* Equipamentos */}
          <Route path="/equipamentos" element={<ProtectedRoute><EquipmentListPage /></ProtectedRoute>} />
          <Route path="/equipamentos/novo" element={<ProtectedRoute><EquipmentCreatePage /></ProtectedRoute>} />
          <Route path="/equipamentos/:id" element={<ProtectedRoute><EquipmentDetailPage /></ProtectedRoute>} />
          <Route path="/agenda-calibracoes" element={<ProtectedRoute><EquipmentCalendarPage /></ProtectedRoute>} />

          {/* Configurações */}
          <Route path="/configuracoes" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/configuracoes/filiais" element={<ProtectedRoute><BranchesPage /></ProtectedRoute>} />
          <Route path="/configuracoes/empresas" element={<ProtectedRoute><TenantManagementPage /></ProtectedRoute>} />
          <Route path="/configuracoes/auditoria" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* CRM */}
          <Route path="/crm" element={<ProtectedRoute><CrmDashboardPage /></ProtectedRoute>} />
          <Route path="/crm/pipeline/:id" element={<ProtectedRoute><CrmPipelinePage /></ProtectedRoute>} />
          <Route path="/crm/pipeline" element={<ProtectedRoute><CrmPipelinePage /></ProtectedRoute>} />
          <Route path="/crm/clientes/:id" element={<ProtectedRoute><Customer360Page /></ProtectedRoute>} />
          <Route path="/crm/templates" element={<ProtectedRoute><MessageTemplatesPage /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
