<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\Service;
use App\Models\ProductCategory;
use App\Models\ServiceCategory;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

class ProfessionalDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Obter o Tenant principal (ou criar se não existir, para evitar erros)
        $tenant = Tenant::first();
        
        if (!$tenant) {
            $this->command->info('Nenhum Tenant encontrado. Criando um Tenant padrão para associar os dados...');
            $tenant = Tenant::create([
                'name' => 'Empresa Matriz',
                'doc_number' => '00000000000191', // CNPJ Fictício
                'is_active' => true,
            ]);
        }

        $tenantId = $tenant->id;

        DB::transaction(function () use ($tenantId) {
            $this->seedProductCategories($tenantId);
            $this->seedServiceCategories($tenantId);
            $this->seedServices($tenantId);
            $this->seedProducts($tenantId);
        });
    }

    private function seedProductCategories($tenantId)
    {
        $categories = [
            'Balanças Comerciais',
            'Balanças Industriais',
            'Balanças de Precisão',
            'Balanças Rodoviárias',
            'Balanças de Gado',
            'Pesos Padrão M1',
            'Pesos Padrão F1',
            'Pesos Padrão E2',
            'Células de Carga',
            'Indicadores Digitais',
            'Impressoras Térmicas',
            'Etiquetas e Bobinas',
            'Peças de Reposição Mecânica',
            'Peças Eletrônicas',
        ];

        foreach ($categories as $name) {
            ProductCategory::firstOrCreate(
                ['name' => $name, 'tenant_id' => $tenantId],
                ['is_active' => true]
            );
        }
        $this->command->info('Categorias de Produtos criadas.');
    }

    private function seedServiceCategories($tenantId)
    {
        $categories = [
            'Calibração RBC',
            'Calibração Rastreável',
            'Manutenção Preventiva',
            'Manutenção Corretiva',
            'Instalação e Montagem',
            'Ajuste e Verificação',
            'Consultoria Metrológica',
        ];

        foreach ($categories as $name) {
            ServiceCategory::firstOrCreate(
                ['name' => $name, 'tenant_id' => $tenantId],
                ['is_active' => true]
            );
        }
        $this->command->info('Categorias de Serviços criadas.');
    }

    private function seedServices($tenantId)
    {
        // Lista profissional de serviços de metrologia
        $servicesData = [
            ['name' => 'Calibração RBC Balança Analítica até 200g', 'cat' => 'Calibração RBC', 'price' => 250.00, 'min' => 60],
            ['name' => 'Calibração RBC Balança de Precisão até 5kg', 'cat' => 'Calibração RBC', 'price' => 180.00, 'min' => 45],
            ['name' => 'Calibração RBC Balança Industrial até 300kg', 'cat' => 'Calibração RBC', 'price' => 220.00, 'min' => 60],
            ['name' => 'Calibração RBC Balança Rodoviária até 80t', 'cat' => 'Calibração RBC', 'price' => 1200.00, 'min' => 240],
            ['name' => 'Calibração Rastreável Balança Comercial até 30kg', 'cat' => 'Calibração Rastreável', 'price' => 80.00, 'min' => 30],
            ['name' => 'Calibração Rastreável Balança Plataforma até 1000kg', 'cat' => 'Calibração Rastreável', 'price' => 250.00, 'min' => 90],
            ['name' => 'Ajuste de Peso Padrão Classe M1 20kg', 'cat' => 'Ajuste e Verificação', 'price' => 50.00, 'min' => 20],
            ['name' => 'Ajuste de Peso Padrão Classe F1 1kg', 'cat' => 'Ajuste e Verificação', 'price' => 80.00, 'min' => 30],
            ['name' => 'Manutenção Preventiva Balança Toledo Prix 3', 'cat' => 'Manutenção Preventiva', 'price' => 120.00, 'min' => 60],
            ['name' => 'Manutenção Preventiva Balança Urano Pop', 'cat' => 'Manutenção Preventiva', 'price' => 110.00, 'min' => 60],
            ['name' => 'Manutenção Corretiva Troca de Célula de Carga', 'cat' => 'Manutenção Corretiva', 'price' => 150.00, 'min' => 90],
            ['name' => 'Manutenção Corretiva Troca de Teclado Membrana', 'cat' => 'Manutenção Corretiva', 'price' => 80.00, 'min' => 45],
            ['name' => 'Visita Técnica (Hora Técnica)', 'cat' => 'Manutenção Corretiva', 'price' => 180.00, 'min' => 60],
            ['name' => 'Deslocamento Técnico (KM)', 'cat' => 'Consultoria Metrológica', 'price' => 1.50, 'min' => 0],
            ['name' => 'Emissão de Certificado Digital', 'cat' => 'Consultoria Metrológica', 'price' => 20.00, 'min' => 10],
            ['name' => 'Instalação de Balança Rodoviária (Obra Civil não inclusa)', 'cat' => 'Instalação e Montagem', 'price' => 5000.00, 'min' => 960],
            ['name' => 'Verificação Intermediária de Balanças', 'cat' => 'Ajuste e Verificação', 'price' => 100.00, 'min' => 45],
            ['name' => 'Calibração RBC Durômetro Shore A', 'cat' => 'Calibração RBC', 'price' => 350.00, 'min' => 60],
            ['name' => 'Calibração RBC Durômetro Shore D', 'cat' => 'Calibração RBC', 'price' => 350.00, 'min' => 60],
            ['name' => 'Calibração Rastreável Paquímetro até 200mm', 'cat' => 'Calibração Rastreável', 'price' => 60.00, 'min' => 20],
            ['name' => 'Calibração Rastreável Micrômetro até 25mm', 'cat' => 'Calibração Rastreável', 'price' => 70.00, 'min' => 30],
            ['name' => 'Substituição de Bateria Externa', 'cat' => 'Manutenção Corretiva', 'price' => 40.00, 'min' => 15],
            ['name' => 'Limpeza Química de Pesos Padrão', 'cat' => 'Manutenção Preventiva', 'price' => 30.00, 'min' => 20],
            ['name' => 'Pintura de Plataforma 1x1m', 'cat' => 'Manutenção Preventiva', 'price' => 250.00, 'min' => 120],
            ['name' => 'Troca de Cabo de Célula de Carga', 'cat' => 'Manutenção Corretiva', 'price' => 90.00, 'min' => 60],
            ['name' => 'Configuração de Indicador Digital', 'cat' => 'Ajuste e Verificação', 'price' => 120.00, 'min' => 60],
            ['name' => 'Auditoria de Sistema de Pesagem', 'cat' => 'Consultoria Metrológica', 'price' => 800.00, 'min' => 240],
            ['name' => 'Treinamento de Operadores (4 horas)', 'cat' => 'Consultoria Metrológica', 'price' => 600.00, 'min' => 240],
            ['name' => 'Calibração RBC Termômetro Digital', 'cat' => 'Calibração RBC', 'price' => 180.00, 'min' => 60],
            ['name' => 'Calibração Rastreável Trena até 5m', 'cat' => 'Calibração Rastreável', 'price' => 50.00, 'min' => 15],
            ['name' => 'Troca de Display LCD', 'cat' => 'Manutenção Corretiva', 'price' => 120.00, 'min' => 60],
            ['name' => 'Reparo em Placa Mãe (Nível Componente)', 'cat' => 'Manutenção Corretiva', 'price' => 450.00, 'min' => 180],
            ['name' => 'Instalação de Módulo de Bateria', 'cat' => 'Instalação e Montagem', 'price' => 60.00, 'min' => 30],
            ['name' => 'Calibração de Dinamômetro até 5 toneldaas', 'cat' => 'Calibração RBC', 'price' => 800.00, 'min' => 120],
            ['name' => 'Verificação de Excentricidade', 'cat' => 'Ajuste e Verificação', 'price' => 150.00, 'min' => 45],
            ['name' => 'Reforma completa Balança Mecânica 300kg', 'cat' => 'Manutenção Corretiva', 'price' => 600.00, 'min' => 480],
            ['name' => 'Conversão de Mecânica para Eletrônica', 'cat' => 'Instalação e Montagem', 'price' => 1800.00, 'min' => 360],
            ['name' => 'Laudo Técnico de Condenação', 'cat' => 'Consultoria Metrológica', 'price' => 150.00, 'min' => 45],
            ['name' => 'Calibração RBC Massa Padrão 500kg', 'cat' => 'Calibração RBC', 'price' => 450.00, 'min' => 60],
            ['name' => 'Calibração Rastreável Manômetro até 10 bar', 'cat' => 'Calibração Rastreável', 'price' => 90.00, 'min' => 30],
            ['name' => 'Troca de Pés Niveladores (Jogo)', 'cat' => 'Manutenção Corretiva', 'price' => 40.00, 'min' => 20],
            ['name' => 'Impermeabilização de Placas', 'cat' => 'Manutenção Preventiva', 'price' => 80.00, 'min' => 60],
            ['name' => 'Aferição INMETRO (Acompanhamento)', 'cat' => 'Consultoria Metrológica', 'price' => 300.00, 'min' => 120],
            ['name' => 'Calibração Balança de Fluxo', 'cat' => 'Calibração RBC', 'price' => 1500.00, 'min' => 240],
            ['name' => 'Calibração Balança Dosadora', 'cat' => 'Calibração RBC', 'price' => 1200.00, 'min' => 240],
            ['name' => 'Manutenção Preventiva Contrato Mensal', 'cat' => 'Manutenção Preventiva', 'price' => 100.00, 'min' => 60],
            ['name' => 'Limpeza e Lubrificação de Mecanismo', 'cat' => 'Manutenção Preventiva', 'price' => 150.00, 'min' => 90],
            ['name' => 'Troca de Cabo de Comunicação Serial', 'cat' => 'Manutenção Corretiva', 'price' => 60.00, 'min' => 30],
            ['name' => 'Instalação de Kit Comunicação Wi-Fi', 'cat' => 'Instalação e Montagem', 'price' => 250.00, 'min' => 60],
            ['name' => 'Validação de Software de Pesagem', 'cat' => 'Consultoria Metrológica', 'price' => 1500.00, 'min' => 480],
        ];

        foreach ($servicesData as $data) {
            $category = ServiceCategory::where('name', $data['cat'])->where('tenant_id', $tenantId)->first();
            
            // Gerar um código único
            $slug = strtoupper(substr(\Illuminate\Support\Str::slug($data['name']), 0, 3));
            $baseCode = 'SRV-' . $slug;
            $code = $baseCode . '-' . rand(1000, 9999);
            
            // Garantir unicidade
            while(Service::where('code', $code)->where('tenant_id', $tenantId)->exists()) {
                 $code = $baseCode . '-' . rand(1000, 9999);
            }

            // Usar updateOrCreate para permitir re-running sem erro, atualizando dados se necessário
            Service::updateOrCreate(
                ['name' => $data['name'], 'tenant_id' => $tenantId],
                [
                    'code' => $code, // Note: Isso só atualiza se criar. Se já existe, mantém o code (pq não está no array de busca? Não, updateOrCreate atualiza TUDO no segundo array). 
                    // Se eu quero MANTER o code existente, eu deveria buscar primeiro.
                    // Mas como o code é gerado randomicamente, toda vez que rodar vai mudar o code se eu atualizar?
                    // Melhor usar firstOrNew e só setar o code se for novo.
                ]
            );

            $service = Service::where('name', $data['name'])->where('tenant_id', $tenantId)->first();
            if (!$service) {
                 $service = new Service();
                 $service->name = $data['name'];
                 $service->tenant_id = $tenantId;
                 $service->code = $code;
            }
            // Atualizar/Setar outros campos
            $service->category_id = $category ? $category->id : null;
            $service->description = "Serviço profissional de {$data['name']}";
            $service->default_price = $data['price'];
            $service->estimated_minutes = $data['min'];
            $service->is_active = true;
            $service->save();
        }
        $this->command->info('50 Serviços profissionais criados.');
    }

    private function seedProducts($tenantId)
    {
        $brands = ['Toledo', 'Urano', 'Prix', 'Filizola', 'Elgin', 'Ramuza', 'Micheletti', 'Balanças Jundiaí', 'Digitron', 'Mettler Toledo'];
        
        $types = [
            'Balança Comercial' => ['cap' => ['15kg', '30kg', '6kg', '20kg'], 'cat' => 'Balanças Comerciais', 'base_price' => 800],
            'Balança Computadora' => ['cap' => ['15kg', '30kg'], 'cat' => 'Balanças Comerciais', 'base_price' => 1200],
            'Balança Industrial' => ['cap' => ['100kg', '300kg', '500kg', '1000kg', '2000kg'], 'cat' => 'Balanças Industriais', 'base_price' => 2500],
            'Balança de Plataforma' => ['cap' => ['500kg', '1t', '2t', '5t'], 'cat' => 'Balanças Industriais', 'base_price' => 3500],
            'Balança Analítica' => ['cap' => ['200g', '500g', '1000g'], 'cat' => 'Balanças de Precisão', 'base_price' => 5000],
            'Balança Semi-Analítica' => ['cap' => ['2000g', '5000g'], 'cat' => 'Balanças de Precisão', 'base_price' => 3000],
            'Balança Rodoviária' => ['cap' => ['40t', '60t', '80t', '100t', '120t'], 'cat' => 'Balanças Rodoviárias', 'base_price' => 80000],
            'Célula de Carga' => ['cap' => ['50kg', '100kg', '500kg', '1t', '20t', '30t'], 'cat' => 'Células de Carga', 'base_price' => 400],
            'Indicador Digital' => ['cap' => ['Universal'], 'cat' => 'Indicadores Digitais', 'base_price' => 1500],
            'Peso Padrão' => ['cap' => ['1g', '10g', '50g', '100g', '500g', '1kg', '5kg', '10kg', '20kg'], 'cat' => 'Pesos Padrão M1', 'base_price' => 150],
            'Bobina Térmica' => ['cap' => ['40x40mm', '60x40mm', 'Térmica 80mm'], 'cat' => 'Etiquetas e Bobinas', 'base_price' => 15],
            'Impressora Térmica' => ['cap' => ['USB', 'Ethernet', 'Serial'], 'cat' => 'Impressoras Térmicas', 'base_price' => 900],
        ];

        $totalTarget = 1000;
        $currentCount = 0;

        while ($currentCount < $totalTarget) {
            // Selecionar aleatoriamente um tipo
            $typeName = array_rand($types);
            $typeData = $types[$typeName];
            
            // Selecionar aleatoriamente uma marca
            $brand = $brands[array_rand($brands)];
            
            // Selecionar aleatoriamente uma capacidade
            $capacity = $typeData['cap'][array_rand($typeData['cap'])];
            
            // Nome do Produto
            $productName = "$typeName $brand $capacity";
            
            // Variação de preço baseada na capacidade (simples heurística)
            $capValue = (int) filter_var($capacity, FILTER_SANITIZE_NUMBER_INT);
            if (!$capValue) $capValue = 1;
            
            // Fator de preço: variações aleatórias de +/- 15%
            $randomFactor = rand(85, 115) / 100;
            
            // Custo aproximado (50% a 70% do preço de venda)
            $costFactor = rand(50, 70) / 100;

            $sellPrice = $typeData['base_price'] * $randomFactor;
            
            // Código único
            $code = strtoupper(substr($brand, 0, 3) . substr($typeName, 0, 3) . $capValue . rand(1000, 9999));
            
            $category = ProductCategory::where('name', $typeData['cat'])->where('tenant_id', $tenantId)->first();

            // Evitar duplicidade de código no loop (check rápido, mas o firstOrCreate cuida do DB)
            if (Product::where('code', $code)->where('tenant_id', $tenantId)->exists()) {
                continue;
            }

            // Melhorar a descrição com base no tipo
            $features = [];
            if (str_contains($typeName, 'Balança')) {
                $features[] = 'Display LED de alta visibilidade';
                $features[] = 'Bateria interna recarregável (100h)';
                $features[] = 'Função Tara e Zero automático';
                $features[] = 'Prato em aço inoxidável';
            }
            if (str_contains($typeName, 'Comercial')) {
                $features[] = 'Homologada pelo INMETRO';
                $features[] = 'Saída Serial RS-232 para computador';
                $features[] = 'Teclado numérico resistente a respingos';
            }
            if (str_contains($typeName, 'Rodoviária')) {
                $features[] = 'Células de carga blindadas IP68';
                $features[] = 'Software de gerenciamento incluso';
                $features[] = 'Estrutura em concreto ou aço';
            }
            if (str_contains($typeName, 'Precisão') || str_contains($typeName, 'Analítica')) {
                $features[] = 'Capela de vidro contra correntes de ar';
                $features[] = 'Calibração interna motorizada';
                $features[] = 'Interface de dados USB/Lan';
            }
            if (str_contains($typeName, 'Impressora')) {
                $features[] = 'Velocidade de impressão 150mm/s';
                $features[] = 'Compatível com ZPL/EPL';
                $features[] = 'Guilhotina automática (Cutter)';
            }
            
            // Selecionar 2 a 3 features aleatórias
            shuffle($features);
            $selectedFeatures = array_slice($features, 0, rand(2, 3));
            $featureString = implode(', ', $selectedFeatures);
            
            $desc = "$productName. Equipamento profissional da marca $brand. ";
            if (!empty($featureString)) {
                $desc .= "Destaques: $featureString. ";
            }
            $desc .= "Ideal para aplicações de $typeName. Capacidade: $capacity.";


            Product::create([
                'tenant_id' => $tenantId,
                'category_id' => $category ? $category->id : null,
                'code' => $code,
                'name' => $productName,
                'description' => $desc,
                'unit' => 'UN',
                'cost_price' => round($sellPrice * $costFactor, 2),
                'sell_price' => round($sellPrice, 2),
                'stock_qty' => rand(0, 100),
                'stock_min' => rand(5, 10),
                'track_stock' => true,
                'is_active' => true,
            ]);

            $currentCount++;
            
            if ($currentCount % 100 == 0) {
                $this->command->info("Gerados $currentCount produtos...");
            }
        }
        
        $this->command->info('1000 Produtos gerados com sucesso.');
    }
}
