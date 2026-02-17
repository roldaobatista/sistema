import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { PortalLayout } from './components/layout/PortalLayout'
import { usePortalAuthStore } from './stores/portal-auth-store'
import TechShell from '@/components/layout/TechShell'
import { TechAutoRedirect } from '@/components/auth/TechAutoRedirect'
import { Toaster } from '@/components/ui/sonner'

// --- Lazy-loaded pages (code splitting) ---
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const UsersPage = lazy(() => import('@/pages/iam/UsersPage').then(m => ({ default: m.UsersPage })))
const RolesPage = lazy(() => import('@/pages/iam/RolesPage').then(m => ({ default: m.RolesPage })))
const PermissionsMatrixPage = lazy(() => import('@/pages/iam/PermissionsMatrixPage').then(m => ({ default: m.PermissionsMatrixPage })))
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const CustomersPage = lazy(() => import('@/pages/cadastros/CustomersPage').then(m => ({ default: m.CustomersPage })))
const Customer360Page = lazy(() => import('@/pages/cadastros/Customer360Page').then(m => ({ default: m.Customer360Page })))
const CustomerMergePage = lazy(() => import('@/pages/cadastros/CustomerMergePage').then(m => ({ default: m.CustomerMergePage })))
const PriceHistoryPage = lazy(() => import('@/pages/cadastros/PriceHistoryPage').then(m => ({ default: m.PriceHistoryPage })))
const BatchExportPage = lazy(() => import('@/pages/cadastros/BatchExportPage').then(m => ({ default: m.BatchExportPage })))
const ProductsPage = lazy(() => import('@/pages/cadastros/ProductsPage').then(m => ({ default: m.ProductsPage })))
const ServicesPage = lazy(() => import('@/pages/cadastros/ServicesPage').then(m => ({ default: m.ServicesPage })))
const SuppliersPage = lazy(() => import('@/pages/cadastros/SuppliersPage').then(m => ({ default: m.SuppliersPage })))
const CatalogAdminPage = lazy(() => import('@/pages/catalogo/CatalogAdminPage').then(m => ({ default: m.CatalogAdminPage })))
const CatalogPublicPage = lazy(() => import('@/pages/catalogo/CatalogPublicPage'))
const WorkOrdersListPage = lazy(() => import('@/pages/os/WorkOrdersListPage').then(m => ({ default: m.WorkOrdersListPage })))
const WorkOrderKanbanPage = lazy(() => import('@/pages/os/WorkOrderKanbanPage').then(m => ({ default: m.WorkOrderKanbanPage })))

// Portal do Cliente
const PortalLoginPage = lazy(() => import('./pages/portal/PortalLoginPage').then(m => ({ default: m.PortalLoginPage })))
const PortalDashboardPage = lazy(() => import('./pages/portal/PortalDashboardPage').then(m => ({ default: m.PortalDashboardPage })))
const PortalWorkOrdersPage = lazy(() => import('./pages/portal/PortalWorkOrdersPage').then(m => ({ default: m.PortalWorkOrdersPage })))
const PortalQuotesPage = lazy(() => import('./pages/portal/PortalQuotesPage').then(m => ({ default: m.PortalQuotesPage })))
const PortalFinancialsPage = lazy(() => import('./pages/portal/PortalFinancialsPage').then(m => ({ default: m.PortalFinancialsPage })))
const PortalServiceCallPage = lazy(() => import('./pages/portal/PortalServiceCallPage').then(m => ({ default: m.PortalServiceCallPage })))

const WorkOrderCreatePage = lazy(() => import('@/pages/os/WorkOrderCreatePage').then(m => ({ default: m.WorkOrderCreatePage })))
const WorkOrderDetailPage = lazy(() => import('@/pages/os/WorkOrderDetailPage').then(m => ({ default: m.WorkOrderDetailPage })))
const RecurringContractsPage = lazy(() => import('@/pages/os/RecurringContractsPage').then(m => ({ default: m.RecurringContractsPage })))
const SchedulesPage = lazy(() => import('@/pages/tecnicos/SchedulesPage').then(m => ({ default: m.SchedulesPage })))
const TimeEntriesPage = lazy(() => import('@/pages/tecnicos/TimeEntriesPage').then(m => ({ default: m.TimeEntriesPage })))
const TechnicianCashPage = lazy(() => import('@/pages/tecnicos/TechnicianCashPage').then(m => ({ default: m.TechnicianCashPage })))
const AccountsReceivablePage = lazy(() => import('@/pages/financeiro/AccountsReceivablePage').then(m => ({ default: m.AccountsReceivablePage })))
const AccountsPayablePage = lazy(() => import('@/pages/financeiro/AccountsPayablePage').then(m => ({ default: m.AccountsPayablePage })))
const CommissionsPage = lazy(() => import('@/pages/financeiro/CommissionsPage').then(m => ({ default: m.CommissionsPage })))
const CommissionDashboardPage = lazy(() => import('@/pages/financeiro/CommissionDashboardPage').then(m => ({ default: m.CommissionDashboardPage })))
const ExpensesPage = lazy(() => import('@/pages/financeiro/ExpensesPage').then(m => ({ default: m.ExpensesPage })))
const FuelingLogsPage = lazy(() => import('@/pages/financeiro/FuelingLogsPage').then(m => ({ default: m.FuelingLogsPage })))
const PaymentMethodsPage = lazy(() => import('@/pages/financeiro/PaymentMethodsPage').then(m => ({ default: m.PaymentMethodsPage })))
const PaymentsPage = lazy(() => import('@/pages/financeiro/PaymentsPage').then(m => ({ default: m.PaymentsPage })))
const CashFlowPage = lazy(() => import('@/pages/financeiro/CashFlowPage').then(m => ({ default: m.CashFlowPage })))
const CashFlowWeeklyDashboardPage = lazy(() => import('@/pages/financeiro/CashFlowWeeklyDashboardPage').then(m => ({ default: m.CashFlowWeeklyDashboardPage })))
const InvoicesPage = lazy(() => import('@/pages/financeiro/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const BankReconciliationPage = lazy(() => import('@/pages/financeiro/BankReconciliationPage').then(m => ({ default: m.BankReconciliationPage })))
const ReconciliationRulesPage = lazy(() => import('@/pages/financeiro/ReconciliationRulesPage'))
const ReconciliationDashboardPage = lazy(() => import('@/pages/financeiro/ReconciliationDashboardPage').then(m => ({ default: m.ReconciliationDashboardPage })))
const FinanceiroDashboardPage = lazy(() => import('@/pages/financeiro/FinanceiroDashboardPage').then(m => ({ default: m.FinanceiroDashboardPage })))
const ConsolidatedFinancialPage = lazy(() => import('@/pages/financeiro/ConsolidatedFinancialPage').then(m => ({ default: m.ConsolidatedFinancialPage })))
const ChartOfAccountsPage = lazy(() => import('@/pages/financeiro/ChartOfAccountsPage').then(m => ({ default: m.ChartOfAccountsPage })))
const SlaPoliciesPage = lazy(() => import('@/pages/os/SlaPoliciesPage').then(m => ({ default: m.SlaPoliciesPage })))
const SlaDashboardPage = lazy(() => import('@/pages/os/SlaDashboardPage').then(m => ({ default: m.SlaDashboardPage })))
const ChecklistPage = lazy(() => import('@/pages/operational/checklists/ChecklistPage').then(m => ({ default: m.ChecklistPage })))
const NotificationsPage = lazy(() => import('@/pages/notificacoes/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const AccountPayableCategoriesPage = lazy(() => import('@/pages/financeiro/AccountPayableCategoriesPage').then(m => ({ default: m.AccountPayableCategoriesPage })))
const BankAccountsPage = lazy(() => import('@/pages/financeiro/BankAccountsPage').then(m => ({ default: m.BankAccountsPage })))
const FundTransfersPage = lazy(() => import('@/pages/financeiro/FundTransfersPage').then(m => ({ default: m.FundTransfersPage })))
const FiscalNotesPage = lazy(() => import('@/pages/fiscal/FiscalNotesPage'))
const ReportsPage = lazy(() => import('@/pages/relatorios/ReportsPage').then(m => ({ default: m.ReportsPage })))
const AnalyticsHubPage = lazy(() => import('@/pages/analytics/AnalyticsHubPage').then(m => ({ default: m.AnalyticsHubPage })))
const SettingsPage = lazy(() => import('@/pages/configuracoes/SettingsPage').then(m => ({ default: m.SettingsPage })))
const BranchesPage = lazy(() => import('@/pages/configuracoes/BranchesPage').then(m => ({ default: m.BranchesPage })))
const ProfilePage = lazy(() => import('@/pages/configuracoes/ProfilePage').then(m => ({ default: m.ProfilePage })))
const TenantManagementPage = lazy(() => import('@/pages/configuracoes/TenantManagementPage').then(m => ({ default: m.TenantManagementPage })))
const QuotesListPage = lazy(() => import('@/pages/orcamentos/QuotesListPage').then(m => ({ default: m.QuotesListPage })))
const QuoteCreatePage = lazy(() => import('@/pages/orcamentos/QuoteCreatePage').then(m => ({ default: m.QuoteCreatePage })))
const QuoteDetailPage = lazy(() => import('@/pages/orcamentos/QuoteDetailPage').then(m => ({ default: m.QuoteDetailPage })))
const QuoteEditPage = lazy(() => import('@/pages/orcamentos/QuoteEditPage').then(m => ({ default: m.QuoteEditPage })))
const ServiceCallsPage = lazy(() => import('@/pages/chamados/ServiceCallsPage').then(m => ({ default: m.ServiceCallsPage })))
const ServiceCallCreatePage = lazy(() => import('@/pages/chamados/ServiceCallCreatePage').then(m => ({ default: m.ServiceCallCreatePage })))
const ServiceCallMapPage = lazy(() => import('@/pages/chamados/ServiceCallMapPage').then(m => ({ default: m.ServiceCallMapPage })))
const TechnicianAgendaPage = lazy(() => import('@/pages/chamados/TechnicianAgendaPage').then(m => ({ default: m.TechnicianAgendaPage })))
const ServiceCallDetailPage = lazy(() => import('@/pages/chamados/ServiceCallDetailPage').then(m => ({ default: m.ServiceCallDetailPage })))
const ServiceCallEditPage = lazy(() => import('@/pages/chamados/ServiceCallEditPage').then(m => ({ default: m.ServiceCallEditPage })))
const ImportPage = lazy(() => import('@/pages/importacao/ImportPage'))
const AuvoImportPage = lazy(() => import('@/pages/integracao/AuvoImportPage'))
const EmailInboxPage = lazy(() => import('@/pages/emails/EmailInboxPage'))
const EmailComposePage = lazy(() => import('@/pages/emails/EmailComposePage'))
const EmailSettingsPage = lazy(() => import('@/pages/emails/EmailSettingsPage'))
const EquipmentListPage = lazy(() => import('@/pages/equipamentos/EquipmentListPage'))
const EquipmentModelsPage = lazy(() => import('@/pages/equipamentos/EquipmentModelsPage').then(m => ({ default: m.default })))
const EquipmentDetailPage = lazy(() => import('@/pages/equipamentos/EquipmentDetailPage'))
const EquipmentEditPage = lazy(() => import('@/pages/equipamentos/EquipmentEditPage').then(m => ({ default: m.default })))
const EquipmentCreatePage = lazy(() => import('@/pages/equipamentos/EquipmentCreatePage'))
const EquipmentCalendarPage = lazy(() => import('@/pages/equipamentos/EquipmentCalendarPage'))
const StandardWeightsPage = lazy(() => import('@/pages/equipamentos/StandardWeightsPage'))
const CrmDashboardPage = lazy(() => import('@/pages/CrmDashboardPage').then(m => ({ default: m.CrmDashboardPage })))
const CrmPipelinePage = lazy(() => import('@/pages/CrmPipelinePage').then(m => ({ default: m.CrmPipelinePage })))
const MessageTemplatesPage = lazy(() => import('@/pages/MessageTemplatesPage').then(m => ({ default: m.MessageTemplatesPage })))
const CrmForecastPage = lazy(() => import('@/pages/crm/CrmForecastPage').then(m => ({ default: m.CrmForecastPage })))
const CrmGoalsPage = lazy(() => import('@/pages/crm/CrmGoalsPage').then(m => ({ default: m.CrmGoalsPage })))
const CrmAlertsPage = lazy(() => import('@/pages/crm/CrmAlertsPage').then(m => ({ default: m.CrmAlertsPage })))
const CrmCalendarPage = lazy(() => import('@/pages/crm/CrmCalendarPage').then(m => ({ default: m.CrmCalendarPage })))
const CrmScoringPage = lazy(() => import('@/pages/crm/CrmScoringPage').then(m => ({ default: m.CrmScoringPage })))
const CrmSequencesPage = lazy(() => import('@/pages/crm/CrmSequencesPage').then(m => ({ default: m.CrmSequencesPage })))
const CrmLossAnalyticsPage = lazy(() => import('@/pages/crm/CrmLossAnalyticsPage').then(m => ({ default: m.CrmLossAnalyticsPage })))
const CrmTerritoriesPage = lazy(() => import('@/pages/crm/CrmTerritoriesPage').then(m => ({ default: m.CrmTerritoriesPage })))
const CrmRenewalsPage = lazy(() => import('@/pages/crm/CrmRenewalsPage').then(m => ({ default: m.CrmRenewalsPage })))
const CrmReferralsPage = lazy(() => import('@/pages/crm/CrmReferralsPage').then(m => ({ default: m.CrmReferralsPage })))
const CrmWebFormsPage = lazy(() => import('@/pages/crm/CrmWebFormsPage').then(m => ({ default: m.CrmWebFormsPage })))
const CrmRevenueIntelligencePage = lazy(() => import('@/pages/crm/CrmRevenueIntelligencePage').then(m => ({ default: m.CrmRevenueIntelligencePage })))
const CrmCompetitorsPage = lazy(() => import('@/pages/crm/CrmCompetitorsPage').then(m => ({ default: m.CrmCompetitorsPage })))
const CrmVelocityPage = lazy(() => import('@/pages/crm/CrmVelocityPage').then(m => ({ default: m.CrmVelocityPage })))
const CrmCohortPage = lazy(() => import('@/pages/crm/CrmCohortPage').then(m => ({ default: m.CrmCohortPage })))
const CrmProposalsPage = lazy(() => import('@/pages/crm/CrmProposalsPage').then(m => ({ default: m.CrmProposalsPage })))
// CRM Field Management (20 novas funcionalidades)
const CrmVisitCheckinsPage = lazy(() => import('@/pages/crm/CrmVisitCheckinsPage').then(m => ({ default: m.CrmVisitCheckinsPage })))
const CrmVisitRoutesPage = lazy(() => import('@/pages/crm/CrmVisitRoutesPage').then(m => ({ default: m.CrmVisitRoutesPage })))
const CrmVisitReportsPage = lazy(() => import('@/pages/crm/CrmVisitReportsPage').then(m => ({ default: m.CrmVisitReportsPage })))
const CrmPortfolioMapPage = lazy(() => import('@/pages/crm/CrmPortfolioMapPage').then(m => ({ default: m.CrmPortfolioMapPage })))
const CrmForgottenClientsPage = lazy(() => import('@/pages/crm/CrmForgottenClientsPage').then(m => ({ default: m.CrmForgottenClientsPage })))
const CrmContactPoliciesPage = lazy(() => import('@/pages/crm/CrmContactPoliciesPage').then(m => ({ default: m.CrmContactPoliciesPage })))
const CrmSmartAgendaPage = lazy(() => import('@/pages/crm/CrmSmartAgendaPage').then(m => ({ default: m.CrmSmartAgendaPage })))
const CrmPostVisitWorkflowPage = lazy(() => import('@/pages/crm/CrmPostVisitWorkflowPage').then(m => ({ default: m.CrmPostVisitWorkflowPage })))
const CrmQuickNotesPage = lazy(() => import('@/pages/crm/CrmQuickNotesPage').then(m => ({ default: m.CrmQuickNotesPage })))
const CrmCommitmentsPage = lazy(() => import('@/pages/crm/CrmCommitmentsPage').then(m => ({ default: m.CrmCommitmentsPage })))
const CrmNegotiationHistoryPage = lazy(() => import('@/pages/crm/CrmNegotiationHistoryPage').then(m => ({ default: m.CrmNegotiationHistoryPage })))
const CrmClientSummaryPage = lazy(() => import('@/pages/crm/CrmClientSummaryPage').then(m => ({ default: m.CrmClientSummaryPage })))
const CrmRfmPage = lazy(() => import('@/pages/crm/CrmRfmPage').then(m => ({ default: m.CrmRfmPage })))
const CrmCoveragePage = lazy(() => import('@/pages/crm/CrmCoveragePage').then(m => ({ default: m.CrmCoveragePage })))
const CrmProductivityPage = lazy(() => import('@/pages/crm/CrmProductivityPage').then(m => ({ default: m.CrmProductivityPage })))
const CrmOpportunitiesPage = lazy(() => import('@/pages/crm/CrmOpportunitiesPage').then(m => ({ default: m.CrmOpportunitiesPage })))
const CrmImportantDatesPage = lazy(() => import('@/pages/crm/CrmImportantDatesPage').then(m => ({ default: m.CrmImportantDatesPage })))
const CrmVisitSurveysPage = lazy(() => import('@/pages/crm/CrmVisitSurveysPage').then(m => ({ default: m.CrmVisitSurveysPage })))
const CrmAccountPlansPage = lazy(() => import('@/pages/crm/CrmAccountPlansPage').then(m => ({ default: m.CrmAccountPlansPage })))
const CrmGamificationPage = lazy(() => import('@/pages/crm/CrmGamificationPage').then(m => ({ default: m.CrmGamificationPage })))
const StockDashboardPage = lazy(() => import('@/pages/estoque/StockDashboardPage').then(m => ({ default: m.StockDashboardPage })))
const StockMovementsPage = lazy(() => import('@/pages/estoque/StockMovementsPage').then(m => ({ default: m.StockMovementsPage })))
const WarehousesPage = lazy(() => import('@/pages/estoque/WarehousesPage').then(m => ({ default: m.WarehousesPage })))
const InventoryListPage = lazy(() => import('@/pages/estoque/InventoryListPage'))
const InventoryExecutionPage = lazy(() => import('@/pages/estoque/InventoryExecutionPage'))
const InventoryCreatePage = lazy(() => import('@/pages/estoque/InventoryCreatePage'))
const InventoryPwaListPage = lazy(() => import('@/pages/estoque/InventoryPwaListPage'))
const InventoryPwaCountPage = lazy(() => import('@/pages/estoque/InventoryPwaCountPage'))
const BatchManagementPage = lazy(() => import('@/pages/estoque/BatchManagementPage'))
const KardexPage = lazy(() => import('@/pages/estoque/KardexPage'))
const StockIntelligencePage = lazy(() => import('@/pages/estoque/StockIntelligencePage'))
const StockLabelsPage = lazy(() => import('@/pages/estoque/StockLabelsPage'))
const StockIntegrationPage = lazy(() => import('@/pages/estoque/StockIntegrationPage'))
const StockTransfersPage = lazy(() => import('@/pages/estoque/StockTransfersPage'))
const UsedStockItemsPage = lazy(() => import('@/pages/estoque/UsedStockItemsPage'))
const SerialNumbersPage = lazy(() => import('@/pages/estoque/SerialNumbersPage'))
const CentralPage = lazy(() => import('@/pages/central/CentralPage').then(m => ({ default: m.CentralPage })))
const CentralDashboardPage = lazy(() => import('@/pages/central/CentralDashboardPage').then(m => ({ default: m.CentralDashboardPage })))
const CentralRulesPage = lazy(() => import('@/pages/central/CentralRulesPage').then(m => ({ default: m.CentralRulesPage })))
const InmetroDashboardPage = lazy(() => import('@/pages/inmetro/InmetroDashboardPage').then(m => ({ default: m.InmetroDashboardPage })))
const InmetroLeadsPage = lazy(() => import('@/pages/inmetro/InmetroLeadsPage').then(m => ({ default: m.InmetroLeadsPage })))
const InmetroImportPage = lazy(() => import('@/pages/inmetro/InmetroImportPage').then(m => ({ default: m.InmetroImportPage })))

const InmetroOwnerDetailPage = lazy(() => import('@/pages/inmetro/InmetroOwnerDetailPage').then(m => ({ default: m.InmetroOwnerDetailPage })))
const InmetroInstrumentsPage = lazy(() => import('@/pages/inmetro/InmetroInstrumentsPage').then(m => ({ default: m.InmetroInstrumentsPage })))
const InmetroMapPage = lazy(() => import('@/pages/inmetro/InmetroMapPage').then(m => ({ default: m.InmetroMapPage })))
const InmetroMarketPage = lazy(() => import('@/pages/inmetro/InmetroMarketPage').then(m => ({ default: m.InmetroMarketPage })))
const InmetroProspectionPage = lazy(() => import('@/pages/inmetro/InmetroProspectionPage'))
const InmetroExecutivePage = lazy(() => import('@/pages/inmetro/InmetroExecutivePage'))
const InmetroCompliancePage = lazy(() => import('@/pages/inmetro/InmetroCompliancePage'))
const InmetroWebhooksPage = lazy(() => import('@/pages/inmetro/InmetroWebhooksPage'))
const InmetroCompetitorPage = lazy(() => import('@/pages/inmetro/InmetroCompetitorPage'))
const InmetroSealManagement = lazy(() => import('@/pages/inmetro/InmetroSealManagement'))
const InmetroSealReportPage = lazy(() => import('@/pages/inmetro/InmetroSealReportPage'))

// 200 Features — Novos Módulos
const FleetPage = lazy(() => import('@/pages/fleet/FleetPage'))
const HRPage = lazy(() => import('@/pages/rh/HRPage'))
const ClockInPage = lazy(() => import('@/pages/rh/ClockInPage'))
const GeofenceLocationsPage = lazy(() => import('@/pages/rh/GeofenceLocationsPage'))
const ClockAdjustmentsPage = lazy(() => import('@/pages/rh/ClockAdjustmentsPage'))
const JourneyPage = lazy(() => import('@/pages/rh/JourneyPage'))
const JourneyRulesPage = lazy(() => import('@/pages/rh/JourneyRulesPage'))
const HolidaysPage = lazy(() => import('@/pages/rh/HolidaysPage'))
const LeavesPage = lazy(() => import('@/pages/rh/LeavesPage'))
const VacationBalancePage = lazy(() => import('@/pages/rh/VacationBalancePage'))
const EmployeeDocumentsPage = lazy(() => import('@/pages/rh/EmployeeDocumentsPage'))
const OnboardingPage = lazy(() => import('@/pages/rh/OnboardingPage'))
const QualityPage = lazy(() => import('@/pages/qualidade/QualityPage'))
const QualityAuditsPage = lazy(() => import('@/pages/qualidade/QualityAuditsPage'))
const IsoDocumentsPage = lazy(() => import('@/pages/qualidade/IsoDocumentsPage'))
const ManagementReviewPage = lazy(() => import('@/pages/qualidade/ManagementReviewPage'))
const AutomationPage = lazy(() => import('@/pages/automacao/AutomationPage'))
const AdvancedFeaturesPage = lazy(() => import('@/pages/avancado/AdvancedFeaturesPage'))
const AlertsPage = lazy(() => import('@/pages/alertas/AlertsPage'))
const CalibrationReadingsPage = lazy(() => import('@/pages/calibracao/CalibrationReadingsPage'))
const WhatsAppConfigPage = lazy(() => import('@/pages/configuracoes/WhatsAppConfigPage'))
const AgingReceivablesPage = lazy(() => import('@/pages/financeiro/AgingReceivablesPage').then(m => ({ default: m.AgingReceivablesPage })))
const DebtRenegotiationPage = lazy(() => import('@/pages/financeiro/DebtRenegotiationPage'))
const WeightAssignmentsPage = lazy(() => import('@/pages/equipamentos/WeightAssignmentsPage'))
const ToolCalibrationsPage = lazy(() => import('@/pages/estoque/ToolCalibrationsPage'))
const EquipmentQrPublicPage = lazy(() => import('@/pages/equipamentos/EquipmentQrPublicPage'))
const CertificateTemplatesPage = lazy(() => import('@/pages/calibracao/CertificateTemplatesPage'))
const WhatsAppLogPage = lazy(() => import('@/pages/configuracoes/WhatsAppLogPage'))
const CollectionAutomationPage = lazy(() => import('@/pages/financeiro/CollectionAutomationPage'))
const ExpenseReimbursementsPage = lazy(() => import('@/pages/financeiro/ExpenseReimbursementsPage').then(m => ({ default: m.ExpenseReimbursementsPage })))
const FinancialChecksPage = lazy(() => import('@/pages/financeiro/FinancialChecksPage').then(m => ({ default: m.FinancialChecksPage })))
const SupplierContractsPage = lazy(() => import('@/pages/financeiro/SupplierContractsPage').then(m => ({ default: m.SupplierContractsPage })))
const SupplierAdvancesPage = lazy(() => import('@/pages/financeiro/SupplierAdvancesPage').then(m => ({ default: m.SupplierAdvancesPage })))
const ReceivablesSimulatorPage = lazy(() => import('@/pages/financeiro/ReceivablesSimulatorPage').then(m => ({ default: m.ReceivablesSimulatorPage })))
const BatchPaymentApprovalPage = lazy(() => import('@/pages/financeiro/BatchPaymentApprovalPage').then(m => ({ default: m.BatchPaymentApprovalPage })))
const ExpenseAllocationPage = lazy(() => import('@/pages/financeiro/ExpenseAllocationPage').then(m => ({ default: m.ExpenseAllocationPage })))
const TaxCalculatorPage = lazy(() => import('@/pages/financeiro/TaxCalculatorPage').then(m => ({ default: m.TaxCalculatorPage })))
const DrePage = lazy(() => import('@/pages/financeiro/DrePage').then(m => ({ default: m.DrePage })))
const OrgChartPage = lazy(() => import('@/pages/rh/OrgChartPage'))
const SkillsMatrixPage = lazy(() => import('@/pages/rh/SkillsMatrixPage'))
const PerformancePage = lazy(() => import('@/pages/rh/PerformancePage'))
const BenefitsPage = lazy(() => import('@/pages/rh/BenefitsPage'))
const RecruitmentPage = lazy(() => import('@/pages/rh/RecruitmentPage'))
const RecruitmentKanbanPage = lazy(() => import('@/pages/rh/RecruitmentKanbanPage'))
const PerformanceReviewDetailPage = lazy(() => import('@/pages/rh/PerformanceReviewDetailPage'))
const TvDashboard = lazy(() => import('@/pages/tv/TvDashboard'))
const TvCamerasPage = lazy(() => import('@/pages/tv/TvCamerasPage'))
const AIAnalyticsPage = lazy(() => import('@/pages/ia/AIAnalyticsPage'))
const PeopleAnalyticsPage = lazy(() => import('@/pages/rh/PeopleAnalyticsPage'))
const AccountingReportsPage = lazy(() => import('@/pages/rh/AccountingReportsPage'))

// Tech (PWA Mobile)
const TechWorkOrdersPage = lazy(() => import('@/pages/tech/TechWorkOrdersPage'))
const TechWorkOrderDetailPage = lazy(() => import('@/pages/tech/TechWorkOrderDetailPage'))
const TechChecklistPage = lazy(() => import('@/pages/tech/TechChecklistPage'))
const TechExpensePage = lazy(() => import('@/pages/tech/TechExpensePage'))
const TechPhotosPage = lazy(() => import('@/pages/tech/TechPhotosPage'))
const TechSignaturePage = lazy(() => import('@/pages/tech/TechSignaturePage'))
const TechProfilePage = lazy(() => import('@/pages/tech/TechProfilePage'))
const TechSealsPage = lazy(() => import('@/pages/tech/TechSealsPage'))
const TechSettingsPage = lazy(() => import('@/pages/tech/TechSettingsPage'))
const TechBarcodePage = lazy(() => import('@/pages/tech/TechBarcodePage'))
const TechChatPage = lazy(() => import('@/pages/tech/TechChatPage'))
const TechPhotoAnnotationPage = lazy(() => import('@/pages/tech/TechPhotoAnnotationPage'))
const TechVoiceReportPage = lazy(() => import('@/pages/tech/TechVoiceReportPage'))
const TechBluetoothPrintPage = lazy(() => import('@/pages/tech/TechBluetoothPrintPage'))
const TechThermalCameraPage = lazy(() => import('@/pages/tech/TechThermalCameraPage'))
const TechWidgetPage = lazy(() => import('@/pages/tech/TechWidgetPage'))
const TechExpensesOverviewPage = lazy(() => import('@/pages/tech/TechExpensesOverviewPage'))
const TechCashManagementPage = lazy(() => import('@/pages/tech/TechCashPage'))
const TechCreateWorkOrderPage = lazy(() => import('@/pages/tech/TechCreateWorkOrderPage'))
const TechSchedulePage = lazy(() => import('@/pages/tech/TechSchedulePage'))
const TechTimeEntriesPage = lazy(() => import('@/pages/tech/TechTimeEntriesPage'))
const TechNotificationsPage = lazy(() => import('@/pages/tech/TechNotificationsPage'))
const TechEquipmentSearchPage = lazy(() => import('@/pages/tech/TechEquipmentSearchPage'))
const TechAssetScanPage = lazy(() => import('@/pages/tech/TechAssetScanPage'))
const TechRoutePage = lazy(() => import('@/pages/tech/TechRoutePage'))
const TechNpsPage = lazy(() => import('@/pages/tech/TechNpsPage'))
const TechQuickQuotePage = lazy(() => import('@/pages/tech/TechQuickQuotePage'))
const TechCalibrationReadingsPage = lazy(() => import('@/pages/tech/TechCalibrationReadingsPage'))
const TechCertificatePage = lazy(() => import('@/pages/tech/TechCertificatePage'))
const TechCommissionsPage = lazy(() => import('@/pages/tech/TechCommissionsPage'))
const TechDaySummaryPage = lazy(() => import('@/pages/tech/TechDaySummaryPage'))
const TechFeedbackPage = lazy(() => import('@/pages/tech/TechFeedbackPage'))
const TechPriceTablePage = lazy(() => import('@/pages/tech/TechPriceTablePage'))
const TechEquipmentHistoryPage = lazy(() => import('@/pages/tech/TechEquipmentHistoryPage'))
const TechVehicleCheckinPage = lazy(() => import('@/pages/tech/TechVehicleCheckinPage'))
const TechComplaintPage = lazy(() => import('@/pages/tech/TechComplaintPage').then(m => ({ default: m.default })))
const TechContractInfoPage = lazy(() => import('@/pages/tech/TechContractInfoPage').then(m => ({ default: m.default })))
const TechToolInventoryPage = lazy(() => import('@/pages/tech/TechToolInventoryPage'))
const TechTimeClockPage = lazy(() => import('@/pages/tech/TechTimeClockPage'))
const TechDashboardPage = lazy(() => import('@/pages/tech/TechDashboardPage'))
const TechGoalsPage = lazy(() => import('@/pages/tech/TechGoalsPage'))
const TechServiceCallsPage = lazy(() => import('@/pages/tech/TechServiceCallsPage'))
const TechMaterialRequestPage = lazy(() => import('@/pages/tech/TechMaterialRequestPage'))
const TechMapViewPage = lazy(() => import('@/pages/tech/TechMapViewPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const routePermissionRules: Array<{ match: string; permission: string | null }> = [
  { match: '/central/regras', permission: 'central.manage.rules' },
  { match: '/central/dashboard', permission: 'central.manage.kpis' },
  { match: '/central', permission: 'central.item.view' },
  { match: '/iam/usuarios', permission: 'iam.user.view' },
  { match: '/iam/roles', permission: 'iam.role.view' },
  { match: '/iam/permissoes', permission: 'iam.role.view' },
  { match: '/admin/audit-log', permission: 'iam.audit_log.view' },
  { match: '/cadastros/clientes/fusao', permission: 'cadastros.customer.update' },
  { match: '/cadastros/clientes', permission: 'cadastros.customer.view' },
  { match: '/cadastros/produtos', permission: 'cadastros.product.view' },
  { match: '/cadastros/servicos', permission: 'cadastros.service.view' },
  { match: '/catalogo', permission: 'catalog.view' },
  { match: '/cadastros/historico-precos', permission: 'cadastros.product.view' },
  { match: '/cadastros/exportacao-lote', permission: 'cadastros.customer.view' },
  { match: '/cadastros/fornecedores', permission: 'cadastros.supplier.view' },
  { match: '/orcamentos/novo', permission: 'quotes.quote.create' },
  { match: '/chamados/novo', permission: 'service_calls.service_call.create' },
  { match: '/equipamentos/novo', permission: 'equipments.equipment.create' },
  { match: '/inmetro/instrumentos', permission: 'inmetro.intelligence.view' },
  { match: '/inmetro/mapa', permission: 'inmetro.intelligence.view' },
  { match: '/inmetro/importacao', permission: 'inmetro.intelligence.import' },
  { match: '/inmetro/prospeccao', permission: 'inmetro.intelligence.view' },
  { match: '/inmetro/executivo', permission: 'inmetro.intelligence.view' },
  { match: '/inmetro/compliance', permission: 'inmetro.intelligence.view' },
  { match: '/inmetro/webhooks', permission: 'inmetro.intelligence.view' },
  { match: '/orcamentos/', permission: 'quotes.quote.view' },
  { match: '/orcamentos', permission: 'quotes.quote.view' },
  { match: '/chamados', permission: 'service_calls.service_call.view' },
  { match: '/os/nova', permission: 'os.work_order.create' },
  { match: '/os', permission: 'os.work_order.view' },
  { match: '/tecnicos/agenda', permission: 'technicians.schedule.view' },
  { match: '/tecnicos/apontamentos', permission: 'technicians.time_entry.view' },
  { match: '/tecnicos/caixa', permission: 'technicians.cashbox.view' },
  { match: '/financeiro', permission: 'financeiro.view' },
  { match: '/financeiro/receber', permission: 'finance.receivable.view' },
  { match: '/financeiro/pagar', permission: 'finance.payable.view' },
  { match: '/financeiro/comissoes/dashboard', permission: 'commissions.rule.view' },
  { match: '/financeiro/comissoes', permission: 'commissions.rule.view' },
  { match: '/financeiro/despesas', permission: 'expenses.expense.view' },
  { match: '/financeiro/pagamentos', permission: 'finance.receivable.view|finance.payable.view' },
  { match: '/financeiro/formas-pagamento', permission: 'finance.payable.view' },
  { match: '/financeiro/fluxo-caixa', permission: 'finance.cashflow.view' },
  { match: '/financeiro/fluxo-caixa-semanal', permission: 'finance.cashflow.view' },
  { match: '/financeiro/faturamento', permission: 'finance.receivable.view' },
  { match: '/financeiro/conciliacao-bancaria', permission: 'finance.receivable.view' },
  { match: '/financeiro/regras-conciliacao', permission: 'finance.receivable.view' },
  { match: '/financeiro/dashboard-conciliacao', permission: 'finance.receivable.view' },
  { match: '/financeiro/consolidado', permission: 'financeiro.view' },
  { match: '/financeiro/plano-contas', permission: 'finance.chart.view' },
  { match: '/financeiro/categorias-pagar', permission: 'finance.payable.view' },
  { match: '/financeiro/contas-bancarias', permission: 'financial.bank_account.view' },
  { match: '/financeiro/transferencias-tecnicos', permission: 'financial.fund_transfer.view' },
  { match: '/fiscal/notas', permission: 'fiscal.note.view' },
  { match: '/estoque/movimentacoes', permission: 'estoque.movement.view' },
  { match: '/estoque/armazens', permission: 'estoque.warehouse.view' },
  { match: '/estoque/inventario-pwa', permission: 'estoque.view' },
  { match: '/estoque/etiquetas', permission: 'estoque.label.print' },
  { match: '/estoque/transferencias', permission: 'estoque.movement.view' },
  { match: '/estoque', permission: 'estoque.movement.view' },
  { match: '/relatorios', permission: 'reports.os_report.view' },
  { match: '/notificacoes', permission: 'notifications.notification.view' },
  { match: '/importacao', permission: 'import.data.view' },
  { match: '/integracao/auvo', permission: 'auvo.import.view' },
  { match: '/emails/configuracoes', permission: 'email.account.view' },
  { match: '/emails/compose', permission: 'email.inbox.send' },
  { match: '/emails', permission: 'email.inbox.view' },
  { match: '/inmetro/selos', permission: 'inmetro.intelligence.view' },
  { match: '/inmetro', permission: 'inmetro.intelligence.view' },
  { match: '/equipamentos/modelos', permission: 'equipments.equipment_model.view' },
  { match: '/equipamentos/pesos-padrao', permission: 'equipments.standard_weight.view' },
  { match: '/equipamentos/atribuicao-pesos', permission: 'calibration.weight_assignment.view' },
  { match: '/equipamentos', permission: 'equipments.equipment.view' },
  { match: '/agenda-calibracoes', permission: 'equipments.equipment.view' },
  { match: '/calibracao/leituras', permission: 'calibration.reading.view' },
  { match: '/estoque/calibracoes-ferramentas', permission: 'calibration.tool.view' },
  { match: '/configuracoes/filiais', permission: 'platform.branch.view' },
  { match: '/configuracoes/empresas', permission: 'platform.tenant.view' },
  { match: '/configuracoes/whatsapp', permission: 'whatsapp.config.view' },
  { match: '/configuracoes/auditoria', permission: 'iam.audit_log.view' },
  { match: '/configuracoes', permission: 'platform.settings.view' },
  { match: '/financeiro/regua-cobranca', permission: 'finance.receivable.view' },
  { match: '/financeiro/renegociacao', permission: 'finance.renegotiation.view' },
  { match: '/financeiro/reembolsos', permission: 'expenses.expense.view' },
  { match: '/financeiro/cheques', permission: 'finance.payable.view' },
  { match: '/financeiro/contratos-fornecedores', permission: 'finance.payable.view' },
  { match: '/financeiro/adiantamentos-fornecedores', permission: 'finance.payable.view' },
  { match: '/financeiro/simulador-recebiveis', permission: 'finance.receivable.view' },
  { match: '/financeiro/aprovacao-lote', permission: 'finance.payable.view' },
  { match: '/financeiro/alocacao-despesas', permission: 'expenses.expense.view' },
  { match: '/financeiro/calculadora-tributos', permission: 'financeiro.view' },
  { match: '/financeiro/dre', permission: 'financeiro.view' },
  { match: '/alertas', permission: 'alerts.alert.view' },
  { match: '/qualidade/auditorias', permission: 'quality.audit.view' },
  { match: '/qualidade/documentos', permission: 'quality.document.view' },
  { match: '/qualidade/revisao-direcao', permission: 'quality.management_review.view' },
  { match: '/crm/pipeline', permission: 'crm.pipeline.view' },
  { match: '/crm/clientes', permission: 'crm.deal.view' },
  { match: '/crm/templates', permission: 'crm.message.view' },
  { match: '/crm/forecast', permission: 'crm.forecast.view' },
  { match: '/crm/goals', permission: 'crm.goal.view' },
  { match: '/crm/alerts', permission: 'crm.deal.view' },
  { match: '/crm/calendar', permission: 'crm.deal.view' },
  { match: '/crm/scoring', permission: 'crm.scoring.view' },
  { match: '/crm/sequences', permission: 'crm.sequence.view' },
  { match: '/crm/loss-analytics', permission: 'crm.deal.view' },
  { match: '/crm/territories', permission: 'crm.territory.view' },
  { match: '/crm/renewals', permission: 'crm.renewal.view' },
  { match: '/crm/referrals', permission: 'crm.referral.view' },
  { match: '/crm/web-forms', permission: 'crm.form.view' },
  { match: '/crm/revenue', permission: 'crm.forecast.view' },
  { match: '/crm/competitors', permission: 'crm.deal.view' },
  { match: '/crm/velocity', permission: 'crm.deal.view' },
  { match: '/crm/cohort', permission: 'crm.forecast.view' },
  { match: '/crm/proposals', permission: 'crm.proposal.view' },
  { match: '/crm', permission: 'crm.deal.view' },
  { match: '/perfil', permission: null },
  { match: '/analytics', permission: 'reports.analytics.view' },
  // Novos módulos (200 Features)
  { match: '/frota', permission: 'fleet.vehicle.view' },
  { match: '/rh/ponto', permission: 'hr.clock.view' },
  { match: '/rh/geofences', permission: 'hr.geofence.manage' },
  { match: '/rh/ajustes-ponto', permission: 'hr.adjustment.approve' },
  { match: '/rh/jornada/regras', permission: 'hr.journey.manage' },
  { match: '/rh/jornada', permission: 'hr.journey.view' },
  { match: '/rh/feriados', permission: 'hr.holiday.manage' },
  { match: '/rh/ferias', permission: 'hr.leave.view' },
  { match: '/rh/saldo-ferias', permission: 'hr.leave.view' },
  { match: '/rh/documentos', permission: 'hr.document.view' },
  { match: '/rh/onboarding', permission: 'hr.onboarding.view' },
  { match: '/rh/onboarding', permission: 'hr.onboarding.view' },
  { match: '/rh/organograma', permission: 'hr.organization.view' },
  { match: '/rh/skills', permission: 'hr.skills.view' },
  { match: '/rh/desempenho', permission: 'hr.performance.view' },
  { match: '/rh', permission: 'hr.schedule.view' },
  { match: '/qualidade', permission: 'quality.procedure.view' },
  { match: '/automacao', permission: 'automation.rule.view' },
  { match: '/avancado', permission: 'advanced.follow_up.view' },
  { match: '/ia', permission: 'ai.analytics.view' },
  { match: '/tv/dashboard', permission: 'tv.dashboard.view' },
]

function resolveRequiredPermission(pathname: string): string | null {
  if (/^\/orcamentos\/[^/]+\/editar$/.test(pathname)) {
    return 'quotes.quote.update'
  }
  if (/^\/chamados\/[^/]+\/editar$/.test(pathname)) {
    return 'service_calls.service_call.update'
  }
  if (/^\/equipamentos\/[^/]+\/editar$/.test(pathname)) {
    return 'equipments.equipment.update'
  }

  for (const rule of routePermissionRules) {
    if (rule.match === pathname) {
      return rule.permission
    }
    if (rule.match !== '/' && rule.match.endsWith('/') && pathname.startsWith(rule.match)) {
      return rule.permission
    }
    if (rule.match !== '/' && !rule.match.endsWith('/') && pathname.startsWith(`${rule.match}/`)) {
      return rule.permission
    }
  }
  return null
}

function hasPermissionExpression(
  expression: string,
  hasPermission: (permission: string) => boolean
): boolean {
  return expression
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
    .some(permission => hasPermission(permission))
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  )
}

function AccessDeniedState({ permission }: { permission: string }) {
  return (
    <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-red-800">Acesso negado</h2>
      <p className="mt-2 text-sm text-red-700">
        Você não possui a permissão necessária para acessar esta página.
      </p>
      <p className="mt-2 text-xs font-mono text-red-600">{permission}</p>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { isAuthenticated, fetchMe, logout, user, hasPermission, hasRole } = useAuthStore()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe().catch(() => {
        logout()
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAuthenticated && !user) {
      const timer = setTimeout(() => {
        setTimedOut(true)
        logout()
      }, 10_000)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, user, logout])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (!user) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-sm text-surface-500">
            {timedOut ? 'Sessão expirada. Redirecionando...' : 'Carregando permissões...'}
          </p>
        </div>
      </AppLayout>
    )
  }

  const requiredPermission = resolveRequiredPermission(location.pathname)
  const isSuperAdmin = hasRole('super_admin')

  if (requiredPermission && !isSuperAdmin && !hasPermissionExpression(requiredPermission, hasPermission)) {
    return (
      <AppLayout>
        <AccessDeniedState permission={requiredPermission} />
      </AppLayout>
    )
  }

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
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <Toaster position="top-right" richColors closeButton duration={4000} />
          <CommandPalette />
          <Suspense fallback={<PageLoader />}>
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
              <Route
                path="/esqueci-senha"
                element={
                  <GuestRoute>
                    <ForgotPasswordPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/redefinir-senha"
                element={
                  <GuestRoute>
                    <ResetPasswordPage />
                  </GuestRoute>
                }
              />

              {/* Rotas autenticadas */}
              <Route path="/" element={<ProtectedRoute><TechAutoRedirect><DashboardPage /></TechAutoRedirect></ProtectedRoute>} />

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
              <Route path="/catalogo" element={<ProtectedRoute><CatalogAdminPage /></ProtectedRoute>} />

              {/* Orçamentos */}
              <Route path="/orcamentos" element={<ProtectedRoute><QuotesListPage /></ProtectedRoute>} />
              <Route path="/orcamentos/novo" element={<ProtectedRoute><QuoteCreatePage /></ProtectedRoute>} />
              <Route path="/orcamentos/:id" element={<ProtectedRoute><QuoteDetailPage /></ProtectedRoute>} />
              <Route path="/orcamentos/:id/editar" element={<ProtectedRoute><QuoteEditPage /></ProtectedRoute>} />

              {/* Chamados Técnicos */}
              <Route path="/chamados" element={<ProtectedRoute><ServiceCallsPage /></ProtectedRoute>} />
              <Route path="/chamados/novo" element={<ProtectedRoute><ServiceCallCreatePage /></ProtectedRoute>} />
              <Route path="/chamados/mapa" element={<ProtectedRoute><ServiceCallMapPage /></ProtectedRoute>} />
              <Route path="/chamados/agenda" element={<ProtectedRoute><TechnicianAgendaPage /></ProtectedRoute>} />
              <Route path="/chamados/:id" element={<ProtectedRoute><ServiceCallDetailPage /></ProtectedRoute>} />
              <Route path="/chamados/:id/editar" element={<ProtectedRoute><ServiceCallEditPage /></ProtectedRoute>} />

              {/* Ordens de Serviço */}
              <Route path="/os" element={<ProtectedRoute><WorkOrdersListPage /></ProtectedRoute>} />
              <Route path="/os/kanban" element={<ProtectedRoute><WorkOrderKanbanPage /></ProtectedRoute>} />
              <Route path="/os/nova" element={<ProtectedRoute><WorkOrderCreatePage /></ProtectedRoute>} />
              <Route path="/os/:id" element={<ProtectedRoute><WorkOrderDetailPage /></ProtectedRoute>} />
              <Route path="/os/contratos-recorrentes" element={<ProtectedRoute><RecurringContractsPage /></ProtectedRoute>} />
              <Route path="/os/sla" element={<ProtectedRoute><SlaPoliciesPage /></ProtectedRoute>} />
              <Route path="/os/sla-dashboard" element={<ProtectedRoute><SlaDashboardPage /></ProtectedRoute>} />
              <Route path="/os/checklists" element={<ProtectedRoute><ChecklistPage /></ProtectedRoute>} />

              {/* Técnicos */}
              <Route path="/tecnicos/agenda" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
              <Route path="/tecnicos/apontamentos" element={<ProtectedRoute><TimeEntriesPage /></ProtectedRoute>} />
              <Route path="/tecnicos/caixa" element={<ProtectedRoute><TechnicianCashPage /></ProtectedRoute>} />

              {/* Financeiro */}
              <Route path="/financeiro" element={<ProtectedRoute><FinanceiroDashboardPage /></ProtectedRoute>} />
              <Route path="/financeiro/receber" element={<ProtectedRoute><AccountsReceivablePage /></ProtectedRoute>} />
              <Route path="/financeiro/pagar" element={<ProtectedRoute><AccountsPayablePage /></ProtectedRoute>} />
              <Route path="/financeiro/comissoes" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
              <Route path="/financeiro/comissoes/dashboard" element={<ProtectedRoute><CommissionDashboardPage /></ProtectedRoute>} />
              <Route path="/financeiro/despesas" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
              <Route path="/financeiro/abastecimento" element={<ProtectedRoute><FuelingLogsPage /></ProtectedRoute>} />
              <Route path="/financeiro/pagamentos" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
              <Route path="/financeiro/formas-pagamento" element={<ProtectedRoute><PaymentMethodsPage /></ProtectedRoute>} />
              <Route path="/financeiro/fluxo-caixa" element={<ProtectedRoute><CashFlowPage /></ProtectedRoute>} />
              <Route path="/financeiro/fluxo-caixa-semanal" element={<ProtectedRoute><CashFlowWeeklyDashboardPage /></ProtectedRoute>} />
              <Route path="/financeiro/faturamento" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
              <Route path="/financeiro/conciliacao-bancaria" element={<ProtectedRoute><BankReconciliationPage /></ProtectedRoute>} />
              <Route path="/financeiro/regras-conciliacao" element={<ProtectedRoute><ReconciliationRulesPage /></ProtectedRoute>} />
              <Route path="/financeiro/dashboard-conciliacao" element={<ProtectedRoute><ReconciliationDashboardPage /></ProtectedRoute>} />
              <Route path="/financeiro/consolidado" element={<ProtectedRoute><ConsolidatedFinancialPage /></ProtectedRoute>} />
              <Route path="/financeiro/plano-contas" element={<ProtectedRoute><ChartOfAccountsPage /></ProtectedRoute>} />
              <Route path="/financeiro/categorias-pagar" element={<ProtectedRoute><AccountPayableCategoriesPage /></ProtectedRoute>} />
              <Route path="/financeiro/contas-bancarias" element={<ProtectedRoute><BankAccountsPage /></ProtectedRoute>} />
              <Route path="/financeiro/transferencias-tecnicos" element={<ProtectedRoute><FundTransfersPage /></ProtectedRoute>} />

              {/* Fiscal */}
              <Route path="/fiscal/notas" element={<ProtectedRoute><FiscalNotesPage /></ProtectedRoute>} />

              {/* Estoque */}
              <Route path="/estoque" element={<ProtectedRoute><StockDashboardPage /></ProtectedRoute>} />
              <Route path="/estoque/armazens" element={<ProtectedRoute><WarehousesPage /></ProtectedRoute>} />
              <Route path="/estoque/movimentacoes" element={<ProtectedRoute><StockMovementsPage /></ProtectedRoute>} />
              <Route path="/estoque/lotes" element={<ProtectedRoute><BatchManagementPage /></ProtectedRoute>} />
              <Route path="/estoque/inventarios" element={<ProtectedRoute><InventoryListPage /></ProtectedRoute>} />
              <Route path="/estoque/inventarios/novo" element={<ProtectedRoute><InventoryCreatePage /></ProtectedRoute>} />
              <Route path="/estoque/inventarios/:id" element={<ProtectedRoute><InventoryExecutionPage /></ProtectedRoute>} />
              <Route path="/estoque/inventario-pwa" element={<ProtectedRoute><InventoryPwaListPage /></ProtectedRoute>} />
              <Route path="/estoque/inventario-pwa/:warehouseId" element={<ProtectedRoute><InventoryPwaCountPage /></ProtectedRoute>} />
              <Route path="/estoque/kardex" element={<ProtectedRoute><KardexPage /></ProtectedRoute>} />
              <Route path="/estoque/calibracoes-ferramentas" element={<ProtectedRoute><ToolCalibrationsPage /></ProtectedRoute>} />
              <Route path="/estoque/inteligencia" element={<ProtectedRoute><StockIntelligencePage /></ProtectedRoute>} />
              <Route path="/estoque/etiquetas" element={<ProtectedRoute><StockLabelsPage /></ProtectedRoute>} />
              <Route path="/estoque/integracao" element={<ProtectedRoute><StockIntegrationPage /></ProtectedRoute>} />
              <Route path="/estoque/transferencias" element={<ProtectedRoute><StockTransfersPage /></ProtectedRoute>} />
              <Route path="/estoque/pecas-usadas" element={<ProtectedRoute><UsedStockItemsPage /></ProtectedRoute>} />
              <Route path="/estoque/numeros-serie" element={<ProtectedRoute><SerialNumbersPage /></ProtectedRoute>} />

              {/* Relatórios */}
              <Route path="/relatorios" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsHubPage /></ProtectedRoute>} />
              <Route path="/notificacoes" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

              {/* Importação */}
              <Route path="/importacao" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
              <Route path="/integracao/auvo" element={<ProtectedRoute><AuvoImportPage /></ProtectedRoute>} />

              {/* Email Integration */}
              <Route path="/emails" element={<ProtectedRoute><EmailInboxPage /></ProtectedRoute>} />
              <Route path="/emails/compose" element={<ProtectedRoute><EmailComposePage /></ProtectedRoute>} />
              <Route path="/emails/configuracoes" element={<ProtectedRoute><EmailSettingsPage /></ProtectedRoute>} />

              {/* Inteligência INMETRO */}
              <Route path="/inmetro" element={<ProtectedRoute><InmetroDashboardPage /></ProtectedRoute>} />
              <Route path="/inmetro/leads" element={<ProtectedRoute><InmetroLeadsPage /></ProtectedRoute>} />
              <Route path="/inmetro/instrumentos" element={<ProtectedRoute><InmetroInstrumentsPage /></ProtectedRoute>} />
              <Route path="/inmetro/importacao" element={<ProtectedRoute><InmetroImportPage /></ProtectedRoute>} />
              <Route path="/inmetro/concorrentes" element={<ProtectedRoute><InmetroCompetitorPage /></ProtectedRoute>} />
              <Route path="/inmetro/owners/:id" element={<ProtectedRoute><InmetroOwnerDetailPage /></ProtectedRoute>} />
              <Route path="/inmetro/mapa" element={<ProtectedRoute><InmetroMapPage /></ProtectedRoute>} />
              <Route path="/inmetro/mercado" element={<ProtectedRoute><InmetroMarketPage /></ProtectedRoute>} />
              <Route path="/inmetro/prospeccao" element={<ProtectedRoute><InmetroProspectionPage /></ProtectedRoute>} />
              <Route path="/inmetro/executivo" element={<ProtectedRoute><InmetroExecutivePage /></ProtectedRoute>} />
              <Route path="/inmetro/compliance" element={<ProtectedRoute><InmetroCompliancePage /></ProtectedRoute>} />
              <Route path="/inmetro/webhooks" element={<ProtectedRoute><InmetroWebhooksPage /></ProtectedRoute>} />
              <Route path="/inmetro/selos" element={<ProtectedRoute><InmetroSealManagement /></ProtectedRoute>} />
              <Route path="/inmetro/relatorio-selos" element={<ProtectedRoute><InmetroSealReportPage /></ProtectedRoute>} />

              {/* Equipamentos */}
              <Route path="/equipamentos" element={<ProtectedRoute><EquipmentListPage /></ProtectedRoute>} />
              <Route path="/equipamentos/modelos" element={<ProtectedRoute><EquipmentModelsPage /></ProtectedRoute>} />
              <Route path="/equipamentos/novo" element={<ProtectedRoute><EquipmentCreatePage /></ProtectedRoute>} />
              <Route path="/equipamentos/pesos-padrao" element={<ProtectedRoute><StandardWeightsPage /></ProtectedRoute>} />
              <Route path="/equipamentos/atribuicao-pesos" element={<ProtectedRoute><WeightAssignmentsPage /></ProtectedRoute>} />
              <Route path="/equipamentos/:id" element={<ProtectedRoute><EquipmentDetailPage /></ProtectedRoute>} />
              <Route path="/equipamentos/:id/editar" element={<ProtectedRoute><EquipmentEditPage /></ProtectedRoute>} />
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
              <Route path="/cadastros/clientes/:id" element={<ProtectedRoute><Customer360Page /></ProtectedRoute>} />
              <Route path="/crm/clientes/:id" element={<ProtectedRoute><Customer360Page /></ProtectedRoute>} />
              <Route path="/crm/templates" element={<ProtectedRoute><MessageTemplatesPage /></ProtectedRoute>} />
              <Route path="/crm/forecast" element={<ProtectedRoute><CrmForecastPage /></ProtectedRoute>} />
              <Route path="/crm/goals" element={<ProtectedRoute><CrmGoalsPage /></ProtectedRoute>} />
              <Route path="/crm/alerts" element={<ProtectedRoute><CrmAlertsPage /></ProtectedRoute>} />
              <Route path="/crm/calendar" element={<ProtectedRoute><CrmCalendarPage /></ProtectedRoute>} />
              <Route path="/crm/scoring" element={<ProtectedRoute><CrmScoringPage /></ProtectedRoute>} />
              <Route path="/crm/sequences" element={<ProtectedRoute><CrmSequencesPage /></ProtectedRoute>} />
              <Route path="/crm/loss-analytics" element={<ProtectedRoute><CrmLossAnalyticsPage /></ProtectedRoute>} />
              <Route path="/crm/territories" element={<ProtectedRoute><CrmTerritoriesPage /></ProtectedRoute>} />
              <Route path="/crm/renewals" element={<ProtectedRoute><CrmRenewalsPage /></ProtectedRoute>} />
              <Route path="/crm/referrals" element={<ProtectedRoute><CrmReferralsPage /></ProtectedRoute>} />
              <Route path="/crm/web-forms" element={<ProtectedRoute><CrmWebFormsPage /></ProtectedRoute>} />
              <Route path="/crm/revenue" element={<ProtectedRoute><CrmRevenueIntelligencePage /></ProtectedRoute>} />
              <Route path="/crm/competitors" element={<ProtectedRoute><CrmCompetitorsPage /></ProtectedRoute>} />
              <Route path="/crm/velocity" element={<ProtectedRoute><CrmVelocityPage /></ProtectedRoute>} />
              <Route path="/crm/cohort" element={<ProtectedRoute><CrmCohortPage /></ProtectedRoute>} />
              <Route path="/crm/proposals" element={<ProtectedRoute><CrmProposalsPage /></ProtectedRoute>} />

              {/* CRM Field Management (20 novas funcionalidades) */}
              <Route path="/crm/visit-checkins" element={<ProtectedRoute><CrmVisitCheckinsPage /></ProtectedRoute>} />
              <Route path="/crm/visit-routes" element={<ProtectedRoute><CrmVisitRoutesPage /></ProtectedRoute>} />
              <Route path="/crm/visit-reports" element={<ProtectedRoute><CrmVisitReportsPage /></ProtectedRoute>} />
              <Route path="/crm/portfolio-map" element={<ProtectedRoute><CrmPortfolioMapPage /></ProtectedRoute>} />
              <Route path="/crm/forgotten-clients" element={<ProtectedRoute><CrmForgottenClientsPage /></ProtectedRoute>} />
              <Route path="/crm/contact-policies" element={<ProtectedRoute><CrmContactPoliciesPage /></ProtectedRoute>} />
              <Route path="/crm/smart-agenda" element={<ProtectedRoute><CrmSmartAgendaPage /></ProtectedRoute>} />
              <Route path="/crm/post-visit-workflow" element={<ProtectedRoute><CrmPostVisitWorkflowPage /></ProtectedRoute>} />
              <Route path="/crm/quick-notes" element={<ProtectedRoute><CrmQuickNotesPage /></ProtectedRoute>} />
              <Route path="/crm/commitments" element={<ProtectedRoute><CrmCommitmentsPage /></ProtectedRoute>} />
              <Route path="/crm/negotiation-history" element={<ProtectedRoute><CrmNegotiationHistoryPage /></ProtectedRoute>} />
              <Route path="/crm/client-summary" element={<ProtectedRoute><CrmClientSummaryPage /></ProtectedRoute>} />
              <Route path="/crm/rfm" element={<ProtectedRoute><CrmRfmPage /></ProtectedRoute>} />
              <Route path="/crm/coverage" element={<ProtectedRoute><CrmCoveragePage /></ProtectedRoute>} />
              <Route path="/crm/productivity" element={<ProtectedRoute><CrmProductivityPage /></ProtectedRoute>} />
              <Route path="/crm/opportunities" element={<ProtectedRoute><CrmOpportunitiesPage /></ProtectedRoute>} />
              <Route path="/crm/important-dates" element={<ProtectedRoute><CrmImportantDatesPage /></ProtectedRoute>} />
              <Route path="/crm/visit-surveys" element={<ProtectedRoute><CrmVisitSurveysPage /></ProtectedRoute>} />
              <Route path="/crm/account-plans" element={<ProtectedRoute><CrmAccountPlansPage /></ProtectedRoute>} />
              <Route path="/crm/gamification" element={<ProtectedRoute><CrmGamificationPage /></ProtectedRoute>} />

              {/* Frota */}
              <Route path="/frota" element={<ProtectedRoute><FleetPage /></ProtectedRoute>} />

              {/* RH */}
              <Route path="/rh" element={<ProtectedRoute><HRPage /></ProtectedRoute>} />
              <Route path="/rh/ponto" element={<ProtectedRoute><ClockInPage /></ProtectedRoute>} />
              <Route path="/rh/geofences" element={<ProtectedRoute><GeofenceLocationsPage /></ProtectedRoute>} />
              <Route path="/rh/ajustes-ponto" element={<ProtectedRoute><ClockAdjustmentsPage /></ProtectedRoute>} />
              <Route path="/rh/jornada" element={<ProtectedRoute><JourneyPage /></ProtectedRoute>} />
              <Route path="/rh/jornada/regras" element={<ProtectedRoute><JourneyRulesPage /></ProtectedRoute>} />
              <Route path="/rh/feriados" element={<ProtectedRoute><HolidaysPage /></ProtectedRoute>} />
              <Route path="/rh/ferias" element={<ProtectedRoute><LeavesPage /></ProtectedRoute>} />
              <Route path="/rh/saldo-ferias" element={<ProtectedRoute><VacationBalancePage /></ProtectedRoute>} />
              <Route path="/rh/documentos" element={<ProtectedRoute><EmployeeDocumentsPage /></ProtectedRoute>} />
              <Route path="/rh/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/rh/organograma" element={<ProtectedRoute><OrgChartPage /></ProtectedRoute>} />
              <Route path="/rh/skills" element={<ProtectedRoute><SkillsMatrixPage /></ProtectedRoute>} />
              <Route path="/rh/desempenho" element={<ProtectedRoute><PerformancePage /></ProtectedRoute>} />
              <Route path="/rh/desempenho/:id" element={<ProtectedRoute><PerformanceReviewDetailPage /></ProtectedRoute>} />
              <Route path="/rh/beneficios" element={<ProtectedRoute><BenefitsPage /></ProtectedRoute>} />
              <Route path="/rh/recrutamento" element={<ProtectedRoute><RecruitmentPage /></ProtectedRoute>} />
              <Route path="/rh/recrutamento/:id" element={<ProtectedRoute><RecruitmentKanbanPage /></ProtectedRoute>} />
              <Route path="/rh/analytics" element={<ProtectedRoute><PeopleAnalyticsPage /></ProtectedRoute>} />
              <Route path="/rh/relatorios" element={<ProtectedRoute><AccountingReportsPage /></ProtectedRoute>} />

              {/* Qualidade */}
              <Route path="/qualidade" element={<ProtectedRoute><QualityPage /></ProtectedRoute>} />
              <Route path="/qualidade/auditorias" element={<ProtectedRoute><QualityAuditsPage /></ProtectedRoute>} />
              <Route path="/qualidade/documentos" element={<ProtectedRoute><IsoDocumentsPage /></ProtectedRoute>} />
              <Route path="/qualidade/revisao-direcao" element={<ProtectedRoute><ManagementReviewPage /></ProtectedRoute>} />

              {/* Alertas */}
              <Route path="/alertas" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />

              {/* Calibração — Leituras para certificado */}
              <Route path="/calibracao/leituras" element={<ProtectedRoute><CalibrationReadingsPage /></ProtectedRoute>} />
              <Route path="/calibracao/:calibrationId/leituras" element={<ProtectedRoute><CalibrationReadingsPage /></ProtectedRoute>} />
              <Route path="/calibracao/templates" element={<ProtectedRoute><CertificateTemplatesPage /></ProtectedRoute>} />

              {/* Configurações — WhatsApp */}
              <Route path="/configuracoes/whatsapp" element={<ProtectedRoute><WhatsAppConfigPage /></ProtectedRoute>} />
              <Route path="/configuracoes/whatsapp/logs" element={<ProtectedRoute><WhatsAppLogPage /></ProtectedRoute>} />

              {/* Financeiro — Cobrança Automática */}
              <Route path="/financeiro/regua-cobranca" element={<ProtectedRoute><AgingReceivablesPage /></ProtectedRoute>} />
              <Route path="/financeiro/cobranca-automatica" element={<ProtectedRoute><CollectionAutomationPage /></ProtectedRoute>} />

              {/* Financeiro — Renegociação */}
              <Route path="/financeiro/renegociacao" element={<ProtectedRoute><DebtRenegotiationPage /></ProtectedRoute>} />
              <Route path="/financeiro/reembolsos" element={<ProtectedRoute><ExpenseReimbursementsPage /></ProtectedRoute>} />
              <Route path="/financeiro/cheques" element={<ProtectedRoute><FinancialChecksPage /></ProtectedRoute>} />
              <Route path="/financeiro/contratos-fornecedores" element={<ProtectedRoute><SupplierContractsPage /></ProtectedRoute>} />
              <Route path="/financeiro/adiantamentos-fornecedores" element={<ProtectedRoute><SupplierAdvancesPage /></ProtectedRoute>} />
              <Route path="/financeiro/simulador-recebiveis" element={<ProtectedRoute><ReceivablesSimulatorPage /></ProtectedRoute>} />
              <Route path="/financeiro/aprovacao-lote" element={<ProtectedRoute><BatchPaymentApprovalPage /></ProtectedRoute>} />
              <Route path="/financeiro/alocacao-despesas" element={<ProtectedRoute><ExpenseAllocationPage /></ProtectedRoute>} />
              <Route path="/financeiro/calculadora-tributos" element={<ProtectedRoute><TaxCalculatorPage /></ProtectedRoute>} />
              <Route path="/financeiro/dre" element={<ProtectedRoute><DrePage /></ProtectedRoute>} />

              {/* Automação */}
              <Route path="/automacao" element={<ProtectedRoute><AutomationPage /></ProtectedRoute>} />

              {/* Avançado */}
              <Route path="/avancado" element={<ProtectedRoute><AdvancedFeaturesPage /></ProtectedRoute>} />

              {/* IA & Análise */}
              <Route path="/ia" element={<ProtectedRoute><AIAnalyticsPage /></ProtectedRoute>} />

              {/* TV Dashboard (Wallboard) */}
              <Route path="/tv/dashboard" element={<ProtectedRoute><TvDashboard /></ProtectedRoute>} />
              <Route path="/tv/cameras" element={<ProtectedRoute><TvCamerasPage /></ProtectedRoute>} />

              {/* Tech PWA (Mobile Offline) */}
              <Route path="/tech" element={<TechShell />}>
                <Route index element={<TechWorkOrdersPage />} />
                <Route path="os/:id" element={<TechWorkOrderDetailPage />} />
                <Route path="os/:id/checklist" element={<TechChecklistPage />} />
                <Route path="os/:id/expenses" element={<TechExpensePage />} />
                <Route path="os/:id/photos" element={<TechPhotosPage />} />
                <Route path="os/:id/seals" element={<TechSealsPage />} />
                <Route path="os/:id/calibration" element={<TechCalibrationReadingsPage />} />
                <Route path="os/:id/certificado" element={<TechCertificatePage />} />
                <Route path="os/:id/signature" element={<TechSignaturePage />} />
                <Route path="os/:id/nps" element={<TechNpsPage />} />
                <Route path="os/:id/ocorrencia" element={<TechComplaintPage />} />
                <Route path="os/:id/contrato" element={<TechContractInfoPage />} />
                <Route path="perfil" element={<TechProfilePage />} />
                <Route path="configuracoes" element={<TechSettingsPage />} />
                <Route path="barcode" element={<TechBarcodePage />} />
                <Route path="os/:id/chat" element={<TechChatPage />} />
                <Route path="os/:id/annotate" element={<TechPhotoAnnotationPage />} />
                <Route path="os/:id/voice-report" element={<TechVoiceReportPage />} />
                <Route path="os/:id/print" element={<TechBluetoothPrintPage />} />
                <Route path="thermal-camera" element={<TechThermalCameraPage />} />
                <Route path="thermal-camera/:id" element={<TechThermalCameraPage />} />
                <Route path="widget" element={<TechWidgetPage />} />
                <Route path="despesas" element={<TechExpensesOverviewPage />} />
                <Route path="caixa" element={<TechCashManagementPage />} />
                <Route path="nova-os" element={<TechCreateWorkOrderPage />} />
                <Route path="agenda" element={<TechSchedulePage />} />
                <Route path="rota" element={<TechRoutePage />} />
                <Route path="mapa" element={<TechMapViewPage />} />
                <Route path="comissoes" element={<TechCommissionsPage />} />
                <Route path="resumo-diario" element={<TechDaySummaryPage />} />
                <Route path="apontamentos" element={<TechTimeEntriesPage />} />
                <Route path="notificacoes" element={<TechNotificationsPage />} />
                <Route path="equipamentos" element={<TechEquipmentSearchPage />} />
                <Route path="equipamento/:id" element={<TechEquipmentHistoryPage />} />
                <Route path="feedback" element={<TechFeedbackPage />} />
                <Route path="precos" element={<TechPriceTablePage />} />
                <Route path="orcamento-rapido" element={<TechQuickQuotePage />} />
                <Route path="scan-ativos" element={<TechAssetScanPage />} />
                <Route path="veiculo" element={<TechVehicleCheckinPage />} />
                <Route path="ferramentas" element={<TechToolInventoryPage />} />
                <Route path="ponto" element={<TechTimeClockPage />} />
                <Route path="dashboard" element={<TechDashboardPage />} />
                <Route path="metas" element={<TechGoalsPage />} />
                <Route path="chamados" element={<TechServiceCallsPage />} />
                <Route path="solicitar-material" element={<TechMaterialRequestPage />} />
              </Route>

              {/* Rotas do Portal do Cliente */}
              <Route path="/portal/login" element={<PortalLoginPage />} />
              <Route path="/portal" element={<ProtectedPortalRoute><PortalDashboardPage /></ProtectedPortalRoute>} />
              <Route path="/portal/os" element={<ProtectedPortalRoute><PortalWorkOrdersPage /></ProtectedPortalRoute>} />
              <Route path="/portal/orcamentos" element={<ProtectedPortalRoute><PortalQuotesPage /></ProtectedPortalRoute>} />
              <Route path="/portal/financeiro" element={<ProtectedPortalRoute><PortalFinancialsPage /></ProtectedPortalRoute>} />
              <Route path="/portal/chamados/novo" element={<ProtectedPortalRoute><PortalServiceCallPage /></ProtectedPortalRoute>} />

              {/* Página pública QR Code Equipamento */}
              <Route path="/equipamento-qr/:token" element={<EquipmentQrPublicPage />} />

              {/* Catálogo público — link compartilhável com clientes */}
              <Route path="/catalogo/:slug" element={<CatalogPublicPage />} />

              {/* Fallback para URLs não encontradas */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
