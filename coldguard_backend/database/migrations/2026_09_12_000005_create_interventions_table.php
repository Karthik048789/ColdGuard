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
        Schema::create('interventions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->foreignId('risk_event_id')->nullable()->constrained('risk_events')->onDelete('set null');
            $table->foreignId('facility_id')->nullable()->constrained('facilities')->onDelete('set null');
            $table->text('reason')->nullable();
            $table->string('status')->default('ACTIVE'); // PENDING, ACTIVE, FACILITY_SELECTED, DIVERTED, RESOLVED, CANCELLED
            $table->string('severity')->default('CRITICAL'); // HIGH, CRITICAL
            $table->decimal('risk_score', 5, 2)->default(0.00);
            $table->decimal('original_destination_lat', 10, 7)->nullable();
            $table->decimal('original_destination_lng', 10, 7)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interventions');
    }
};
