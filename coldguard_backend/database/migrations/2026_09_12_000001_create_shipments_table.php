<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->string('tracking_number')->unique();
            $table->string('product_name');
            $table->integer('quantity');
            $table->string('quantity_unit')->default('doses');
            $table->string('origin_name');
            $table->decimal('origin_lat', 10, 7);
            $table->decimal('origin_lng', 10, 7);
            $table->string('destination_name');
            $table->decimal('destination_lat', 10, 7);
            $table->decimal('destination_lng', 10, 7);
            $table->decimal('min_temp', 5, 2)->default(2.00);
            $table->decimal('max_temp', 5, 2)->default(8.00);
            $table->decimal('shipment_value', 12, 2)->default(0.00);
            $table->string('status')->default('CREATED');
            $table->string('driver_name')->default('John Driver');
            $table->string('driver_phone')->default('+91 9876543210');
            $table->decimal('current_lat', 10, 7)->nullable();
            $table->decimal('current_lng', 10, 7)->nullable();
            $table->decimal('current_temp', 5, 2)->nullable();
            $table->decimal('current_humidity', 5, 2)->nullable();
            $table->decimal('current_battery', 5, 2)->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
