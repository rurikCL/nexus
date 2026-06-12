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
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['EXHIBICIÓN', 'CEREMONIA', 'DEMOSTRACIÓN', 'TALLER', 'GALA']);
            $table->enum('status', ['PRÓXIMO', 'ABIERTO', 'REALIZADO'])->default('PRÓXIMO');
            $table->dateTime('event_date');
            $table->string('location')->nullable();
            $table->integer('reward')->default(0);
            $table->string('reward_badge')->nullable();
            $table->integer('capacity')->nullable();
            $table->string('banner')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
