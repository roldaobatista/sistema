<?php

namespace Tests;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        // Evita cascata "There is already an active transaction" no SQLite entre testes
        try {
            if (DB::connection()->getDatabaseName() !== ':memory:') {
                return;
            }
            $pdo = DB::connection()->getPdo();
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (\Throwable $e) {
            // ignora
        }
        parent::tearDown();
    }
}
