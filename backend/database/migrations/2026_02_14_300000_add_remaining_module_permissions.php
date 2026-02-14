<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    private array $permissions = [
        // Fornecedores (scan prefix: cadastros.supplier)
        'cadastros.supplier.view',
        'cadastros.supplier.create',
        'cadastros.supplier.update',
        'cadastros.supplier.delete',

        // Contas a Receber (scan prefix: financeiro.receivable)
        'financeiro.receivable.view',
        'financeiro.receivable.create',
        'financeiro.receivable.update',
        'financeiro.receivable.delete',

        // Contas a Pagar (scan prefix: financeiro.payable)
        'financeiro.payable.view',
        'financeiro.payable.create',
        'financeiro.payable.update',
        'financeiro.payable.delete',

        // Despesas (scan prefix: financeiro.expense)
        'financeiro.expense.view',
        'financeiro.expense.create',
        'financeiro.expense.update',
        'financeiro.expense.delete',
        'financeiro.expense.approve',

        // Faturamento (scan prefix: financeiro.invoice)
        'financeiro.invoice.view',
        'financeiro.invoice.create',
        'financeiro.invoice.update',
        'financeiro.invoice.delete',

        // Formas de Pagamento (scan prefix: financeiro.payment_method)
        'financeiro.payment_method.view',
        'financeiro.payment_method.create',
        'financeiro.payment_method.update',
        'financeiro.payment_method.delete',

        // Conciliação Bancária (scan prefix: financeiro.reconciliation)
        'financeiro.reconciliation.view',
        'financeiro.reconciliation.create',
        'financeiro.reconciliation.update',

        // Plano de Contas (scan prefix: financeiro.chart)
        'financeiro.chart.view',
        'financeiro.chart.create',
        'financeiro.chart.update',
        'financeiro.chart.delete',

        // Fluxo de Caixa (scan prefix: financeiro.cashflow)
        'financeiro.cashflow.view',
        'financeiro.cashflow.export',

        // Ordens de Serviço (scan prefix: os.workorder)
        'os.workorder.view',
        'os.workorder.create',
        'os.workorder.update',
        'os.workorder.delete',

        // Contratos Recorrentes (scan prefix: os.contract)
        'os.contract.view',
        'os.contract.create',
        'os.contract.update',
        'os.contract.delete',

        // Orçamentos (scan prefix: comercial.quote)
        'comercial.quote.view',
        'comercial.quote.create',
        'comercial.quote.update',
        'comercial.quote.delete',
        'comercial.quote.approve',

        // Equipamentos (scan prefix: metrologia.equipment)
        'metrologia.equipment.view',
        'metrologia.equipment.create',
        'metrologia.equipment.update',
        'metrologia.equipment.delete',

        // Pesos Padrão (scan prefix: metrologia.peso)
        'metrologia.peso.view',
        'metrologia.peso.create',
        'metrologia.peso.update',
        'metrologia.peso.delete',

        // Chamados (scan prefix: atendimento.chamado)
        'atendimento.chamado.view',
        'atendimento.chamado.create',
        'atendimento.chamado.update',
        'atendimento.chamado.delete',

        // Auvo Import (scan prefix: integracao.auvo)
        'integracao.auvo.view',
        'integracao.auvo.import',
        'integracao.auvo.sync',

        // Portal do Cliente
        'portal.access.view',
        'portal.access.manage',

        // Configurações
        'configuracoes.settings.view',
        'configuracoes.settings.update',

        // Relatórios
        'relatorios.report.view',
        'relatorios.report.export',

        // Emails
        'emails.email.view',
        'emails.email.send',
        'emails.email.delete',

        // Importação
        'importacao.data.view',
        'importacao.data.execute',

        // Estoque Integrações
        'estoque.integration.view',
        'estoque.integration.create',
        'estoque.integration.update',

        // Fiscal
        'fiscal.nfe.view',
        'fiscal.nfe.emit',
        'fiscal.nfse.view',
        'fiscal.nfse.emit',
    ];

    public function up(): void
    {
        foreach ($this->permissions as $permName) {
            Permission::firstOrCreate(
                ['name' => $permName, 'guard_name' => 'web']
            );
        }

        // Grant all to super_admin
        $superAdmin = \Spatie\Permission\Models\Role::where('name', 'super_admin')
            ->where('guard_name', 'web')
            ->first();

        if ($superAdmin) {
            $superAdmin->syncPermissions(Permission::all());
        }

        // Grant financial permissions to admin + financeiro
        $financialPerms = array_filter($this->permissions, fn($p) => str_starts_with($p, 'financeiro.'));
        foreach (['admin', 'gerente', 'financeiro'] as $roleName) {
            $role = \Spatie\Permission\Models\Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                foreach ($financialPerms as $perm) {
                    try { $role->givePermissionTo($perm); } catch (\Exception $e) {}
                }
            }
        }
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\DB::table('permissions')->whereIn('name', $this->permissions)->delete();
    }
};
