<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Tenant;
use App\Services\ViaCepService;
use App\Services\BrasilApiService;
use App\Services\IbgeService;
use App\Services\HolidayService;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Http;

class ExternalApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    private User $user;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->actingAs($this->user);
    }

    public function test_cep_lookup_returns_address(): void
    {
        Http::fake([
            'viacep.com.br/*' => Http::response([
                'cep' => '01001-000',
                'logradouro' => 'Praça da Sé',
                'complemento' => 'lado ímpar',
                'bairro' => 'Sé',
                'localidade' => 'São Paulo',
                'uf' => 'SP',
                'ibge' => '3550308',
            ]),
        ]);

        $response = $this->getJson('/api/v1/external/cep/01001000');

        $response->assertOk()
            ->assertJsonPath('city', 'São Paulo')
            ->assertJsonPath('state', 'SP')
            ->assertJsonPath('street', 'Praça da Sé');
    }

    public function test_cep_not_found_returns_404(): void
    {
        Http::fake([
            'viacep.com.br/*' => Http::response(['erro' => true]),
        ]);

        $response = $this->getJson('/api/v1/external/cep/00000000');
        $response->assertNotFound();
    }

    public function test_cnpj_lookup_returns_company_data(): void
    {
        Http::fake([
            'brasilapi.com.br/*' => Http::response([
                'cnpj' => '11222333000181',
                'razao_social' => 'EMPRESA TESTE LTDA',
                'nome_fantasia' => 'TESTE',
                'email' => 'contato@teste.com',
                'ddd_telefone_1' => '1199999999',
                'cep' => '01001000',
                'descricao_tipo_de_logradouro' => 'RUA',
                'logradouro' => 'TESTE',
                'numero' => '100',
                'complemento' => '',
                'bairro' => 'CENTRO',
                'municipio' => 'SAO PAULO',
                'uf' => 'SP',
                'descricao_situacao_cadastral' => 'ATIVA',
                'cnae_fiscal_descricao' => 'Comércio varejista',
                'porte' => 'MICRO EMPRESA',
                'data_inicio_atividade' => '2020-01-15',
            ]),
        ]);

        $response = $this->getJson('/api/v1/external/cnpj/11222333000181');

        $response->assertOk()
            ->assertJsonPath('name', 'EMPRESA TESTE LTDA')
            ->assertJsonPath('status', 'ATIVA');
    }

    public function test_cnpj_not_found_returns_404(): void
    {
        Http::fake([
            'brasilapi.com.br/*' => Http::response(['message' => 'CNPJ not found'], 404),
        ]);

        $response = $this->getJson('/api/v1/external/cnpj/00000000000000');
        $response->assertNotFound();
    }

    public function test_ibge_states_returns_list(): void
    {
        Http::fake([
            'servicodados.ibge.gov.br/api/v1/localidades/estados*' => Http::response([
                ['id' => 35, 'sigla' => 'SP', 'nome' => 'São Paulo'],
                ['id' => 33, 'sigla' => 'RJ', 'nome' => 'Rio de Janeiro'],
            ]),
        ]);

        $response = $this->getJson('/api/v1/external/states');

        $response->assertOk()
            ->assertJsonCount(2);
    }

    public function test_ibge_cities_returns_list(): void
    {
        Http::fake([
            'servicodados.ibge.gov.br/*' => Http::response([
                ['id' => 3550308, 'nome' => 'São Paulo'],
                ['id' => 3509502, 'nome' => 'Campinas'],
            ]),
        ]);

        $response = $this->getJson('/api/v1/external/states/SP/cities');

        $response->assertOk()
            ->assertJsonCount(2);
    }

    public function test_holidays_returns_list(): void
    {
        Http::fake([
            'brasilapi.com.br/*' => Http::response([
                ['date' => '2025-01-01', 'name' => 'Confraternização Universal', 'type' => 'national'],
                ['date' => '2025-04-21', 'name' => 'Tiradentes', 'type' => 'national'],
            ]),
        ]);

        $response = $this->getJson('/api/v1/external/holidays/2025');

        $response->assertOk()
            ->assertJsonCount(2);
    }

    public function test_holiday_service_business_days(): void
    {
        Http::fake([
            'brasilapi.com.br/*' => Http::response([
                ['date' => '2025-01-01', 'name' => 'Confraternização', 'type' => 'national'],
            ]),
        ]);

        $service = app(HolidayService::class);

        // Jan 1 (Wed) is holiday, Jan 2 (Thu) is business day 1, Jan 3 (Fri) is business day 2
        $result = $service->addBusinessDays(
            \Carbon\Carbon::parse('2025-01-01'),
            1
        );

        $this->assertEquals('2025-01-02', $result->toDateString());
    }
}
