<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->foreignId('intervention_id')->nullable()->constrained('interventions')->onDelete('cascade');
            $table->string('recipient_role'); // MANAGER, DRIVER, RECEIVER
            $table->string('type'); // COLD_CHAIN_WARNING, COLD_CHAIN_CRITICAL, DIVERSION_REQUIRED, FACILITY_SELECTED, ROUTE_UPDATED, INTERVENTION_RESOLVED
            $table->string('title');
            $table->text('message');
            $table->string('severity')->default('HIGH'); // LOW, MEDIUM, HIGH, CRITICAL
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
