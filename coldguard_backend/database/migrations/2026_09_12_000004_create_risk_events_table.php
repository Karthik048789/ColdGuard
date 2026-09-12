<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->decimal('risk_score', 5, 2); // 0.00 to 100.00%
            $table->string('severity'); // LOW, MEDIUM, HIGH, CRITICAL
            $table->integer('predicted_failure_minutes')->nullable();
            $table->text('reason');
            $table->text('recommendation')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_events');
    }
};
