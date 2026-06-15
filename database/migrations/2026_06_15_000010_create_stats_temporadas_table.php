<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stats_temporadas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('temporada_id')->nullable()->constrained('temporadas')->nullOnDelete();
            $table->integer('wins')->default(0);
            $table->integer('losses')->default(0);
            $table->integer('streak')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'temporada_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stats_temporadas');
    }
};
