import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/iam/UsersPage'
import { RolesPage } from '@/pages/iam/RolesPage'
import { PermissionsMatrixPage } from '@/pages/iam/PermissionsMatrixPage'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import { CustomersPage } from '@/pages/cadastros/CustomersPage'
import { CustomerMergePage } from '@/pages/cadastros/CustomerMergePage'
import { PriceHistoryPage } from '@/pages/cadastros/PriceHistoryPage'
import { BatchExportPage } from '@/pages/cadastros/BatchExportPage'
import { ProductsPage } from '@/pages/cadastros/ProductsPage'
import { ServicesPage } from '@/pages/cadastros/ServicesPage'
import { SuppliersPage } from '@/pages/cadastros/SuppliersPage'
import { WorkOrdersListPage } from '@/pages/os/WorkOrdersListPage'
import { WorkOrderKanbanPage } from '@/pages/os/WorkOrderKanbanPage'

// Portal do Cliente
import { PortalLoginPage } from './pages/portal/PortalLoginPage'
import { PortalLayout } from './components/layout/PortalLayout'
import { PortalDashboardPage } from './pages/portal/PortalDashboardPage'
import { PortalWorkOrdersPage } from './pages/portal/PortalWorkOrdersPage'
import { PortalQuotesPage } from './pages/portal/PortalQuotesPage'
import { PortalFinancialsPage } from './pages/portal/PortalFinancialsPage'
import { PortalServiceCallPage } from './pages/portal/PortalServiceCallPage'
import { usePortalAuthStore } from './stores/portal-auth-store'

import { WorkOrderCreatePage } from '@/pages/os/WorkOrderCreatePage'
import { WorkOrderDetailPage } from '@/pages/os/WorkOrderDetailPage'
import { RecurringContractsPage } from '@/pages/os/RecurringContractsPage'
import { SchedulesPage } from '@/pages/tecnicos/SchedulesPage'
import { TimeEntriesPage } from '@/pages/tecnicos/TimeEntriesPage'
import { TechnicianCashPage } from '@/pages/tecnicos/TechnicianCashPage'
import { AccountsReceivablePage } from '@/pages/financeiro/AccountsReceivablePage'
import { AccountsPayablePage } from '@/pages/financeiro/AccountsPayablePage'
import { CommissionsPage } from '@/pages/financeiro/CommissionsPage'
import { CommissionDashboardPage } from '@/pages/financeiro/CommissionDashboardPage'
import { ExpensesPage } from '@/pages/financeiro/ExpensesPage'
import { PaymentMethodsPage } from '@/pages/financeiro/PaymentMethodsPage'
import { PaymentsPage } from '@/pages/financeiro/PaymentsPage'
import { CashFlowPage } from '@/pages/financeiro/CashFlowPage'
import { InvoicesPage } from '@/pages/financeiro/InvoicesPage'
import { BankReconciliationPage } from '@/pages/financeiro/BankReconciliationPage'
import { ChartOfAccountsPage } from '@/pages/financeiro/ChartOfAccountsPage'
import { SlaPoliciesPage } from '@/pages/os/SlaPoliciesPage'
import { SlaDashboardPage } from '@/pages/os/SlaDashboardPage'
import { ServiceChecklistsPage } from '@/pages/os/ServiceChecklistsPage'
import { NotificationsPage } from '@/pages/notificacoes/NotificationsPage'
import { AccountPayableCategoriesPage } from '@/pages/financeiro/AccountPayableCategoriesPage'
import { ReportsPage } from '@/pages/relatorios/ReportsPage'
import { SettingsPage } from '@/pages/configuracoes/SettingsPage'
import { BranchesPage } from '@/pages/configuracoes/BranchesPage'
import { ProfilePage } from '@/pages/configuracoes/ProfilePage'
import { TenantManagementPage } from '@/pages/configuracoes/TenantManagementPage'
import { QuotesListPage } from '@/pages/orcamentos/QuotesListPage'
import { QuoteCreatePage } from '@/pages/orcamentos/QuoteCreatePage'
import { QuoteDetailPage } from '@/pages/orcamentos/QuoteDetailPage'
import { ServiceCallsPage } from '@/pages/chamados/ServiceCallsPage'
import { ServiceCallMapPage } from '@/pages/chamados/ServiceCallMapPage'
import { TechnicianAgendaPage } from '@/pages/chamados/TechnicianAgendaPage'
import { ServiceCallDetailPage } from '@/pages/chamados/ServiceCallDetailPage'
import ImportPage from '@/pages/importacao/ImportPage'
import EquipmentListPage from '@/pages/equipamentos/EquipmentListPage'
import EquipmentDetailPage from '@/pages/equipamentos/EquipmentDetailPage'
import EquipmentCreatePage from '@/pages/equipamentos/EquipmentCreatePage'
import EquipmentCalendarPage from '@/pages/equipamentos/EquipmentCalendarPage'
import { CrmDashboardPage } from '@/pages/CrmDashboardPage'
import { CrmPipelinePage } from '@/pages/CrmPipelinePage'
import { Customer360Page } from '@/pages/CrmCustomer360Page'
import { MessageTemplatesPage } from '@/pages/MessageTemplatesPage'
import { StockDashboardPage } from '@/pages/estoque/StockDashboardPage'
import { StockMovementsPage } from '@/pages/estoque/StockMovementsPage'
import { CentralPage } from '@/pages/central/CentralPage'
import { CentralDashboardPage } from '@/pages/central/CentralDashboardPage'
import { CentralRulesPage } from '@/pages/central/CentralRulesPage'

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
  const { isAuthenticated, fetchMe, logout } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe().catch(() => {
        logout()
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppLayout>{children}</AppLayout>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function ProtectedPortalRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = usePortalAuthStore()
  if (!isAuthenticated) return <Navigate to="/portal/login" replace />
  return <PortalLayout>{children}</PortalLayout>
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

          {/* Central (Inbox) */}
          <Route path="/central" element={<ProtectedRoute><CentralPage /></ProtectedRoute>} />
          <Route path="/central/dashboard" element={<ProtectedRoute><CentralDashboardPage /></ProtectedRoute>} />
          <Route path="/central/regras" element={<ProtectedRoute><CentralRulesPage /></ProtectedRoute>} />

          {/* IAM */}
          <Route path="/iam/usuarios" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/iam/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
          <Route path="/iam/permissoes" element={<ProtectedRoute><PermissionsMatrixPage /></ProtectedRoute>} />
          <Route path="/admin/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />

          {/* Cadastros */}
          <Route path="/cadastros/clientes" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
          <Route path="/cadastros/clientes/fusao" element={<ProtectedRoute><CustomerMergePage /></ProtectedRoute>} />
          <Route path="/cadastros/produtos" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/cadastros/servicos" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
          <Route path="/cadastros/historico-precos" element={<ProtectedRoute><PriceHistoryPage /></ProtectedRoute>} />
          <Route path="/cadastros/exportacao-lote" element={<ProtectedRoute><BatchExportPage /></ProtectedRoute>} />
          <Route path="/cadastros/fornecedores" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />

          {/* Orçamentos */}
          <Route path="/orcamentos" element={<ProtectedRoute><QuotesListPage /></ProtectedRoute>} />
          <Route path="/orcamentos/novo" element={<ProtectedRoute><QuoteCreatePage /></ProtectedRoute>} />
          <Route path="/orcamentos/:id" element={<ProtectedRoute><QuoteDetailPage /></ProtectedRoute>} />

          {/* Chamados Técnicos */}
          <Route path="/chamados" element={<ProtectedRoute><ServiceCallsPage /></ProtectedRoute>} />
          <Route path="/chamados/mapa" element={<ProtectedRoute><ServiceCallMapPage /></ProtectedRoute>} />
          <Route path="/chamados/agenda" element={<ProtectedRoute><TechnicianAgendaPage /></ProtectedRoute>} />
          <Route path="/chamados/:id" element={<ProtectedRoute><ServiceCallDetailPage /></ProtectedRoute>} />

          {/* Ordens de Serviço */}
          <Route path="/os" element={<ProtectedRoute><WorkOrdersListPage /></ProtectedRoute>} />
          <Route path="/os/kanban" element={<ProtectedRoute><WorkOrderKanbanPage /></ProtectedRoute>} />
          <Route path="/os/nova" element={<ProtectedRoute><WorkOrderCreatePage /></ProtectedRoute>} />
          <Route path="/os/:id" element={<ProtectedRoute><WorkOrderDetailPage /></ProtectedRoute>} />
          <Route path="/os/contratos-recorrentes" element={<ProtectedRoute><RecurringContractsPage /></ProtectedRoute>} />
          <Route path="/os/sla" element={<ProtectedRoute><SlaPoliciesPage /></ProtectedRoute>} />
          <Route path="/os/sla-dashboard" element={<ProtectedRoute><SlaDashboardPage /></ProtectedRoute>} />
          <Route path="/os/checklists" element={<ProtectedRoute><ServiceChecklistsPage /></ProtectedRoute>} />

          {/* Técnicos */}
          <Route path="/tecnicos/agenda" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
          <Route path="/tecnicos/apontamentos" element={<ProtectedRoute><TimeEntriesPage /></ProtectedRoute>} />
          <Route path="/tecnicos/caixa" element={<ProtectedRoute><TechnicianCashPage /></ProtectedRoute>} />

          {/* Financeiro */}
          <Route path="/financeiro/receber" element={<ProtectedRoute><AccountsReceivablePage /></ProtectedRoute>} />
          <Route path="/financeiro/pagar" element={<ProtectedRoute><AccountsPayablePage /></ProtectedRoute>} />
          <Route path="/financeiro/comissoes" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
          <Route path="/financeiro/comissoes/dashboard" element={<ProtectedRoute><CommissionDashboardPage /></ProtectedRoute>} />
          <Route path="/financeiro/despesas" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/financeiro/pagamentos" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="/financeiro/formas-pagamento" element={<ProtectedRoute><PaymentMethodsPage /></ProtectedRoute>} />
          <Route path="/financeiro/fluxo-caixa" element={<ProtectedRoute><CashFlowPage /></ProtectedRoute>} />
          <Route path="/financeiro/faturamento" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
          <Route path="/financeiro/conciliacao-bancaria" element={<ProtectedRoute><BankReconciliationPage /></ProtectedRoute>} />
          <Route path="/financeiro/plano-contas" element={<ProtectedRoute><ChartOfAccountsPage /></ProtectedRoute>} />
          <Route path="/financeiro/categorias-pagar" element={<ProtectedRoute><AccountPayableCategoriesPage /></ProtectedRoute>} />

          {/* Estoque */}
          <Route path="/estoque" element={<ProtectedRoute><StockDashboardPage /></ProtectedRoute>} />
          <Route path="/estoque/movimentacoes" element={<ProtectedRoute><StockMovementsPage /></ProtectedRoute>} />

          {/* Relatórios */}
          <Route path="/relatorios" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/notificacoes" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

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
          <Route path="/configuracoes/auditoria" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* CRM */}
          <Route path="/crm" element={<ProtectedRoute><CrmDashboardPage /></ProtectedRoute>} />
          <Route path="/crm/pipeline/:id" element={<ProtectedRoute><CrmPipelinePage /></ProtectedRoute>} />
          <Route path="/crm/pipeline" element={<ProtectedRoute><CrmPipelinePage /></ProtectedRoute>} />
          <Route path="/crm/clientes/:id" element={<ProtectedRoute><Customer360Page /></ProtectedRoute>} />
          <Route path="/crm/templates" element={<ProtectedRoute><MessageTemplatesPage /></ProtectedRoute>} />

          {/* Catch-all */}

          {/* Rotas do Portal do Cliente */}
          <Route path="/portal/login" element={<PortalLoginPage />} />
          <Route path="/portal" element={<ProtectedPortalRoute><PortalDashboardPage /></ProtectedPortalRoute>} />
          <Route path="/portal/os" element={<ProtectedPortalRoute><PortalWorkOrdersPage /></ProtectedPortalRoute>} />
          <Route path="/portal/orcamentos" element={<ProtectedPortalRoute><PortalQuotesPage /></ProtectedPortalRoute>} />
          <Route path="/portal/financeiro" element={<ProtectedPortalRoute><PortalFinancialsPage /></ProtectedPortalRoute>} />
          <Route path="/portal/chamados/novo" element={<ProtectedPortalRoute><PortalServiceCallPage /></ProtectedPortalRoute>} />

          {/* Fallback para URLs não encontradas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
