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
        Schema::create('facilities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->integer('capacity');
            $table->integer('available_capacity');
            $table->decimal('min_temperature', 5, 2);
            $table->decimal('max_temperature', 5, 2);
            $table->decimal('cost', 10, 2)->default(0.00);
            $table->string('status')->default('AVAILABLE'); // AVAILABLE, UNAVAILABLE
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('facilities');
    }
};
