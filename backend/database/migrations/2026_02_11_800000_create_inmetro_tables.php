<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('inmetro_history');
        Schema::dropIfExists('inmetro_instruments');
        Schema::dropIfExists('inmetro_locations');
        Schema::dropIfExists('inmetro_competitors');
        Schema::dropIfExists('inmetro_owners');

        Schema::create('inmetro_owners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('document', 20)->index();
            $table->string('name');
            $table->string('trade_name')->nullable();
            $table->enum('type', ['PF', 'PJ'])->default('PJ');
            $table->string('phone', 20)->nullable();
            $table->string('phone2', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('contact_source')->nullable();
            $table->timestamp('contact_enriched_at')->nullable();
            $table->enum('lead_status', ['new', 'contacted', 'negotiating', 'converted', 'lost'])->default('new');
            $table->enum('priority', ['urgent', 'high', 'normal', 'low'])->default('normal');
            $table->foreignId('converted_to_customer_id')->nullable()->constrained('customers')->onUpdate('cascade')->onDelete('set null');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'document']);
        });

        Schema::create('inmetro_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('inmetro_owners')->onUpdate('cascade')->onDelete('cascade');
            $table->string('state_registration', 30)->nullable();
            $table->string('farm_name')->nullable();
            $table->string('address_street')->nullable();
            $table->string('address_number', 20)->nullable();
            $table->string('address_complement')->nullable();
            $table->string('address_neighborhood')->nullable();
            $table->string('address_city');
            $table->string('address_state', 2)->default('MT');
            $table->string('address_zip', 10)->nullable();
            $table->string('phone_local', 20)->nullable();
            $table->string('email_local')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('distance_from_base_km', 8, 2)->nullable();
            $table->timestamps();

            $table->index(['address_city', 'address_state']);
        });

        Schema::create('inmetro_instruments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('inmetro_locations')->onUpdate('cascade')->onDelete('cascade');
            $table->string('inmetro_number', 30)->index();
            $table->string('serial_number', 50)->nullable();
            $table->string('brand', 50)->nullable();
            $table->string('model', 50)->nullable();
            $table->string('capacity', 30)->nullable();
            $table->string('instrument_type', 80)->default('Balança');
            $table->enum('current_status', ['approved', 'rejected', 'repaired', 'unknown'])->default('unknown');
            $table->date('last_verification_at')->nullable();
            $table->date('next_verification_at')->nullable();
            $table->string('last_executor')->nullable();
            $table->string('source', 30)->default('xml_import');
            $table->timestamps();

            $table->index('next_verification_at');
        });

        Schema::create('inmetro_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instrument_id')->constrained('inmetro_instruments')->onUpdate('cascade')->onDelete('cascade');
            $table->enum('event_type', ['verification', 'repair', 'rejection', 'initial'])->default('verification');
            $table->date('event_date');
            $table->enum('result', ['approved', 'rejected', 'repaired'])->default('approved');
            $table->string('executor')->nullable();
            $table->date('validity_date')->nullable();
            $table->text('notes')->nullable();
            $table->string('source', 30)->default('psie_import');
            $table->timestamps();

            $table->index('event_date');
        });

        Schema::create('inmetro_competitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('name');
            $table->string('cnpj', 20)->nullable();
            $table->string('authorization_number', 30)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('city');
            $table->string('state', 2)->default('MT');
            $table->json('authorized_species')->nullable();
            $table->json('mechanics')->nullable();
            $table->timestamps();

            $table->index(['city', 'state']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inmetro_history');
        Schema::dropIfExists('inmetro_instruments');
        Schema::dropIfExists('inmetro_locations');
        Schema::dropIfExists('inmetro_competitors');
        Schema::dropIfExists('inmetro_owners');
    }
};
