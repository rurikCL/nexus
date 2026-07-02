<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_hitos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained('characters')->cascadeOnDelete();
            $table->string('hito', 255);
            $table->timestamps();

            $table->unique(['character_id', 'hito']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_hitos');
    }
};
