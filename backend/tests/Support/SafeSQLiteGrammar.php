<?php

namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Grammars\SQLiteGrammar;
use Illuminate\Support\Fluent;

class SafeSQLiteGrammar extends SQLiteGrammar
{
    public function compileIndex(Blueprint $blueprint, Fluent $command): string
    {
        $sql = parent::compileIndex($blueprint, $command);

        return str_replace('create index', 'create index if not exists', $sql);
    }
}
