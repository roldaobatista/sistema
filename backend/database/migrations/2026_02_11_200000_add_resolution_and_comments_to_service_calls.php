<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_calls', function (Blueprint $t) {
            $t->text('resolution_notes')->nullable()->after('observations');
        });

        Schema::create('service_call_comments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('service_call_id');
            $t->unsignedBigInteger('user_id');
            $t->text('content');
            $t->timestamps();

            $t->foreign('service_call_id')->references('id')->on('service_calls')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->index('service_call_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_call_comments');

        Schema::table('service_calls', function (Blueprint $t) {
            $t->dropColumn('resolution_notes');
        });
    }
};
