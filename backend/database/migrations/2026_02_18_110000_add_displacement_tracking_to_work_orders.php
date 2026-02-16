<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('work_orders')) {
            Schema::table('work_orders', function (Blueprint $table) {
                if (!Schema::hasColumn('work_orders', 'displacement_started_at')) {
                    $table->timestamp('displacement_started_at')->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'displacement_arrived_at')) {
                    $table->timestamp('displacement_arrived_at')->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'displacement_duration_minutes')) {
                    $table->unsignedInteger('displacement_duration_minutes')->nullable();
                }
            });
        }

        if (!Schema::hasTable('work_order_displacement_stops')) {
            Schema::create('work_order_displacement_stops', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->string('type', 30);
                $table->timestamp('started_at');
                $table->timestamp('ended_at')->nullable();
                $table->text('notes')->nullable();
                $table->decimal('location_lat', 10, 7)->nullable();
                $table->decimal('location_lng', 10, 7)->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('work_order_displacement_locations')) {
            Schema::create('work_order_displacement_locations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->decimal('latitude', 10, 7);
                $table->decimal('longitude', 10, 7);
                $table->timestamp('recorded_at');
                $table->timestamps();
                $table->index(['work_order_id', 'recorded_at'], 'wo_disp_loc_wo_rec_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('work_order_displacement_locations')) {
            Schema::dropIfExists('work_order_displacement_locations');
        }
        if (Schema::hasTable('work_order_displacement_stops')) {
            Schema::dropIfExists('work_order_displacement_stops');
        }
        if (Schema::hasTable('work_orders')) {
            Schema::table('work_orders', function (Blueprint $table) {
                if (Schema::hasColumn('work_orders', 'displacement_started_at')) {
                    $table->dropColumn('displacement_started_at');
                }
                if (Schema::hasColumn('work_orders', 'displacement_arrived_at')) {
                    $table->dropColumn('displacement_arrived_at');
                }
                if (Schema::hasColumn('work_orders', 'displacement_duration_minutes')) {
                    $table->dropColumn('displacement_duration_minutes');
                }
            });
        }
    }
};
