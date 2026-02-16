<?php

namespace Tests\Support;

use Illuminate\Database\SQLiteConnection;

class SafeSQLiteConnection extends SQLiteConnection
{
    public function __construct($pdo, $database = '', $tablePrefix = '', array $config = [])
    {
        parent::__construct($pdo, $database, $tablePrefix, $config);

        $this->schemaGrammar = new SafeSQLiteGrammar($this);
    }
}
