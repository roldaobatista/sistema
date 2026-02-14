# Planilha Detalhada de Modulos (Por Pagina)

| Modulo | Pagina | Frontend | Rota Backend | CRUD Controller | API Correta | Toast | Loading | Estado Vazio | Permissao | APIs Ausentes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| account-payable-categories | frontend/src/pages/financeiro/AccountPayableCategoriesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| accounts-payable | frontend/src/pages/financeiro/AccountsPayablePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| accounts-receivable | frontend/src/pages/financeiro/AccountsReceivablePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| advanced | frontend/src/pages/avancado/AdvancedFeaturesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | GET /advanced/cost-centers; GET /advanced/route-plans; GET /advanced/customer-documents; GET /advanced/price-tables; GET /advanced/follow-ups; GET /advanced/ratings |
| audit-logs | frontend/src/pages/admin/AuditLogPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| audit-logs | frontend/src/pages/configuracoes/AuditLogsPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| automation | frontend/src/pages/automacao/AutomationPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | GET /automation/rules; GET /automation/reports; GET /automation/webhooks; PATCH /automation/rules/:id/toggle |
| bank-accounts | frontend/src/pages/financeiro/BankAccountsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | PUT /bank-accounts/:id; GET /bank-accounts; DELETE /bank-accounts/:id; POST /bank-accounts |
| bank-reconciliation | frontend/src/pages/financeiro/BankReconciliationPage.tsx | âœ… | âœ… | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /bank-reconciliation/search-financials; GET /bank-reconciliation/entries/:id/suggestions; GET /bank-accounts; POST /bank-reconciliation/entries/:id/suggest-rule; GET /bank-reconciliation/statements/:id/export-pdf; GET /bank-reconciliation/summary; GET /bank-reconciliation/statements/:id/export; POST /bank-reconciliation/entries/:id/unmatch; POST /bank-reconciliation/bulk-action; DELETE /bank-reconciliation/statements/:id |
| bank-reconciliation | frontend/src/pages/financeiro/ReconciliationDashboardPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /bank-reconciliation/dashboard |
| batch-export | frontend/src/pages/cadastros/BatchExportPage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âŒ | âœ… |  |
| branches | frontend/src/pages/configuracoes/BranchesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| cash-flow | frontend/src/pages/financeiro/CashFlowPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| central | frontend/src/pages/central/CentralDashboardPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| central | frontend/src/pages/central/CentralPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| central | frontend/src/pages/central/CentralRulesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| chart-of-accounts | frontend/src/pages/financeiro/ChartOfAccountsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| checklists | frontend/src/pages/operational/checklists/ChecklistPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /checklists |
| commission-dashboard | frontend/src/pages/financeiro/CommissionDashboardPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âŒ | âœ… | âœ… |  |
| commission-events | frontend/src/pages/financeiro/CommissionsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| customers | frontend/src/pages/cadastros/CustomerMergePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| customers | frontend/src/pages/cadastros/CustomersPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| customers | frontend/src/pages/orcamentos/QuoteCreatePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| dashboard-stats | frontend/src/pages/DashboardPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| equipments | frontend/src/pages/chamados/ServiceCallCreatePage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /service-calls-assignees |
| equipments | frontend/src/pages/equipamentos/EquipmentDetailPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /standard-weights |
| equipments-alerts | frontend/src/pages/equipamentos/EquipmentCalendarPage.tsx | âœ… | âœ… | âœ… | âœ… | âŒ | âŒ | âœ… | âœ… |  |
| equipments-constants | frontend/src/pages/equipamentos/EquipmentCreatePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ | âŒ | âœ… |  |
| equipments-constants | frontend/src/pages/equipamentos/EquipmentListPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| expenses | frontend/src/pages/financeiro/ExpensesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| fiscal | frontend/src/pages/fiscal/FiscalNotesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | GET /fiscal/notas/:id/pdf; GET /fiscal/notas; GET /fiscal/notas/:id/xml; POST /fiscal/notas/:id/cancelar |
| frontend/src/pages/cadastros/customer360 | frontend/src/pages/cadastros/Customer360Page.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… |  |
| frontend/src/pages/crm | frontend/src/pages/CrmDashboardPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ |  |
| frontend/src/pages/crm-pipeline | frontend/src/pages/CrmPipelinePage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ |  |
| frontend/src/pages/emails/email | frontend/src/pages/emails/EmailComposePage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ | âŒ |  |
| frontend/src/pages/emails/email | frontend/src/pages/emails/EmailInboxPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/emails/email | frontend/src/pages/emails/EmailSettingsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/estoque/batch | frontend/src/pages/estoque/BatchManagementPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ |  |
| frontend/src/pages/financeiro/fueling-logs | frontend/src/pages/financeiro/FuelingLogsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… |  |
| frontend/src/pages/fleet/fleet | frontend/src/pages/fleet/FleetPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |  |
| frontend/src/pages/ia/aianalytics | frontend/src/pages/ia/AIAnalyticsPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro | frontend/src/pages/inmetro/InmetroDashboardPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro-competitor | frontend/src/pages/inmetro/InmetroCompetitorPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro-competitors | frontend/src/pages/inmetro/InmetroCompetitorsPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro-compliance | frontend/src/pages/inmetro/InmetroCompliancePage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro-executive | frontend/src/pages/inmetro/InmetroExecutivePage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro-import | frontend/src/pages/inmetro/InmetroImportPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âœ… |  |
| frontend/src/pages/inmetro/inmetro-map | frontend/src/pages/inmetro/InmetroMapPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… |  |
| frontend/src/pages/inmetro/inmetro-market | frontend/src/pages/inmetro/InmetroMarketPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ |  |
| frontend/src/pages/inmetro/inmetro-owner | frontend/src/pages/inmetro/InmetroOwnerDetailPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… |  |
| frontend/src/pages/inmetro/inmetro-prospection | frontend/src/pages/inmetro/InmetroProspectionPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/inmetro/inmetro-webhooks | frontend/src/pages/inmetro/InmetroWebhooksPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/integracao/auvo-import | frontend/src/pages/integracao/AuvoImportPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ |  |
| frontend/src/pages/login | frontend/src/pages/LoginPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ |  |
| frontend/src/pages/message-templates | frontend/src/pages/MessageTemplatesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/portal/portal-login | frontend/src/pages/portal/PortalLoginPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |  |
| frontend/src/pages/rh/benefits | frontend/src/pages/rh/BenefitsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/rh/org-chart | frontend/src/pages/rh/OrgChartPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/rh/performance-review | frontend/src/pages/rh/PerformanceReviewDetailPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ |  |
| frontend/src/pages/rh/recruitment | frontend/src/pages/rh/RecruitmentPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/rh/skills | frontend/src/pages/rh/SkillsMatrixPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ |  |
| frontend/src/pages/tech/tech | frontend/src/pages/tech/TechProfilePage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |  |
| frontend/src/pages/tech/tech | frontend/src/pages/tech/TechSettingsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ | âœ… |  |
| frontend/src/pages/tech/tech-barcode | frontend/src/pages/tech/TechBarcodePage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ | âŒ |  |
| frontend/src/pages/tech/tech-bluetooth-print | frontend/src/pages/tech/TechBluetoothPrintPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-chat | frontend/src/pages/tech/TechChatPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-check | frontend/src/pages/tech/TechChecklistPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-expense | frontend/src/pages/tech/TechExpensePage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-photo-annotation | frontend/src/pages/tech/TechPhotoAnnotationPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-photos | frontend/src/pages/tech/TechPhotosPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-signature | frontend/src/pages/tech/TechSignaturePage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ | âŒ |  |
| frontend/src/pages/tech/tech-thermal-camera | frontend/src/pages/tech/TechThermalCameraPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âœ… | âŒ |  |
| frontend/src/pages/tech/tech-voice-report | frontend/src/pages/tech/TechVoiceReportPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âŒ | âœ… | âŒ |  |
| fund-transfers | frontend/src/pages/financeiro/FundTransfersPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /fund-transfers/summary; POST /fund-transfers; GET /technicians/options; GET /bank-accounts; POST /fund-transfers/:id/cancel; GET /fund-transfers |
| hr | frontend/src/pages/rh/AccountingReportsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ | GET /hr/reports/accounting/export; GET /hr/reports/accounting |
| hr | frontend/src/pages/rh/ClockAdjustmentsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /hr/adjustments; POST /hr/adjustments/:id/approve; POST /hr/adjustments/:id/reject |
| hr | frontend/src/pages/rh/ClockInPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ | POST /hr/advanced/clock-out; POST /hr/advanced/clock-in; GET /hr/advanced/clock/status |
| hr | frontend/src/pages/rh/EmployeeDocumentsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /hr/documents/expiring; GET /technicians/options; POST /hr/documents; DELETE /hr/documents/:id; GET /hr/documents |
| hr | frontend/src/pages/rh/GeofenceLocationsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | PUT /hr/geofences/:id; POST /hr/geofences; DELETE /hr/geofences/:id; GET /hr/geofences |
| hr | frontend/src/pages/rh/HolidaysPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /hr/holidays; POST /hr/holidays/import-national; PUT /hr/holidays/:id; POST /hr/holidays; DELETE /hr/holidays/:id |
| hr | frontend/src/pages/rh/HRPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /hr/clock/all; GET /hr/dashboard; GET /hr/trainings; GET /hr/schedules |
| hr | frontend/src/pages/rh/JourneyPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | POST /hr/journey/calculate; GET /technicians/options; GET /hr/journey/entries; GET /hr/hour-bank/balance |
| hr | frontend/src/pages/rh/JourneyRulesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | DELETE /hr/journey-rules/:id; POST /hr/journey-rules; PUT /hr/journey-rules/:id; GET /hr/journey-rules |
| hr | frontend/src/pages/rh/LeavesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | POST /hr/leaves/:id/reject; POST /hr/leaves; GET /hr/leaves; POST /hr/leaves/:id/approve |
| hr | frontend/src/pages/rh/OnboardingPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | POST /hr/onboarding/templates; GET /hr/onboarding/checklists; GET /technicians/options; GET /hr/onboarding/templates; POST /hr/onboarding/start; POST /hr/onboarding/items/:id/complete |
| hr | frontend/src/pages/rh/PeopleAnalyticsPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âŒ | âŒ | GET /hr/analytics/dashboard |
| hr | frontend/src/pages/rh/RecruitmentKanbanPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âœ… | POST /hr/job-postings/:id/candidates; PUT /hr/candidates/:id; GET /hr/job-postings/:id |
| hr | frontend/src/pages/rh/VacationBalancePage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /hr/vacation-balances |
| import | frontend/src/pages/importacao/ImportPage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| inmetro | frontend/src/pages/inmetro/InmetroInstrumentsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /inmetro/export/instruments |
| inmetro | frontend/src/pages/inmetro/InmetroLeadsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /inmetro/export/leads |
| inventory | frontend/src/pages/estoque/InventoryCreatePage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ | POST /inventory/inventories; GET /inventory/warehouses |
| inventory | frontend/src/pages/estoque/InventoryExecutionPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | POST /inventory/inventories/:id/complete; GET /inventory/inventories/:id; PUT /inventory/inventories/:id/items/:id |
| inventory | frontend/src/pages/estoque/InventoryListPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /inventory/inventories; GET /inventory/warehouses |
| inventory | frontend/src/pages/inmetro/InmetroSealReportPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | GET /inventory/seals/audit; GET /inventory/seals/export; GET /inventory/seals |
| inventory | frontend/src/pages/tech/TechSealsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | GET /inventory/seals/my; GET /tech/os/:id; POST /inventory/seals/:id/use |
| invoices | frontend/src/pages/financeiro/InvoicesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| notifications | frontend/src/pages/notificacoes/NotificationsPage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| payment-methods | frontend/src/pages/financeiro/PaymentMethodsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| payments | frontend/src/pages/financeiro/PaymentsPage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| permissions | frontend/src/pages/iam/PermissionsMatrixPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| portal | frontend/src/pages/portal/PortalDashboardPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âŒ | âœ… | âŒ |  |
| portal | frontend/src/pages/portal/PortalFinancialsPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âŒ |  |
| portal | frontend/src/pages/portal/PortalQuotesPage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | âŒ |  |
| portal | frontend/src/pages/portal/PortalServiceCallPage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âŒ | âŒ | âŒ |  |
| portal | frontend/src/pages/portal/PortalWorkOrdersPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âŒ |  |
| price-history | frontend/src/pages/cadastros/PriceHistoryPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| products | frontend/src/pages/cadastros/ProductsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| profile | frontend/src/pages/configuracoes/ProfilePage.tsx | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âŒ | âŒ |  |
| quality | frontend/src/pages/qualidade/QualityPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /quality/surveys; GET /quality/complaints; GET /quality/nps; GET /quality/dashboard; GET /quality/corrective-actions; GET /quality/procedures |
| quote-items | frontend/src/pages/orcamentos/QuoteEditPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| quotes | frontend/src/pages/orcamentos/QuoteDetailPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| quotes | frontend/src/pages/orcamentos/QuotesListPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| reconciliation-rules | frontend/src/pages/financeiro/ReconciliationRulesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | PUT /reconciliation-rules/:id; DELETE /reconciliation-rules/:id; POST /reconciliation-rules/test; POST /reconciliation-rules; POST /reconciliation-rules/:id/toggle; GET /reconciliation-rules |
| recurring-contracts | frontend/src/pages/os/RecurringContractsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| reports | frontend/src/pages/relatorios/ReportsPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âŒ |  |
| roles | frontend/src/pages/iam/RolesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| schedules | frontend/src/pages/tecnicos/SchedulesPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /technicians/options; GET /technician/schedules/conflicts |
| service-calls | frontend/src/pages/chamados/ServiceCallDetailPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /service-calls-assignees |
| service-calls | frontend/src/pages/chamados/ServiceCallEditPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /service-calls-assignees |
| service-calls | frontend/src/pages/chamados/ServiceCallsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| service-calls | frontend/src/pages/chamados/TechnicianAgendaPage.tsx | âœ… | âœ… | âœ… | âŒ | âŒ | âœ… | âœ… | âœ… | GET /service-calls-assignees |
| service-calls-map | frontend/src/pages/chamados/ServiceCallMapPage.tsx | âœ… | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| service-checklists | frontend/src/pages/os/ServiceChecklistsPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| services | frontend/src/pages/cadastros/ServicesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| settings | frontend/src/pages/configuracoes/SettingsPage.tsx | âœ… | âœ… | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /numbering-sequences; PUT /numbering-sequences/:id |
| sla-dashboard | frontend/src/pages/os/SlaDashboardPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| sla-policies | frontend/src/pages/os/SlaPoliciesPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| standard-weights | frontend/src/pages/equipamentos/StandardWeightsPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /standard-weights/constants; GET /standard-weights/expiring; DELETE /standard-weights/:id; PUT /standard-weights/:id; GET /standard-weights/export; POST /standard-weights; GET /standard-weights |
| stock | frontend/src/pages/estoque/InventoryPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | POST /stock/inventories/:id/complete; GET /stock/inventories; POST /stock/inventories; POST /stock/inventories/:id/cancel; GET /stock/warehouses; PUT /stock/inventories/:id/items/:id; GET /stock/inventories/:id |
| stock | frontend/src/pages/estoque/KardexPage.tsx | âœ… | âœ… | âœ… | âŒ | âŒ | âœ… | âœ… | âœ… | GET /stock/products/:id/kardex; GET /stock/warehouses |
| stock | frontend/src/pages/estoque/StockDashboardPage.tsx | âœ… | âœ… | âŒ | âœ… | âŒ | âœ… | âœ… | âœ… |  |
| stock | frontend/src/pages/estoque/StockIntelligencePage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /stock/intelligence/abc-curve; GET /stock/intelligence/reorder-points; GET /stock/intelligence/average-cost; GET /stock/intelligence/turnover |
| stock | frontend/src/pages/estoque/StockMovementsPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /warehouses; POST /stock/import-xml |
| stock-disposals | frontend/src/pages/estoque/StockIntegrationPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | GET /rma; PUT /purchase-quotes/:id; GET /purchase-quotes; GET /asset-tags; GET /material-requests; PUT /material-requests/:id; PUT /rma/:id; GET /stock-disposals; PUT /stock-disposals/:id |
| suppliers | frontend/src/pages/cadastros/SuppliersPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| tech | frontend/src/pages/tech/TechWorkOrdersPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /tech/sync |
| technician | frontend/src/pages/tech/TechWidgetPage.tsx | âœ… | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | GET /technician/work-orders |
| technician-cash | frontend/src/pages/tecnicos/TechnicianCashPage.tsx | âœ… | âœ… | âŒ | âŒ | âœ… | âœ… | âœ… | âœ… | GET /technicians/options |
| technicians | frontend/src/pages/tech/TechWorkOrderDetailPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âŒ | âŒ | POST /technicians/customers/:id/geolocation |
| tenants | frontend/src/pages/configuracoes/TenantManagementPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| time-entries | frontend/src/pages/tecnicos/TimeEntriesPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | GET /technicians/options |
| users | frontend/src/pages/iam/UsersPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| users | frontend/src/pages/os/WorkOrderCreatePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| users | frontend/src/pages/rh/PerformancePage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| warehouses | frontend/src/pages/estoque/WarehousesPage.tsx | âœ… | âŒ | âŒ | âŒ | âœ… | âœ… | âœ… | âŒ | POST /warehouses; GET /warehouses; DELETE /warehouses/:id; PUT /warehouses/:id |
| work-orders | frontend/src/pages/os/WorkOrderDetailPage.tsx | âœ… | âœ… | âœ… | âŒ | âœ… | âœ… | âœ… | âœ… | POST /work-orders/:id/authorize-dispatch |
| work-orders | frontend/src/pages/os/WorkOrderKanbanPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
| work-orders | frontend/src/pages/os/WorkOrdersListPage.tsx | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |  |
