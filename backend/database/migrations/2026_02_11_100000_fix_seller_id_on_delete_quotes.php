<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $t) {
            $t->dropForeign(['seller_id']);
            $t->unsignedBigInteger('seller_id')->nullable()->change();
            $t->foreign('seller_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $t) {
            $t->dropForeign(['seller_id']);
            $t->unsignedBigInteger('seller_id')->nullable(false)->change();
            $t->foreign('seller_id')->references('id')->on('users');
        });
    }
};
