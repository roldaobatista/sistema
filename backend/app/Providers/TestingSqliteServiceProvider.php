<?php

namespace App\Providers;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Fluent;
use Illuminate\Support\ServiceProvider;

/**
 * Patches SQLite schema grammar to use IF NOT EXISTS for CREATE INDEX.
 * Prevents failures during table rebuilds caused by after()/constrained() in migrations.
 * Only loaded during testing (see phpunit.xml).
 */
class TestingSqliteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (config('database.default') !== 'sqlite') {
            return;
        }

        $connection = $this->app['db']->connection();
        $baseGrammar = $connection->getSchemaGrammar();

        if (!$baseGrammar) {
            return;
        }

        $connection->setSchemaGrammar(
            new class($connection) extends \Illuminate\Database\Schema\Grammars\SQLiteGrammar {
                public function compileIndex(Blueprint $blueprint, Fluent $command): string
                {
                    return str_replace(
                        'create index',
                        'create index if not exists',
                        parent::compileIndex($blueprint, $command)
                    );
                }
            }
        );
    }
}
