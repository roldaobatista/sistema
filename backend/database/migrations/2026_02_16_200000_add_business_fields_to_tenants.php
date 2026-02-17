<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            if (!Schema::hasColumn('tenants', 'trade_name')) {
                $table->string('trade_name')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'website')) {
                $table->string('website')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'state_registration')) {
                $table->string('state_registration', 30)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'city_registration')) {
                $table->string('city_registration', 30)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_street')) {
                $table->string('address_street')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_number')) {
                $table->string('address_number', 20)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_complement')) {
                $table->string('address_complement', 100)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_neighborhood')) {
                $table->string('address_neighborhood', 100)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_city')) {
                $table->string('address_city', 100)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_state')) {
                $table->string('address_state', 2)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'address_zip')) {
                $table->string('address_zip', 10)->nullable();
            }
        });
    }

    public function down(): void
    {
        $columns = [
            'trade_name', 'website', 'state_registration', 'city_registration',
            'address_street', 'address_number', 'address_complement',
            'address_neighborhood', 'address_city', 'address_state', 'address_zip',
        ];

        Schema::table('tenants', function (Blueprint $table) use ($columns) {
            $existing = array_filter($columns, fn ($col) => Schema::hasColumn('tenants', $col));
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};
