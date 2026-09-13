<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blockchain_ledger', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shipment_id')->index();
            $table->unsignedInteger('block_index');          // sequential per shipment (0, 1, 2 …)
            $table->string('event_type', 50);                // JOURNEY_STARTED, TELEMETRY_OK, TEMP_BREACH, REROUTE, DELIVERY_CONFIRMED
            $table->json('payload');                         // full event data
            $table->char('previous_hash', 64);               // SHA-256 of previous block (genesis = 64 zeros)
            $table->char('block_hash', 64)->unique();        // SHA-256 of this block — unique ensures tamper detection
            $table->string('receipt_token', 64)->nullable()->unique(); // only set on DELIVERY_CONFIRMED
            $table->timestamps();

            $table->unique(['shipment_id', 'block_index']); // no duplicate index per shipment
            $table->foreign('shipment_id')->references('id')->on('shipments')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blockchain_ledger');
    }
};
