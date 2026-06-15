<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('temporada_podios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('temporada_id')->constrained('temporadas')->cascadeOnDelete();
            $table->string('rango', 20);
            $table->foreignId('primer_lugar_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('segundo_lugar_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('tercer_lugar_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['temporada_id', 'rango']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temporada_podios');
    }
};
